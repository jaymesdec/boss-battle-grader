---
title: "feat: Add Google Docs Image Extraction Support"
type: feat
date: 2026-02-02
deepened: 2026-02-02
---

# Add Google Docs Image Extraction Support

## Enhancement Summary

**Deepened on:** 2026-02-02
**Research agents used:** kieran-typescript-reviewer, performance-oracle, security-sentinel, code-simplicity-reviewer, architecture-strategist, agent-native-reviewer, pattern-recognition-specialist, julik-frontend-races-reviewer, best-practices-researcher, framework-docs-researcher, learnings-researcher

### Key Improvements from Research

1. **Race Condition Fixes**: Added cancellation tokens and proper cleanup for async fetches in React hooks
2. **Security Hardening**: Added input validation, size limits, and SSRF protection recommendations
3. **Performance Optimizations**: Semaphore-based concurrency, progressive loading, Sharp configuration improvements
4. **Simplified Approach**: Removed unnecessary retry complexity, streamlined batching
5. **Pattern Alignment**: Aligned with existing PDFViewer patterns for consistency
6. **Claude Vision Best Practices**: Optimized image sizing for AI analysis (1568px max, 80% quality)

### Critical Findings

| Area | Finding | Action |
|------|---------|--------|
| Race Conditions | useEffect lacks cancellation token | Fixed in enhanced code |
| Security | No image size validation | Add 5MB limit per image |
| Performance | Batch delays wasteful | Use semaphore concurrency |
| Simplicity | Retry logic unnecessary | Remove, single attempt |
| Patterns | Different labeling than PDF | Standardize to `[Image N of M]` |

---

## Overview

Enable the grading application to extract images embedded in Google Docs submissions and display them in the SubmissionViewer preview, as well as pass them to Claude AI as context when generating feedback. Currently, only text content is extracted from Google Docs, causing teachers to miss important visual content like diagrams, charts, and student drawings.

## Problem Statement / Motivation

Students frequently submit Google Docs containing:
- Diagrams and flowcharts explaining their work
- Screenshots of code or output
- Hand-drawn sketches (uploaded as images)
- Charts and graphs from data analysis
- Annotated images showing their process

Currently, the system extracts only text from Google Docs via the `readStructuralElements()` function in `src/lib/google.ts`. This means:

1. **Teachers can't see images in the SubmissionViewer** - They must open the original Google Doc to view visual content
2. **AI feedback is incomplete** - Claude cannot analyze diagrams, charts, or visual work
3. **Grading quality suffers** - Visual elements often contain critical information for assessment

## Proposed Solution

Extend the Google Docs integration to:

1. **Extract images** from both `inlineObjects` (inline with text) and `positionedObjects` (floating/anchored) in the API response
2. **Download and convert** images to base64 format (matching the existing PDF pattern)
3. **Display images** in SubmissionViewer with a gallery/thumbnail view
4. **Pass images to Claude AI** alongside text for comprehensive feedback generation

### Key Behaviors

| Scenario | Behavior |
|----------|----------|
| Google Doc with images, OAuth connected | Extract text + images, display both, AI analyzes both |
| Google Doc with images, OAuth not connected | Show prompt to connect Google, text-only fallback |
| Document with 20+ images | Extract all, limit AI context to 20 images (with warning) |
| Image download fails | Skip failed image, proceed with available images, show warning |
| contentUri expired (30+ min) | Images already cached as base64, no re-fetch needed |
| Images in tables/nested structures | Extract from all locations recursively |
| Multi-tab document with images | Extract images from all tabs |

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Google Docs API                               │
│  documents.get(documentId, includeTabsContent: true)                │
│  Response: { tabs: [{ documentTab: { inlineObjects, positionedObjects }}] }
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   src/lib/google.ts                                  │
│  ┌────────────────────┐    ┌────────────────────────────────┐       │
│  │ fetchGoogleDoc()   │───▶│ extractImagesFromDocument()    │       │
│  │ (existing)         │    │ - Iterate inlineObjects        │       │
│  │                    │    │ - Iterate positionedObjects    │       │
│  │                    │    │ - Recurse into tabs            │       │
│  └────────────────────┘    └────────────────────────────────┘       │
│                                        │                             │
│                                        ▼                             │
│                            ┌────────────────────────────────┐       │
│                            │ downloadAndConvertImages()     │       │
│                            │ - Fetch via contentUri + OAuth │       │
│                            │ - Resize to max 1568px         │       │
│                            │ - Convert to base64 JPEG       │       │
│                            └────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               src/components/SubmissionViewer.tsx                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ GoogleDocViewer                                                 │ │
│  │ ┌─────────────┐  ┌──────────────────────────────────────────┐  │ │
│  │ │ Text View   │  │ Image Gallery (inline with text)         │  │ │
│  │ │ (existing)  │  │ - "AI can see X images" indicator        │  │ │
│  │ │             │  │ - Click to enlarge                       │  │ │
│  │ └─────────────┘  └──────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               src/app/api/agent/route.ts                             │
│  handleGenerateAllFeedback()                                         │
│  - Receives googleDocImages[] alongside pdfImages[]                  │
│  - Adds to Claude message: image blocks + "[Image N of M]" labels   │
│  - Limits to 20 images to manage token costs                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Research Insights: Architecture

