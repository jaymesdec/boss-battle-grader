---
title: "feat: Add Google Slides extraction and preview support"
type: feat
date: 2026-02-02
---

# feat: Add Google Slides extraction and preview support

## Overview

Add support for Google Slides presentations in the grading workflow. Extract slide thumbnails and text content, display them in SubmissionViewer, and pass to Claude AI for grading context. This mirrors the existing Google Docs image extraction feature.

## Problem Statement / Motivation

Students submit Google Slides presentation URLs (e.g., `https://docs.google.com/presentation/d/xxx/edit`), but currently these are marked as "unsupported" in the application. Teachers cannot preview the slide content or have the AI analyze it when grading.

**Current behavior:** Shows "Google Slides is not supported" error message.

**Desired behavior:** Display all slides as images with speaker notes, pass to AI for context-aware grading.

## Proposed Solution

Extend the existing Google Docs integration pattern to support Google Slides:

1. **Update URL parsing** to extract presentation IDs
2. **Add Slides API integration** using `google.slides('v1')`
3. **Fetch slide thumbnails** via `presentations.pages.getThumbnail()`
4. **Extract text content** from shapes and speaker notes
5. **Process images** through existing Sharp pipeline (1568px, 80% JPEG)
6. **Display in SubmissionViewer** with slide navigation
7. **Pass to AI** with slide labels and speaker notes

## Technical Approach

### API Structure

Google Slides API v1 provides:
- `presentations.get({ presentationId })` - Full presentation data including all slides
- `presentations.pages.getThumbnail({ presentationId, pageObjectId })` - Slide thumbnail URL

**Thumbnail details:**
- Returns `contentUrl` with 30-minute expiry (same as Docs)
- Sizes: SMALL (200px), MEDIUM (800px), LARGE (1600px)
- Format: PNG

**OAuth scope required:** `https://www.googleapis.com/auth/presentations.readonly`

### Data Flow

```
Google Slides URL submitted
         │
         ▼
parseGoogleDocsUrl() extracts presentationId
         │
         ▼
/api/google-docs route detects presentation URL
         │
         ▼
fetchGoogleSlides() calls Slides API
         │
         ├── Get presentation metadata + slides array
         │
         ├── For each slide (concurrent with p-limit):
         │   ├── Fetch thumbnail via getThumbnail()
         │   ├── Download image with OAuth token
         │   ├── Resize with Sharp (1568px max)
         │   └── Convert to base64 JPEG
         │
         └── Extract text from shapes + speaker notes
         │
         ▼
Return GoogleSlidesResult to SubmissionViewer
         │
         ▼
Display slides with navigation + notes
         │
         ▼
Pass to AI via BattleScreen → /api/agent
```

### Type Definitions

```typescript
// src/types/index.ts
export interface GoogleSlideImage {
  readonly slideId: string;
  readonly slideNumber: number;
  readonly slideTitle?: string;
  readonly base64Data: string;
  readonly mimeType: 'image/jpeg';
  readonly width: number;
  readonly height: number;
  readonly speakerNotes?: string;
}

// Extend GoogleDocsResult or create GoogleSlidesResult
export interface GoogleSlidesResult {
  success: boolean;
  presentationTitle?: string;
  slides?: GoogleSlideImage[];
  textContent?: string;  // All extracted text combined
  slideWarning?: string; // "5 slides could not be loaded"
  error?: string;
  errorCode?: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'NOT_FOUND'
            | 'RATE_LIMITED' | 'API_NOT_ENABLED' | 'UNKNOWN';
}
```

## Implementation Phases

### Phase 1: OAuth & URL Parsing

- [ ] Add `presentations.readonly` scope to `src/lib/auth.ts`
- [ ] Update `parseGoogleDocsUrl()` in `src/lib/google.ts` to return presentation IDs
  - Change from `isUnsupportedType: true` to proper parsing
  - Return `{ isGoogleSlides: true, presentationId: string }`

### Phase 2: Slides API Integration

- [ ] Add `fetchGoogleSlides()` function in `src/lib/google.ts`
  - Initialize Slides API: `google.slides({ version: 'v1', auth: oauth2Client })`
  - Fetch presentation: `slides.presentations.get({ presentationId })`
  - For each slide, call `getThumbnail()` with LARGE size
  - Extract text from `pageElements[].shape.text.textElements`
  - Extract speaker notes from `slideProperties.notesPage`

- [ ] Implement `extractTextFromSlide()` helper
  - Iterate through `pageElements`
  - Extract from shapes, text boxes, tables
  - Return combined text content

- [ ] Implement `extractSpeakerNotes()` helper
  - Find speaker notes shape via `notesProperties.speakerNotesObjectId`
  - Extract text content

- [ ] Implement `downloadSlideThumbnails()` with concurrency
  - Reuse `pLimit(8)` pattern from Docs
  - Apply same 5MB limit, 10s timeout
  - Use existing `resizeAndConvert()` function

### Phase 3: API Route

- [ ] Update `/api/google-docs/route.ts` to handle Slides URLs
  - Detect presentation URLs via updated `parseGoogleDocsUrl()`
  - Call `fetchGoogleSlides()` instead of `fetchGoogleDoc()`
  - Return consistent response structure

### Phase 4: SubmissionViewer UI

- [ ] Update URL detection in `SubmissionViewer.tsx`
  - Add `docs.google.com/presentation` pattern

- [ ] Create `GoogleSlidesViewer` component (or extend `GoogleDocViewer`)
  - Display slides in carousel/grid view
  - Show slide number and title
  - Display speaker notes (collapsible)
  - "AI can see X slides" indicator
  - Handle loading/error states

