import { google, docs_v1 } from 'googleapis';
import { auth } from './auth';
import pLimit from 'p-limit';
import type { GoogleDocImage } from '@/types';

interface TabContent {
  tabId: string;
  tabTitle: string;
  text: string;
}

export interface GoogleDocsResult {
  success: boolean;
  content?: string;
  tabs?: TabContent[];
  images?: GoogleDocImage[];
  imageWarning?: string;
  error?: string;
  errorCode?: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNSUPPORTED_TYPE' | 'UNKNOWN';
}

// -----------------------------------------------------------------------------
// Image Extraction Types & Constants
// -----------------------------------------------------------------------------

interface ExtractedImageMetadata {
  readonly objectId: string;
  readonly contentUri: string;
  readonly width?: number;
  readonly height?: number;
  readonly altText?: string;
  readonly tabId?: string;
  readonly type: 'inline' | 'positioned';
}

const MAX_IMAGE_DIMENSION = 1568; // Claude's optimal input size
const JPEG_QUALITY = 80;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit per image
const CONCURRENT_DOWNLOADS = 8;

export async function fetchGoogleDoc(documentId: string): Promise<GoogleDocsResult> {
  const session = await auth();

  if (!session?.accessToken) {
    return {
      success: false,
      error: 'Google account not connected',
      errorCode: 'NOT_AUTHENTICATED'
    };
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  try {
    const response = await docs.documents.get({
      documentId,
      includeTabsContent: true,
    });

    const document = response.data;
    const allTabs = getAllTabs(document.tabs || []);

    // If no tabs, try to get content from legacy body field
    if (allTabs.length === 0 && document.body?.content) {
      const text = readStructuralElements(document.body.content);
      return {
        success: true,
        content: text,
        tabs: [{ tabId: 'main', tabTitle: 'Document', text }]
      };
    }

    const tabs = allTabs.map(tab => ({
      tabId: tab.tabProperties?.tabId || '',
      tabTitle: tab.tabProperties?.title || 'Untitled',
      text: extractTextFromTab(tab),
    }));

    // Combine tabs with headers (only if more than one tab)
    let combinedContent: string;
    if (tabs.length === 1) {
      combinedContent = tabs[0].text;
    } else {
      combinedContent = tabs.map(tab =>
        `--- Tab: ${tab.tabTitle} ---\n${tab.text}`
      ).join('\n\n');
    }

    // Extract and download images
    const imageMetadata = extractImagesFromDocument(document);
    let images: GoogleDocImage[] = [];
    let imageWarning: string | undefined;

    if (imageMetadata.length > 0 && session.accessToken) {
      const { images: downloadedImages, failedCount } = await downloadAllImages(
        imageMetadata,
        session.accessToken
      );
      images = downloadedImages;

      if (failedCount > 0) {
        imageWarning = `${failedCount} image(s) could not be loaded`;
      }
    }

    return {
      success: true,
      content: combinedContent,
      tabs,
      images: images.length > 0 ? images : undefined,
      imageWarning,
    };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    if (err.code === 403) {
      return { success: false, error: 'Access denied to this document', errorCode: 'ACCESS_DENIED' };
    }
    if (err.code === 404) {
      return { success: false, error: 'Document not found or has been deleted', errorCode: 'NOT_FOUND' };
    }
    if (err.code === 429) {
      return { success: false, error: 'Rate limited - please try again shortly', errorCode: 'RATE_LIMITED' };
    }
    return { success: false, error: err.message || 'Unknown error', errorCode: 'UNKNOWN' };
  }
}

function getAllTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
  const allTabs: docs_v1.Schema$Tab[] = [];

  function addCurrentAndChildTabs(tab: docs_v1.Schema$Tab) {
    allTabs.push(tab);
    if (tab.childTabs) {
      for (const childTab of tab.childTabs) {
        addCurrentAndChildTabs(childTab);
      }
    }
  }

  for (const tab of tabs) {
    addCurrentAndChildTabs(tab);
  }

  return allTabs;
}

function extractTextFromTab(tab: docs_v1.Schema$Tab): string {
  const content = tab.documentTab?.body?.content || [];
  return readStructuralElements(content);
}

function readStructuralElements(elements: docs_v1.Schema$StructuralElement[]): string {
  let text = '';

  for (const element of elements) {
    if (element.paragraph) {
      for (const paragraphElement of element.paragraph.elements || []) {
        if (paragraphElement.textRun?.content) {
          text += paragraphElement.textRun.content;
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += readStructuralElements(cell.content || []);
        }
      }
    } else if (element.tableOfContents) {
      text += readStructuralElements(element.tableOfContents.content || []);
    }
  }

  return text;
}

// URL parsing utilities
export function parseGoogleDocsUrl(url: string): {
  isGoogleDoc: boolean;
  documentId: string | null;
  isUnsupportedType: boolean;
  docType?: string;
} {
  // Google Docs
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return { isGoogleDoc: true, documentId: docsMatch[1], isUnsupportedType: false };
  }

  // Google Sheets (unsupported)
  if (url.includes('docs.google.com/spreadsheets')) {
    return { isGoogleDoc: false, documentId: null, isUnsupportedType: true, docType: 'Google Sheets' };
  }

  // Google Slides (unsupported)
  if (url.includes('docs.google.com/presentation')) {
    return { isGoogleDoc: false, documentId: null, isUnsupportedType: true, docType: 'Google Slides' };
  }

  // Google Drive file (may or may not be a Doc)
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return { isGoogleDoc: true, documentId: driveMatch[1], isUnsupportedType: false };
  }

  return { isGoogleDoc: false, documentId: null, isUnsupportedType: false };
}