**Best Practices Discovered:**
- **Unified image type**: Consider creating a shared `ContentImage` interface that both PDFViewer and GoogleDocViewer use for consistency
- **State lifting**: The callback pattern (`onImagesLoaded`) is correct - it matches existing PDFViewer pattern
- **Memory management**: Consider separating thumbnails (for display) from full images (for AI) to reduce React state size

**Potential Refactoring:**
```typescript
// Future consideration: unified image interface
interface ContentImage {
  source: 'pdf' | 'google-doc';
  base64Data: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  label?: string;
}
```

---

### Implementation Phases

#### Phase 1: Type Definitions & Image Extraction

**Tasks:**
1. Add `GoogleDocImage` interface to type definitions
2. Extend `GoogleDocsResult` interface to include images
3. Implement `extractImagesFromDocument()` function
4. Handle inlineObjects, positionedObjects, and nested tabs

**Files to create/modify:**

```typescript
// src/types/index.ts - Add new types

export interface GoogleDocImage {
  readonly objectId: string;
  readonly base64Data: string;
  readonly mimeType: 'image/jpeg'; // Always convert to JPEG for consistency
  readonly width: number;
  readonly height: number;
  readonly altText?: string;
  readonly tabId?: string;
  readonly type: 'inline' | 'positioned';
}

// Extend existing GoogleDocsResult
export interface GoogleDocsResult {
  readonly success: boolean;
  readonly content?: string;
  readonly tabs?: TabContent[];
  readonly images?: GoogleDocImage[];  // NEW
  readonly imageWarning?: string;       // NEW
  readonly error?: string;
  readonly errorCode?: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNSUPPORTED_TYPE' | 'UNKNOWN';
}
```

### Research Insights: Type Definitions

**TypeScript Best Practices Applied:**
- Added `readonly` modifiers for immutable API response data
- Simplified `mimeType` to always be `'image/jpeg'` since we convert all images
- Consider adding Zod schema validation for runtime type safety of API responses

**From Pattern Recognition Review:**
- The two-type pattern (`ExtractedImageMetadata` → `GoogleDocImage`) is justified: one holds temporary `contentUri`, the other holds final `base64Data`

```typescript
// src/lib/google.ts - Add image extraction

interface ExtractedImageMetadata {
  readonly objectId: string;
  readonly contentUri: string;
  readonly width?: number;
  readonly height?: number;
  readonly altText?: string;
  readonly tabId?: string;
  readonly type: 'inline' | 'positioned';
}

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
            width: embedded?.size?.width?.magnitude,
            height: embedded?.size?.height?.magnitude,
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
            width: embedded?.size?.width?.magnitude,
            height: embedded?.size?.height?.magnitude,
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
```

### Research Insights: Google Docs API

**From Framework Documentation Research:**
- `contentUri` has a **30-minute default lifetime** and is tagged with the requester's account
- When `includeTabsContent: true`, access objects via `document.tabs[n].documentTab.inlineObjects` (NOT `document.inlineObjects`)
- `EmbeddedObject` can be an image OR a drawing - check for `imageProperties` vs `embeddedDrawingProperties`
- Alt text is combination of `title` + `description` fields

**Edge Cases Discovered:**
- Images in linked Sheets charts have `linkedContentReference` - skip these for now
- Drawings are vector graphics, not in `inlineObjects` - out of scope for initial implementation

