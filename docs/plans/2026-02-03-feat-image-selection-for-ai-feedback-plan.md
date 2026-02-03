---
title: "feat: Add Image Selection for AI Feedback"
type: feat
date: 2026-02-03
---

# feat: Add Image Selection for AI Feedback

## Overview

Add toggleable checkbox overlays to images in the student submission preview, allowing teachers to selectively include/exclude images when generating AI feedback. This applies to Google Docs images, Google Slides thumbnails, and PDF page images.

## Problem Statement / Motivation

When reviewing student submissions containing images (from Google Docs, Slides, or PDFs), teachers may want to exclude certain images from AI analysis:
- **Irrelevant content:** Decorative images, logos, or formatting artifacts
- **Cost optimization:** Fewer images = faster/cheaper API calls
- **Focus:** Direct AI attention to the most relevant visual content
- **Privacy:** Exclude images that shouldn't be processed by external AI

Currently, ALL images are automatically sent to the AI, with no way to filter.

## Proposed Solution

Add a checkbox overlay in the top-left corner of each image that teachers can toggle:
- **Default state:** All images selected (checked)
- **Visual feedback:** Deselected images appear dimmed (50% opacity)
- **Bulk controls:** "Select All" / "Deselect All" buttons
- **No persistence:** Selection resets when navigating between students
- **Graceful empty:** If all images deselected, AI proceeds with text-only analysis

## Technical Approach

### Architecture

**State Management:**
Selection state will be managed in `BattleScreen.tsx` using Sets of image identifiers:

```typescript
// BattleScreen.tsx - new state
const [selectedPdfPageIndices, setSelectedPdfPageIndices] = useState<Set<number>>(new Set());
const [selectedGoogleDocImageIds, setSelectedGoogleDocImageIds] = useState<Set<string>>(new Set());
const [selectedGoogleSlideIds, setSelectedGoogleSlideIds] = useState<Set<string>>(new Set());
```

**Data Flow:**
```
Images loaded → Initialize all as selected → User toggles checkboxes
    → State updated in BattleScreen → Only selected images passed to API
```

### Component Changes

#### 1. New Shared Component: `ImageSelectionCheckbox.tsx`

```typescript
// src/components/ImageSelectionCheckbox.tsx
interface ImageSelectionCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ImageSelectionCheckbox({ checked, onChange, className }: ImageSelectionCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "absolute top-2 left-2 z-20 w-6 h-6 rounded border-2 flex items-center justify-center",
        "bg-white/80 backdrop-blur-sm transition-all",
        checked
          ? "border-accent-primary bg-accent-primary text-white"
          : "border-gray-400 bg-white/80",
        className
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <span className="text-sm">✓</span>}
    </button>
  );
}
```

#### 2. New Bulk Controls Component: `ImageSelectionControls.tsx`

```typescript
// src/components/ImageSelectionControls.tsx
interface ImageSelectionControlsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ImageSelectionControls({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll
}: ImageSelectionControlsProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-text-secondary">
      <span>{selectedCount} of {totalCount} images selected for AI</span>
      <button
        onClick={onSelectAll}
        className="text-accent-primary hover:underline"
        disabled={selectedCount === totalCount}
      >
        Select All
      </button>
      <span>|</span>
      <button
        onClick={onDeselectAll}
        className="text-accent-primary hover:underline"
        disabled={selectedCount === 0}
      >
        Deselect All
      </button>
    </div>
  );
}
```

#### 3. Modify `SubmissionViewer.tsx`

**Google Docs Images (lines 1254-1264):**
- Wrap each image in a relative container
- Add `ImageSelectionCheckbox` overlay
- Apply `opacity-50` class when deselected
- Add `ImageSelectionControls` above image gallery

**Google Slides Thumbnails (lines 1589-1608):**
- Add checkbox to each thumbnail
- Apply dimming to deselected slides
- Add controls above thumbnail strip

**Props additions:**
```typescript
interface SubmissionViewerProps {
  // ... existing props
  selectedGoogleDocImageIds?: Set<string>;
  onGoogleDocImageSelectionChange?: (id: string, selected: boolean) => void;
  onSelectAllGoogleDocImages?: () => void;
  onDeselectAllGoogleDocImages?: () => void;
  selectedGoogleSlideIds?: Set<string>;
  onGoogleSlideSelectionChange?: (id: string, selected: boolean) => void;
  onSelectAllGoogleSlides?: () => void;
  onDeselectAllGoogleSlides?: () => void;
}
```

#### 4. Modify `PDFViewer.tsx`

- Add checkbox overlay to each rendered PDF page
- Accept selection state and callbacks as props
- Apply dimming to deselected pages

**Props additions:**
```typescript
interface PDFViewerProps {
  // ... existing props
  selectedPageIndices?: Set<number>;
  onPageSelectionChange?: (pageIndex: number, selected: boolean) => void;
}
```

#### 5. Modify `BattleScreen.tsx`

**State initialization (when images load):**
```typescript
// When Google Doc images load
const handleGoogleDocImagesLoaded = useCallback((images: GoogleDocImage[]) => {
  setGoogleDocImages(images);
  // Initialize all as selected
  setSelectedGoogleDocImageIds(new Set(images.map(img => img.objectId)));
}, []);
```

**API call modification (line ~466):**
```typescript
// Filter to only selected images before sending
const selectedDocImages = googleDocImages.filter(img =>
  selectedGoogleDocImageIds.has(img.objectId)
);
const selectedSlideImages = googleSlideImages.filter(slide =>
  selectedGoogleSlideIds.has(slide.slideId)
);
const selectedPdfImages = pdfImages.filter((_, idx) =>
  selectedPdfPageIndices.has(idx)
);

// Send filtered arrays to API
body: JSON.stringify({
  // ...
  pdfImages: selectedPdfImages,
  googleDocImages: selectedDocImages,
  googleSlideImages: selectedSlideImages,
})
```

