---
title: Batch Upload PDFs Ignored in AI Feedback Generation
category: logic-errors
tags: [batch-upload, pdf, ai-feedback, state-management, image-selection, react-hooks]
module: BattleScreen.tsx
symptoms:
  - AI feedback generated generic/hallucinated responses unrelated to PDF content
  - Claude received zero images despite PDFs being visible in viewer
  - Batch upload path produced incorrect results while Canvas PDFs worked correctly
root_cause: selectedPdfPageIndices state was not initialized when loading batch attachments, resulting in empty image set sent to AI
severity: high
date_solved: 2026-02-03
---

# Batch Upload PDFs Ignored in AI Feedback Generation

## Symptom

When teachers used the batch upload feature to attach PDF images to student submissions, the AI feedback generation produced generic or hallucinated responses (e.g., "computing history") instead of analyzing the actual PDF content (e.g., "small business administration"). The uploaded images were visible in the viewer but were not being sent to Claude AI.

## Investigation

1. User reported AI feedback didn't match PDF content
2. Confirmed all 7 slides were visible in the PDFViewer before generating feedback
3. Confirmed batch upload was used (not Canvas attachment)
4. Traced code flow from batch upload to AI feedback generation
5. Found that `selectedPdfPageIndices` was empty when filtering images for AI

## Root Cause

The batch upload code path in `BattleScreen.tsx` was missing initialization of `selectedPdfPageIndices`.

When switching students (line 233), the selection state is reset:
```typescript
setSelectedPdfPageIndices(new Set());
```

For Canvas PDFs, the `handlePDFPagesLoaded` callback properly re-initializes the selection:
```typescript
const handlePDFPagesLoaded = useCallback((pages: PDFPage[], aiImages: PDFImageForAI[]) => {
  setPdfImages(aiImages);
  setSelectedPdfPageIndices(new Set(pages.map((_, idx) => idx)));  // INITIALIZES
}, []);
```

But the batch upload path only set `pdfImages` without initializing `selectedPdfPageIndices`:
```typescript
if (batchAttachment) {
  const aiImages = ...;
  setPdfImages(aiImages);
  setParsedContent(`[Batch upload: ...]`);
  // MISSING: setSelectedPdfPageIndices initialization!
}
```

As a result, when filtering images for AI feedback:
```typescript
const selectedPdfImagesForAI = pdfImages.filter((_, idx) => selectedPdfPageIndices.has(idx));
```
This returned an **empty array** - zero images were sent to Claude.

## Solution

Added `setSelectedPdfPageIndices(new Set(...))` in two locations in `BattleScreen.tsx`:

### Fix 1: Student Selection Callback (line 295)

```typescript
// BEFORE
setPdfImages(aiImages);
setParsedContent(`[Batch upload: ${batchAttachment.filename}...]`);

// AFTER
setPdfImages(aiImages);
setSelectedPdfPageIndices(new Set(batchAttachment.pdfImages.map((_, idx) => idx)));
setParsedContent(`[Batch upload: ${batchAttachment.filename}...]`);
```

### Fix 2: handleBatchAttachments Callback (line 342)

```typescript
// BEFORE
setPdfImages(aiImages);
setParsedContent(`[Batch upload: ${attachment.filename}...]`);

// AFTER
setPdfImages(aiImages);
setSelectedPdfPageIndices(new Set(attachment.pdfImages.map((_, idx) => idx)));
setParsedContent(`[Batch upload: ${attachment.filename}...]`);
```

## Why This Works

The fix ensures that whenever batch-uploaded PDF images are loaded into state, all pages are automatically marked as selected for AI analysis. This matches the existing pattern used for:
- Regular PDF submissions (line 302)
- Google Doc images (line 312)
- Google Slides (line 319)

## Verification

1. Upload PDFs via batch upload
2. Select a student with a matched PDF
3. Verify the slide thumbnails show checkboxes as selected (all checked by default)
4. Generate feedback
5. Verify the feedback references actual content from the PDF

## Prevention Strategies

### Code Review Checklist

- [ ] When adding a new data source that populates a collection state, verify corresponding selection state is ALSO initialized
- [ ] Use paired state pattern: document which states must be updated together
- [ ] When copying existing code paths, search for ALL state assignments in the original

### Recommended Pattern: State Factory Functions

Create helper functions that initialize related states together:

```typescript
const initializePdfState = (pages: PDFPage[]) => {
  const aiImages = getPDFImagesForAI(pages);
  return {
    images: aiImages,
    selectedIndices: new Set(pages.map((_, idx) => idx)), // Always paired
  };
};
```

### Key Testing Scenarios

1. Batch upload → verify `selectedPdfPageIndices.size === pdfImages.length`
2. Student switching with batch uploads → verify states reset/initialize correctly
3. Canvas PDF loading → verify same invariant holds
4. Generate feedback with batch upload → verify AI references actual PDF content

## Related Documentation

- `docs/plans/2026-02-03-feat-image-selection-for-ai-feedback-plan.md` - Image selection feature spec
- `docs/solutions/runtime-errors/pdfjs-v5-worker-loading-failure.md` - PDF processing issues
- `docs/solutions/react-patterns/react-hooks-order-violation.md` - React state patterns

## Files Modified

- `src/components/BattleScreen.tsx` (lines 295, 342)