**Success criteria:**
- [ ] `GoogleDocImage` type defined with readonly modifiers
- [ ] `GoogleDocsResult` extended with optional `images` and `imageWarning` fields
- [ ] Images extracted from `inlineObjects` map
- [ ] Images extracted from `positionedObjects` map
- [ ] Images extracted from all document tabs (including nested child tabs)
- [ ] Alt text/description captured when available
- [ ] Drawings (vector graphics) are filtered out

---

#### Phase 2: Image Download & Conversion

**Tasks:**
1. Implement image download using OAuth token
2. Add image resizing to max 1568px dimension
3. Convert to base64 JPEG format (matching PDFViewer pattern)
4. Handle download failures gracefully (no retry - simplicity)
5. Implement concurrent downloading with semaphore

**Files to modify:**
- `src/lib/google.ts` - Add download and conversion functions

### Research Insights: Performance

**From Performance Oracle Review:**
- **Remove batch delays**: Google's CDN can handle concurrent requests; 500ms delays are wasteful
- **Use semaphore concurrency**: Replace batching with `p-limit` pattern for better throughput
- **Sharp optimization**: Add `failOn: 'truncated'`, `limitInputPixels`, `withoutEnlargement: true`

**From Simplicity Review:**
- **Remove retry logic**: Most failures (expired token, deleted image) won't be fixed by retrying
- **Skip resizing initially**: Consider if Sharp is even needed - Google's images are usually reasonable size

**Recommended Optimizations:**
| Optimization | Impact | Implementation |
|--------------|--------|----------------|
| Semaphore concurrency | 30-50% faster | `p-limit(8)` instead of batch delays |
| Remove retries | Simpler code | Single attempt, skip failures |
| Sharp configuration | 10-20% faster | `withoutEnlargement`, `mozjpeg` |
| Progressive loading | Better UX | Callback as each image loads |

```typescript
// src/lib/google.ts - Add download and conversion (ENHANCED)

import pLimit from 'p-limit';

const MAX_IMAGE_DIMENSION = 1568; // Claude's optimal input size
const JPEG_QUALITY = 80;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit per image
const CONCURRENT_DOWNLOADS = 8;

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

async function resizeAndConvert(
  arrayBuffer: ArrayBuffer
): Promise<{ base64Data: string; width: number; height: number } | null> {
  try {
    const sharp = (await import('sharp')).default;

    const { data, info } = await sharp(Buffer.from(arrayBuffer), {
      failOn: 'truncated',           // Handle corrupt images gracefully
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

async function downloadAllImages(
  imageMetadata: ExtractedImageMetadata[],
  accessToken: string,
  onImageLoaded?: (image: GoogleDocImage, index: number, total: number) => void
): Promise<{ images: GoogleDocImage[]; failedCount: number }> {
  const limit = pLimit(CONCURRENT_DOWNLOADS);
  const images: GoogleDocImage[] = [];
  let failedCount = 0;
  const total = imageMetadata.length;

  await Promise.all(
    imageMetadata.map((meta, index) =>
      limit(async () => {
        const result = await downloadAndConvertImage(meta, accessToken);
        if (result) {
          images.push(result);
          onImageLoaded?.(result, index, total);
        } else {
          failedCount++;
        }
      })
    )
  );

  return { images, failedCount };
}
```

### Research Insights: Sharp Best Practices

**From Sharp Documentation (Context7):**
```javascript
// Optimal Sharp configuration for this use case
sharp(buffer, {
  failOn: 'truncated',           // Handle partially corrupt images
  limitInputPixels: 100_000_000, // Prevent memory exhaustion (100MP)
})
  .resize(maxDimension, maxDimension, {
    fit: 'inside',               // Preserve aspect ratio, constrain to max
    withoutEnlargement: true,    // Don't upscale small images
  })
  .jpeg({ quality: 80 })         // 80% is optimal for AI analysis
  .toBuffer({ resolveWithObject: true }); // Get dimensions in response
```

**Key Improvements:**
- `withoutEnlargement: true` - Prevents quality loss from upscaling small images
- `failOn: 'truncated'` - Gracefully handles corrupt images instead of throwing
- `limitInputPixels` - Prevents memory exhaustion attacks

**Success criteria:**
- [ ] Images downloaded using OAuth access token with 10s timeout
- [ ] Images validated for size (<5MB) before processing
- [ ] Images resized to max 1568px on longest edge (without upscaling)
- [ ] Images converted to base64 JPEG format at 80% quality
- [ ] Concurrent downloads using semaphore pattern (8 concurrent)
- [ ] Progressive loading callback for UX improvement
- [ ] Failed images skipped gracefully (no retry)