**Reset on student change:**
```typescript
// In handleSelectStudent or useEffect watching current student
setSelectedPdfPageIndices(new Set());
setSelectedGoogleDocImageIds(new Set());
setSelectedGoogleSlideIds(new Set());
```

### Visual Design

**Checkbox appearance:**
- Size: 24x24px
- Position: 8px from top-left corner
- Background: Semi-transparent white with blur for visibility on any image
- Checked: Blue fill (`accent-primary`) with white checkmark
- Unchecked: White with gray border

**Deselected image treatment:**
- Apply `opacity-50` class
- Transition smoothly on toggle

**Selection indicator:**
- Text above images: "X of Y images selected for AI"
- Include Select All / Deselect All links

## Acceptance Criteria

### Functional Requirements

- [ ] Checkbox appears in top-left corner of each Google Doc image
- [ ] Checkbox appears in top-left corner of each Google Slides thumbnail
- [ ] Checkbox appears in top-left corner of each PDF page image
- [ ] All images default to selected when first loaded
- [ ] Clicking checkbox toggles selection state
- [ ] Deselected images display at 50% opacity
- [ ] "Select All" button selects all images of that type
- [ ] "Deselect All" button deselects all images of that type
- [ ] Selection count indicator shows "X of Y images selected"
- [ ] Only selected images are sent in API request to `/api/agent`
- [ ] Selection resets when navigating to a different student
- [ ] If all images deselected, AI feedback still generates (text-only)

### Non-Functional Requirements

- [ ] Checkbox click doesn't trigger image expand/zoom if applicable
- [ ] Checkbox has sufficient contrast for visibility on any image
- [ ] Touch targets are at least 44x44px effective area
- [ ] State updates are immediate with no perceptible lag

### Accessibility

- [ ] Checkboxes have `role="checkbox"` and `aria-checked`
- [ ] Checkboxes are keyboard accessible (Tab + Space/Enter)
- [ ] Screen reader announces selection state changes

## Implementation Phases

### Phase 1: Core Infrastructure

**Tasks:**
- [x] Create `ImageSelectionCheckbox.tsx` component
- [x] Create `ImageSelectionControls.tsx` component
- [x] Add selection state to `BattleScreen.tsx`
- [x] Wire up state initialization when images load
- [x] Wire up state reset on student change

**Files:**
- `src/components/ImageSelectionCheckbox.tsx` (new)
- `src/components/ImageSelectionControls.tsx` (new)
- `src/components/BattleScreen.tsx` (modify)

### Phase 2: Google Docs Integration

**Tasks:**
- [x] Add checkbox overlay to Google Doc images in `SubmissionViewer.tsx`
- [x] Add bulk controls above image gallery
- [x] Apply dimming styles to deselected images
- [x] Update "AI can see X images" text to reflect selection
- [x] Pass selection callbacks through component hierarchy

**Files:**
- `src/components/SubmissionViewer.tsx` (modify lines 1051-1285)

### Phase 3: Google Slides Integration

**Tasks:**
- [x] Add checkbox overlay to slide thumbnails
- [x] Add bulk controls above thumbnail strip
- [x] Apply dimming to deselected slides
- [x] Ensure main slide view reflects selection state visually

**Files:**
- `src/components/SubmissionViewer.tsx` (modify lines 1328-1630)

### Phase 4: PDF Integration

**Tasks:**
- [x] Add selection props to `PDFViewer` component
- [x] Add checkbox overlay to rendered PDF pages
- [x] Apply dimming to deselected pages
- [x] Add bulk controls for PDF pages

**Files:**
- `src/components/PDFViewer.tsx` (modify)
- `src/components/SubmissionViewer.tsx` (modify PDF display sections)

### Phase 5: API Integration & Polish

**Tasks:**
- [x] Filter images by selection before API call in `BattleScreen.tsx`
- [x] Ensure fullscreen/overlay mode syncs with selection state
- [ ] Test with various submission types

**Files:**
- `src/components/BattleScreen.tsx` (modify ~line 466)
- `src/components/SubmissionViewerOverlay.tsx` (verify state sync)

## Dependencies & Prerequisites

- None - this is a self-contained frontend feature
- No API changes required - just filtering client-side before sending

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Checkbox click triggers unintended actions (zoom, etc.) | Medium | Low | Use `e.stopPropagation()` on click handler |
| State sync issues between inline and fullscreen views | Medium | Medium | Lift state to BattleScreen, pass as props to both |
| Performance with many images | Low | Low | Images already rendered; adding checkboxes is minimal overhead |
| Checkbox not visible on certain images | Low | Medium | Semi-transparent background with blur ensures contrast |

## Success Metrics

- Teachers can selectively exclude irrelevant images from AI analysis
- No increase in time to generate feedback (faster if fewer images selected)
- Feature is discoverable without documentation

## References

### Internal References

- Submission viewer component: `src/components/SubmissionViewer.tsx`
- Google Docs image handling: `src/lib/google.ts:238-276`
- Google Slides handling: `src/lib/google.ts:414-520`
- PDF rendering: `src/components/PDFViewer.tsx`
- AI feedback API: `src/app/api/agent/route.ts:132-395`
- Main grading screen: `src/components/BattleScreen.tsx`

### Type Definitions

- `GoogleDocImage`: `src/types/index.ts:470-484`
- `GoogleSlideImage`: `src/types/index.ts:485-494`
- `PDFImageForAI`: `src/app/api/agent/route.ts:23-30`
