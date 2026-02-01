import { google, docs_v1 } from 'googleapis';
import { auth } from './auth';

interface TabContent {
  tabId: string;
  tabTitle: string;
  text: string;
}

export interface GoogleDocsResult {
  success: boolean;
  content?: string;
  tabs?: TabContent[];
  error?: string;
  errorCode?: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNSUPPORTED_TYPE' | 'UNKNOWN';
}

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

    return { success: true, content: combinedContent, tabs };
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