---

#### Phase 3: API Integration

**Tasks:**
1. Update `fetchGoogleDoc()` to include images in result
2. Update `/api/google-docs` route to return images
3. Add image data to API response schema

**Files to modify:**
- `src/lib/google.ts` - Update main fetch function
- `src/app/api/google-docs/route.ts` - Update API response

```typescript
// src/lib/google.ts - Update fetchGoogleDoc (ENHANCED)

export async function fetchGoogleDoc(documentId: string): Promise<GoogleDocsResult> {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return {
      success: false,
      error: 'Google account not connected',
      errorCode: 'NOT_AUTHENTICATED'
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });

  const docs = google.docs({ version: 'v1', auth });

  try {
    const response = await docs.documents.get({
      documentId,
      includeTabsContent: true,
    });

    const document = response.data;

    // Extract text (existing logic)
    const allTabs = getAllTabs(document.tabs || []);
    const tabs = allTabs.map(tab => ({
      tabId: tab.tabProperties?.tabId || '',
      tabTitle: tab.tabProperties?.title || 'Untitled',
      text: extractTextFromTab(tab),
    }));
    const combinedContent = tabs.map(tab =>
      `--- Tab: ${tab.tabTitle} ---\n${tab.text}`
    ).join('\n\n');

    // Extract and download images (NEW)
    const imageMetadata = extractImagesFromDocument(document);
    let images: GoogleDocImage[] = [];
    let imageWarning: string | undefined;

    if (imageMetadata.length > 0) {
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
      images,
      imageWarning,
    };
  } catch (error: any) {
    // Log full error for debugging (from learnings)
    console.error('[fetchGoogleDoc] Error:', error.code, error.message, error.response?.data);

    if (error.code === 403) {
      // Check if API not enabled vs permission denied
      if (error.message?.includes('not been used in project')) {
        console.error('Google Docs API not enabled in Google Cloud Console');
      }
      return { success: false, error: 'Access denied', errorCode: 'ACCESS_DENIED' };
    }
    if (error.code === 404) {
      return { success: false, error: 'Document not found', errorCode: 'NOT_FOUND' };
    }
    if (error.code === 429) {
      return { success: false, error: 'Rate limited', errorCode: 'RATE_LIMITED' };
    }
    return { success: false, error: error.message, errorCode: 'UNKNOWN' };
  }
}
```

### Research Insights: Error Handling

**From Learnings (google-docs-api-not-enabled-403-error.md):**
- 403 errors are often "API not enabled" not permission issues
- Always log full error response for debugging: `error.response?.data`
- Check for "not been used in project" in error message to distinguish

**Success criteria:**
- [ ] `fetchGoogleDoc()` returns images alongside text
- [ ] API route returns images in response body
- [ ] Warning message included when some images fail to load
- [ ] Full error details logged for debugging

---

#### Phase 4: SubmissionViewer UI

**Tasks:**
1. Update `GoogleDocViewer` component to display images
2. Add inline image display (simpler than thumbnail gallery)
3. Add "AI can see X images" indicator
4. Handle loading and error states for images
5. **Fix race conditions in useEffect**

**Files to modify:**
- `src/components/SubmissionViewer.tsx` - Update GoogleDocViewer

### Research Insights: React Race Conditions

**From Julik Frontend Races Review - CRITICAL FIXES:**

1. **Stale Fetch Problem**: Document ID changes while fetch in progress - old response overwrites new
2. **Updates After Unmount**: Component unmounts while fetch in flight
3. **Callback in Dependency Array**: Can cause infinite loops

**Required Fixes:**
- Add cancellation token in useEffect cleanup
- Use ref for callback to avoid dependency issues
- Reset state immediately when documentId changes