export function isGoogleDocsUrl(url: string): boolean {
  return url.includes('docs.google.com') || url.includes('drive.google.com');
}

// -----------------------------------------------------------------------------
// Image Extraction Functions
// -----------------------------------------------------------------------------

/**
 * Extract image metadata from a Google Docs document.
 * Iterates through all tabs (including nested) and collects inline/positioned objects.
 */
function extractImagesFromDocument(
  document: docs_v1.Schema$Document
): ExtractedImageMetadata[] {
  const images: ExtractedImageMetadata[] = [];

  function processTab(tab: docs_v1.Schema$Tab): void {
    const tabId = tab.tabProperties?.tabId;
    const documentTab = tab.documentTab;

    if (!documentTab) return;

    // Extract inline objects (images embedded in text flow)
    if (documentTab.inlineObjects) {
      for (const [objectId, obj] of Object.entries(documentTab.inlineObjects)) {
        const embedded = obj.inlineObjectProperties?.embeddedObject;
        const imageProps = embedded?.imageProperties;

        // Only process if it's an image (not a drawing)
        if (imageProps?.contentUri && !embedded?.embeddedDrawingProperties) {
          images.push({
            objectId,
            contentUri: imageProps.contentUri,
            width: embedded?.size?.width?.magnitude ?? undefined,
            height: embedded?.size?.height?.magnitude ?? undefined,
            altText: embedded?.title || embedded?.description || undefined,
            tabId: tabId || undefined,
            type: 'inline',
          });
        }
      }
    }

    // Extract positioned objects (floating/anchored images)
    if (documentTab.positionedObjects) {
      for (const [objectId, obj] of Object.entries(documentTab.positionedObjects)) {
        const embedded = obj.positionedObjectProperties?.embeddedObject;
        const imageProps = embedded?.imageProperties;

        if (imageProps?.contentUri && !embedded?.embeddedDrawingProperties) {
          images.push({
            objectId,
            contentUri: imageProps.contentUri,
            width: embedded?.size?.width?.magnitude ?? undefined,
            height: embedded?.size?.height?.magnitude ?? undefined,
            altText: embedded?.title || embedded?.description || undefined,
            tabId: tabId || undefined,
            type: 'positioned',
          });
        }
      }
    }

    // Recursively process child tabs
    if (tab.childTabs) {
      tab.childTabs.forEach(processTab);
    }
  }

  // Process all tabs
  document.tabs?.forEach(processTab);

  return images;
}

/**
 * Download a single image and convert it to base64 JPEG.
 * Returns null if download or conversion fails.
 */
async function downloadAndConvertImage(
  metadata: ExtractedImageMetadata,
  accessToken: string
): Promise<GoogleDocImage | null> {
  try {
    // Download image using OAuth token
    const response = await fetch(metadata.contentUri, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`Failed to download image ${metadata.objectId}: HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    // Security: Validate size before processing
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      console.error(`Image ${metadata.objectId} exceeds 5MB limit`);
      return null;
    }

    // Resize and convert to base64
    const processed = await resizeAndConvert(arrayBuffer);
    if (!processed) return null;

    return {
      objectId: metadata.objectId,
      base64Data: processed.base64Data,
      mimeType: 'image/jpeg',
      width: processed.width,
      height: processed.height,
      altText: metadata.altText,
      tabId: metadata.tabId,
      type: metadata.type,
    };
  } catch (error) {
    console.error(`Failed to download image ${metadata.objectId}:`, error);
    return null;
  }
}

/**
 * Resize image and convert to base64 JPEG using Sharp.
 */
async function resizeAndConvert(
  arrayBuffer: ArrayBuffer
): Promise<{ base64Data: string; width: number; height: number } | null> {
  try {
    const sharp = (await import('sharp')).default;

    const { data, info } = await sharp(Buffer.from(arrayBuffer), {
      failOn: 'truncated', // Handle corrupt images gracefully
      limitInputPixels: 100_000_000, // Prevent memory issues (100 megapixels)
    })
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true, // Don't upscale small images
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return {
      base64Data: data.toString('base64'),
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    console.error('Sharp processing error:', error);
    return null;
  }
}

/**
 * Download all images concurrently using semaphore pattern.
 */
async function downloadAllImages(
  imageMetadata: ExtractedImageMetadata[],
  accessToken: string
): Promise<{ images: GoogleDocImage[]; failedCount: number }> {
  const limit = pLimit(CONCURRENT_DOWNLOADS);
  const images: GoogleDocImage[] = [];
  let failedCount = 0;

  await Promise.all(
    imageMetadata.map((meta) =>
      limit(async () => {
        const result = await downloadAndConvertImage(meta, accessToken);
        if (result) {
          images.push(result);
        } else {
          failedCount++;
        }
      })
    )
  );

  return { images, failedCount };
}