- [ ] Add cancellation token pattern for race conditions
  - Same pattern as `GoogleDocViewer`

### Phase 5: AI Integration

- [ ] Update `BattleScreen.tsx`
  - Add `googleSlideImages` state (or reuse `googleDocImages`)
  - Add `handleGoogleSlidesLoaded` callback
  - Include slides in API calls

- [ ] Update `/api/agent/route.ts`
  - Accept `googleSlideImages` in request body
  - Format as `[Slide 1 of N: {title}]` labels
  - Include speaker notes: `[Slide 1 notes: {content}]`
  - Apply same 20-image limit

### Phase 6: Error Handling

- [ ] Handle Slides API not enabled (403 with specific message)
- [ ] Handle individual slide failures gracefully
- [ ] Show warnings for partially loaded presentations
- [ ] Log detailed errors for debugging

## Acceptance Criteria

### Functional Requirements

- [ ] Google Slides URLs are recognized and parsed correctly
- [ ] All slides are extracted as images (up to presentation limit)
- [ ] Speaker notes are extracted and displayed
- [ ] Slide text content is extracted for AI context
- [ ] Slides display in SubmissionViewer with navigation
- [ ] AI receives slides with proper labels and notes
- [ ] Error states show helpful messages

### Non-Functional Requirements

- [ ] Processing time < 30s for 50-slide presentation
- [ ] No memory issues with large presentations
- [ ] Race conditions handled when switching students
- [ ] Graceful degradation if some slides fail

### Quality Gates

- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Manual testing with various presentation types

## Dependencies & Risks

### Dependencies

- Google Slides API v1 (already available in `googleapis` package)
- Existing Sharp image processing pipeline
- OAuth already configured (just needs new scope)

### Risks

| Risk | Mitigation |
|------|------------|
| Slides API not enabled in GCP | Document setup steps, show actionable error |
| Users must re-consent for new scope | Use incremental auth or accept one-time prompt |
| Large presentations slow to process | Progress indicator, concurrent downloads |
| Thumbnail generation may timeout | Retry logic, timeout handling |

## References & Research

### Internal References

- Google Docs image extraction: `src/lib/google.ts:224-392`
- URL parsing: `src/lib/google.ts:181-210`
- Image display pattern: `src/components/SubmissionViewer.tsx:1242-1253`
- AI integration: `src/app/api/agent/route.ts:273-305`
- Race condition pattern: `src/components/SubmissionViewer.tsx:1065-1120`

### External References

- [Google Slides API - presentations.get](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/get)
- [Google Slides API - getThumbnail](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail)
- [Slides API scopes](https://developers.google.com/workspace/slides/api/scopes)

### Institutional Learnings

- **API not enabled 403 error**: Check for "not been used in project" in error message, provide setup link
- **OAuth scope additions**: Existing users may need to re-consent
- **Thumbnail URL expiry**: 30 minutes, same as Docs contentUri

## Code Examples

### Slides API Initialization

```typescript
// src/lib/google.ts
import { google, slides_v1 } from 'googleapis';

export async function fetchGoogleSlides(presentationId: string): Promise<GoogleSlidesResult> {
  const session = await auth();

  if (!session?.accessToken) {
    return { success: false, error: 'Google account not connected', errorCode: 'NOT_AUTHENTICATED' };
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const slides = google.slides({ version: 'v1', auth: oauth2Client });

  const response = await slides.presentations.get({ presentationId });
  const presentation = response.data;

  // Extract slides...
}
```

### Thumbnail Fetching

```typescript
async function fetchSlideThumbnail(
  slides: slides_v1.Slides,
  presentationId: string,
  slideId: string,
  accessToken: string
): Promise<GoogleSlideImage | null> {
  const thumbnail = await slides.presentations.pages.getThumbnail({
    presentationId,
    pageObjectId: slideId,
    'thumbnailProperties.mimeType': 'PNG',
    'thumbnailProperties.thumbnailSize': 'LARGE',
  });

  if (!thumbnail.data.contentUrl) return null;

  // Download and process with existing pipeline
  const response = await fetch(thumbnail.data.contentUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });

  const arrayBuffer = await response.arrayBuffer();
  const processed = await resizeAndConvert(arrayBuffer);

  return processed ? {
    slideId,
    slideNumber: 0, // Set by caller
    base64Data: processed.base64Data,
    mimeType: 'image/jpeg',
    width: processed.width,
    height: processed.height,
  } : null;
}
```

### Text Extraction

```typescript
function extractTextFromSlide(slide: slides_v1.Schema$Page): string {
  const texts: string[] = [];

  for (const element of slide.pageElements || []) {
    if (element.shape?.text?.textElements) {
      const text = element.shape.text.textElements
        .filter(el => el.textRun?.content)
        .map(el => el.textRun!.content)
        .join('');
      if (text.trim()) texts.push(text.trim());
    }
  }

  return texts.join('\n');
}

function extractSpeakerNotes(slide: slides_v1.Schema$Page): string {
  const notesPage = slide.slideProperties?.notesPage;
  if (!notesPage) return '';

  const notesId = notesPage.notesProperties?.speakerNotesObjectId;
  if (!notesId) return '';

  const notesShape = notesPage.pageElements?.find(el => el.objectId === notesId);
  if (!notesShape?.shape?.text?.textElements) return '';

  return notesShape.shape.text.textElements
    .filter(el => el.textRun?.content)
    .map(el => el.textRun!.content)
    .join('')
    .trim();
}
```