```typescript
// src/components/SubmissionViewer.tsx - Update GoogleDocViewer (ENHANCED)

interface GoogleDocViewerProps {
  url: string;
  documentId: string;
  onImagesLoaded?: (images: GoogleDocImage[]) => void;
}

function GoogleDocViewer({ url, documentId, onImagesLoaded }: GoogleDocViewerProps) {
  const [state, setState] = useState<{
    status: 'loading' | 'success' | 'not_connected' | 'error';
    content?: string;
    images?: GoogleDocImage[];
    imageWarning?: string;
    error?: string;
  }>({ status: 'loading' });

  // Use ref for callback to avoid dependency issues (from race condition review)
  const onImagesLoadedRef = useRef(onImagesLoaded);
  useEffect(() => {
    onImagesLoadedRef.current = onImagesLoaded;
  });

  useEffect(() => {
    // Guard for missing documentId
    if (!documentId) {
      setState({ status: 'error', error: 'No document ID provided' });
      return;
    }

    // Cancellation token to prevent stale updates
    let cancelled = false;

    // Reset to loading state immediately
    setState(prev => ({ ...prev, status: 'loading' }));

    fetchGoogleDocContent(documentId)
      .then(result => {
        if (cancelled) return; // Stale request, ignore

        if (result.success) {
          setState({
            status: 'success',
            content: result.content,
            images: result.images,
            imageWarning: result.imageWarning,
          });

          // Defer callback to next tick to escape render cycle
          if (result.images?.length) {
            queueMicrotask(() => {
              if (!cancelled) {
                onImagesLoadedRef.current?.(result.images!);
              }
            });
          }
        } else if (result.errorCode === 'NOT_AUTHENTICATED') {
          setState({ status: 'not_connected' });
        } else {
          setState({ status: 'error', error: result.error });
        }
      })
      .catch(error => {
        if (cancelled) return;
        setState({ status: 'error', error: error.message });
      });

    // Cleanup: cancel stale requests
    return () => { cancelled = true; };
  }, [documentId]); // Note: onImagesLoaded deliberately excluded

  if (state.status === 'loading') {
    return <div className="animate-pulse">Loading Google Doc...</div>;
  }

  if (state.status === 'not_connected') {
    return (
      <div className="p-4 bg-surface rounded-lg border border-accent-secondary">
        <p className="text-text-primary mb-3">
          This submission is a private Google Doc.
        </p>
        <button
          onClick={() => signIn('google')}
          className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/90"
        >
          Connect Google Account
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="ml-3 text-accent-primary hover:underline text-sm">
          Or open manually
        </a>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700 mb-2">{state.error || 'Failed to load document'}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="text-accent-primary hover:underline text-sm">
          Open in Google Docs
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Gallery - Simplified inline display */}
      {state.images && state.images.length > 0 && (
        <div className="space-y-3">
          {/* AI indicator */}
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>
              {state.images.length} image{state.images.length !== 1 ? 's' : ''} detected
            </span>
            <span className="text-xs bg-surface px-2 py-0.5 rounded">
              AI can see {Math.min(state.images.length, 20)} image{Math.min(state.images.length, 20) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Warning if some failed */}
          {state.imageWarning && (
            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              {state.imageWarning}
            </div>
          )}

          {/* Inline images (simplified from thumbnail gallery) */}
          <div className="flex flex-wrap gap-2">
            {state.images.map((image, index) => (
              <img
                key={image.objectId}
                src={`data:${image.mimeType};base64,${image.base64Data}`}
                alt={image.altText || `Image ${index + 1}`}
                className="max-w-full max-h-64 rounded border object-contain"
              />
            ))}
          </div>
        </div>
      )}

      {/* Text content */}
      <div className="prose max-w-none whitespace-pre-wrap">
        {state.content}
      </div>
    </div>
  );
}
```

### Research Insights: UI Simplification

**From Simplicity Review:**
- Thumbnail gallery with selection state is over-engineered for 1-5 images
- Simpler inline display is sufficient and reduces ~40 LOC
- Can add gallery UI later if teachers request it

**Success criteria:**
- [ ] Race conditions fixed with cancellation token
- [ ] Callback uses ref pattern to avoid dependency issues
- [ ] Images display inline (simplified from gallery)
- [ ] "AI can see X images" indicator shown
- [ ] Warning displayed when some images failed to load
- [ ] Alt text shown when available
- [ ] Loading and error states handle all cases

---

#### Phase 5: AI Integration

**Tasks:**
1. Add callback to pass images from SubmissionViewer to BattleScreen
2. Update `handleGenerateAllFeedback` to include Google Doc images
3. Add images to Claude message with consistent labeling
4. Implement 20-image limit with truncation warning
5. Add input validation for security

**Files to modify:**
- `src/components/BattleScreen.tsx` - Add googleDocImages state
- `src/app/api/agent/route.ts` - Handle Google Doc images

### Research Insights: Claude Vision Best Practices

**From Claude API Documentation:**
- Images up to 8000x8000px supported (API), 2000x2000px (claude.ai)
- Optimal size: ~1000x1000px minimum for detailed analysis
- Max 100 images per API request (we limit to 20 for cost)
- Each 1000x1000px image uses ~1,334 tokens (~$0.004 with Sonnet)
- **Place images at the START of the prompt** for optimal performance

**From Agent-Native Review:**
- Current PDF labeling uses `[Slide N]`, Google Docs should use consistent pattern
- Include total count for context: `[Image 1 of 5]`
- Include alt text when available for richer context

```typescript
// src/components/BattleScreen.tsx - Add state and handler

const [googleDocImages, setGoogleDocImages] = useState<GoogleDocImage[]>([]);

const handleGoogleDocImagesLoaded = useCallback((images: GoogleDocImage[]) => {
  setGoogleDocImages(images);
}, []);

// Pass to SubmissionViewer
<SubmissionViewer
  // ... existing props
  onGoogleDocImagesLoaded={handleGoogleDocImagesLoaded}
/>

// Pass to API in generate_all_feedback
googleDocImages: googleDocImages.length > 0 ? googleDocImages : undefined,
```

```typescript
// src/app/api/agent/route.ts - Handle Google Doc images (ENHANCED)

const MAX_GOOGLE_DOC_IMAGES = 20;
const MAX_IMAGE_SIZE_BASE64 = 5 * 1024 * 1024; // 5MB per image

// Security: Validate images before processing
function validateGoogleDocImages(images: GoogleDocImage[]): GoogleDocImage[] {
  return images.filter(img => {
    // Validate size
    const sizeBytes = Buffer.byteLength(img.base64Data, 'base64');
    if (sizeBytes > MAX_IMAGE_SIZE_BASE64) {
      console.warn(`Rejecting oversized image: ${img.objectId}`);
      return false;
    }
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]+=*$/.test(img.base64Data)) {
      console.warn(`Rejecting invalid base64: ${img.objectId}`);
      return false;
    }
    return true;
  });
}

// In handleGenerateAllFeedback
if (googleDocImages && googleDocImages.length > 0) {
  const validImages = validateGoogleDocImages(googleDocImages);
  const imagesToUse = validImages.slice(0, MAX_GOOGLE_DOC_IMAGES);
  const truncated = validImages.length > MAX_GOOGLE_DOC_IMAGES;
  const total = imagesToUse.length;

  userContent.push({
    type: 'text',
    text: `I'm providing ${total} image${total !== 1 ? 's' : ''} from the student's Google Doc submission${truncated ? ` (${validImages.length - MAX_GOOGLE_DOC_IMAGES} additional images omitted due to limit)` : ''}:\n`,
  });

  for (let i = 0; i < imagesToUse.length; i++) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imagesToUse[i].mimeType,
        data: imagesToUse[i].base64Data,
      },
    });
    // Consistent labeling with PDF pattern
    const label = imagesToUse[i].altText
      ? `[Image ${i + 1} of ${total}: ${imagesToUse[i].altText}]`
      : `[Image ${i + 1} of ${total}]`;
    userContent.push({
      type: 'text',
      text: label,
    });
  }
}
```

### Research Insights: Security

**From Security Sentinel Review:**
- Validate base64 size before sending to Claude API
- Validate base64 format to prevent injection
- Log rejected images for monitoring
- Consider adding rate limiting to `/api/agent` endpoint

**Success criteria:**
- [ ] Google Doc images passed from SubmissionViewer to BattleScreen
- [ ] Images validated for size and format before Claude API call
- [ ] Images included in Claude API request
- [ ] Images labeled with "[Image N of M]" for AI reference (consistent with PDF)
- [ ] Maximum 20 images sent to AI
- [ ] Truncation warning included when images exceed limit
- [ ] Alt text included in image labels when available

---

#### Phase 6: Testing & Polish

**Tasks:**
1. Add unit tests for image extraction functions
2. Add integration tests for full flow
3. Test with various Google Doc configurations
4. Test race condition scenarios
5. Performance testing with large documents

**Test scenarios:**
- Document with 0 images
- Document with 1-5 images (inline only)
- Document with positioned/floating images
- Document with images in tables
- Multi-tab document with images in different tabs
- Document with 50+ images (exceeds AI limit)
- OAuth token expired during image download
- Partial image download failure
- Very large images (>5MB)
- Rapid document switching (race condition test)
- Component unmount during fetch (race condition test)

**Race Condition Test Cases:**
```typescript
// Test: Rapid document switching
it('should not overwrite with stale fetch results', async () => {
  // Start fetch for doc A (slow)
  // Immediately switch to doc B (fast)
  // Verify final state shows doc B, not doc A
});

// Test: Unmount during fetch
it('should not update state after unmount', async () => {
  // Start fetch
  // Unmount component
  // Verify no React warnings about state updates
});
```

**Success criteria:**
- [ ] Unit tests pass for all extraction functions
- [ ] Race condition tests pass
- [ ] Integration tests cover happy path and error cases
- [ ] Performance acceptable for documents with 20+ images (<10 seconds)
- [ ] All error states handled gracefully

---

## Alternative Approaches Considered

### Alternative 1: Render Google Doc as PDF, Use Existing PDFViewer

**Approach:** Export Google Doc as PDF via API, then use existing PDFViewer infrastructure.

**Pros:**
- Leverages existing, tested code
- Consistent UX with PDF submissions
- No new image extraction logic needed

**Cons:**
- Loses document structure (text becomes image)
- PDF export may have formatting issues
- Doesn't solve the core problem of accessing embedded images
- Additional API call and latency

**Why rejected:** Doesn't actually extract the original images, just creates rendered versions. Also adds latency and potential formatting issues.

### Alternative 2: Link to Original Google Doc for Images

**Approach:** Display text in app, link to Google Doc for image viewing.

**Pros:**
- Minimal implementation effort
- No image downloading/storage
- Always shows latest version

**Cons:**
- Poor UX (context switching)
- AI still can't analyze images
- Defeats purpose of integrated grading

**Why rejected:** Doesn't solve the core problem of AI image analysis or teacher workflow.

### Alternative 3: Store Images Server-Side

**Approach:** Download images to server storage (S3/etc) instead of base64.

**Pros:**
- Reduces client-side memory usage
- Images persist beyond session
- Could enable caching across users

**Cons:**
- Added infrastructure complexity
- Storage costs
- Privacy/retention concerns
- CORS and security considerations

**Why rejected:** Unnecessary complexity for the use case. Base64 in-memory approach matches existing PDF pattern and is simpler.

### Alternative 4: Skip Sharp, Use Images As-Is (Simplification Consideration)

**Approach:** Don't resize images, trust Google's reasonable sizing.

**Pros:**
- No Sharp dependency
- Faster processing
- Simpler code

**Cons:**
- May hit Claude's size limits for large images
- Inconsistent with PDFViewer pattern
- Less control over quality/token usage

**Why not chosen:** Sharp provides necessary size control and quality optimization. 1568px max is Claude's recommended optimal input size.

---

## Acceptance Criteria

### Functional Requirements

- [x] Images extracted from Google Docs `inlineObjects`
- [x] Images extracted from Google Docs `positionedObjects`
- [x] Images extracted from nested table structures
- [x] Images extracted from all document tabs (including nested child tabs)
- [x] Images displayed in SubmissionViewer inline with text
- [x] "AI can see X images" indicator shown when images present
- [x] AI receives images in feedback generation request
- [x] AI references images using "[Image N of M]" labels (consistent with PDF)
- [x] Alt text displayed when available
- [x] OAuth prompt shown when not authenticated
- [x] Error messages displayed when image loading fails
- [x] Warning shown when some images fail to load
- [x] No race conditions when switching documents rapidly

### Non-Functional Requirements

- [x] Images resized to max 1568px on longest edge (without upscaling small images)
- [x] Images converted to JPEG format at 80% quality
- [x] Maximum 20 images sent to AI (with truncation warning)
- [x] Concurrent downloads using semaphore (8 concurrent)
- [x] 10-second timeout per image download
- [x] 5MB size limit per image
- [ ] Total image processing time < 10 seconds for typical document (5-10 images)
- [x] Base64 image data not persisted beyond session
- [x] Cancellation token prevents stale state updates

### Quality Gates

- [ ] Unit tests for image extraction functions
- [ ] Race condition tests pass
- [ ] Integration tests for full image flow
- [ ] Manual testing with various Google Doc configurations
- [ ] No memory leaks from image data handling
- [x] Error handling covers all documented failure modes
- [x] Security validation for image size and format

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Image extraction success rate | >95% | % of images successfully downloaded |
| Time to display images | <5s for 10 images | Measured from doc fetch to render |
| AI feedback quality with images | Improved specificity | Compare feedback scores for image-heavy submissions |
| Teacher satisfaction | Positive feedback | User feedback on image visibility feature |
| Race condition incidents | 0 | Monitoring for stale state warnings |

---

## Dependencies & Prerequisites

1. **Sharp library** - For server-side image resizing
2. **p-limit** - For semaphore-based concurrency control (or implement manually)
3. **Google OAuth scope** - `documents.readonly` scope sufficient (already configured)
4. **Existing Google Docs OAuth** - Must be working per existing plan

### Prerequisite Checklist (From Learnings)

Before implementing, verify:
- [ ] Google Docs API is enabled in Google Cloud Console
- [ ] OAuth scopes include `documents.readonly`
- [ ] Redirect URIs configured for dev and prod environments
- [ ] Sharp installed: `npm install sharp`
- [ ] p-limit installed: `npm install p-limit` (or use native implementation)

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| contentUri expires before download | Low | Medium | Download immediately on doc fetch, cache as base64 |
| Rate limiting from Google API | Medium | Medium | Semaphore concurrency, exponential backoff on 429 |
| Large images cause memory issues | Low | High | Resize before base64 conversion, limit to 20 images, 5MB cap |
| OAuth token expires mid-download | Low | Medium | Check token validity before batch, refresh if needed |
| Student edits doc after submission | Medium | Low | Document "fetched at" timestamp in UI |
| Malformed/corrupted images | Low | Low | Sharp `failOn: 'truncated'`, graceful skip |
| Race conditions in React | Medium | Medium | Cancellation token, ref pattern for callbacks |
| SSRF via contentUri | Low | High | contentUri is from Google API, already validated |

---

## Security Considerations

**From Security Review:**

1. **Input Validation**: Validate image size (<5MB) and base64 format before processing
2. **Rate Limiting**: Consider adding rate limiting to `/api/agent` endpoint
3. **Error Logging**: Log full errors server-side, return generic messages to client
4. **Token Handling**: OAuth token already server-side only (via NextAuth)

**Privacy Considerations:**
- Images may contain student names, faces, or identifying information
- Current text anonymization does not apply to images
- Consider adding privacy notice that images are sent to Anthropic for analysis

---

## Future Considerations

1. **Google Drawings support** - Rasterize vector drawings for AI analysis
2. **Image caching** - Cache extracted images to reduce re-fetching
3. **Image annotations** - Allow teachers to annotate images in feedback
4. **Selective image sending** - Let teachers choose which images to include for AI
5. **OCR-based anonymization** - Detect and redact student names in images
6. **Thumbnail optimization** - Separate low-res thumbnails for display, full-res for AI

---

## Documentation Plan

- [ ] Update user guide with image support information
- [ ] Add "Images in Google Docs" section to help documentation
- [ ] Document any new environment variables or configuration

---

## References

### Internal References

- Google Docs client: `src/lib/google.ts`
- Existing text extraction: `src/lib/google.ts:110-132`
- PDF image pattern: `src/components/PDFViewer.tsx:52-95`
- AI image format: `src/app/api/agent/route.ts:23-30`
- SubmissionViewer: `src/components/SubmissionViewer.tsx`
- BattleScreen state: `src/components/BattleScreen.tsx:109`

### External References

- [Google Docs API - InlineObject](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#InlineObject)
- [Google Docs API - ImageProperties](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#ImageProperties)
- [Google Docs API - Working with Tabs](https://developers.google.com/workspace/docs/api/how-tos/tabs)
- [Google Docs API Quotas](https://developers.google.com/workspace/docs/api/limits) - 300 reads/min per user
- [Claude Vision Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/vision)
- [Claude Vision - Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook/blob/main/multimodal/best_practices_for_vision.ipynb)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [Sharp Resize API](https://github.com/lovell/sharp/blob/main/docs/src/content/docs/api-resize.md)

### Related Work

- Google Docs OAuth plan: `docs/plans/2026-02-01-feat-google-docs-oauth-submission-support-plan.md`
- Expandable viewer plan: `docs/plans/2026-02-02-feat-expandable-submission-viewer-plan.md`

### Institutional Learnings Applied

- `docs/solutions/integration-issues/google-docs-api-not-enabled-403-error.md` - API setup checklist
- `docs/solutions/react-patterns/react-hooks-order-violation.md` - Hook patterns for async fetching
