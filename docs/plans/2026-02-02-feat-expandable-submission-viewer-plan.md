---
title: "feat: Add Expandable Fullscreen Mode for Submission Viewer"
type: feat
date: 2026-02-02
---

# Add Expandable Fullscreen Mode for Submission Viewer

## Overview

Add a fullscreen overlay mode to the SubmissionViewer component, allowing teachers to expand student submissions (documents, PDFs, slides, etc.) to view the full content in a larger view. This follows the same pattern as the existing FeedbackReviewOverlay.

## Problem Statement / Motivation

Currently, the submission viewer panel has a fixed size within the grading interface. When students submit lengthy documents, multi-page PDFs, or detailed slides, teachers can't easily read all the content without scrolling in a small window. Teachers need to be able to expand the view to read submissions more comfortably.

## Proposed Solution

Add an "expand" button to the SubmissionViewer header that opens a fullscreen overlay showing just the submission content. The overlay follows the existing FeedbackReviewOverlay pattern with:
- Fullscreen modal with semi-transparent backdrop
- Close button (X) and Escape key to exit
- Same content rendering as the inline view

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  [X]                    STUDENT SUBMISSION                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                   [Full submission content]                  │
│                   (PDF / Document / Text)                    │
│                                                              │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Implementation

**Option A: Separate Overlay Component (Recommended)**

Create a new `SubmissionViewerOverlay` component that wraps the existing content rendering logic:

```typescript
// src/components/SubmissionViewerOverlay.tsx

interface SubmissionViewerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  submission: CanvasSubmission | null;
  batchAttachment?: BatchAttachment | null;
}

export function SubmissionViewerOverlay({
  isOpen,
  onClose,
  submission,
  batchAttachment,
}: SubmissionViewerOverlayProps) {
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full h-full m-4 bg-background border border-surface rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface">
          <span className="font-display text-sm text-text-primary">
            STUDENT SUBMISSION
          </span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <span className="text-text-muted">✕</span>
          </button>
        </div>

        {/* Content - reuse existing rendering */}
        <div className="flex-1 overflow-auto p-4">
          <ContentDisplay ... />
        </div>
      </div>
    </div>
  );
}
```

**Option B: Inline State in SubmissionViewer**

Add `isExpanded` state to SubmissionViewer and conditionally render fullscreen:

```typescript
// In SubmissionViewer.tsx
const [isExpanded, setIsExpanded] = useState(false);

// Add expand button to header
<button
  onClick={() => setIsExpanded(true)}
  className="p-1.5 hover:bg-surface rounded transition-colors"
  title="Expand to fullscreen"
>
  <span className="text-text-muted">⤢</span>
</button>

// Render overlay when expanded
{isExpanded && (
  <SubmissionViewerOverlay
    isOpen={isExpanded}
    onClose={() => setIsExpanded(false)}
    submission={submission}
    batchAttachment={batchAttachment}
  />
)}
```

### Files to Create/Modify

1. **Create:** `src/components/SubmissionViewerOverlay.tsx` - New fullscreen overlay component
2. **Modify:** `src/components/SubmissionViewer.tsx` - Add expand button and overlay trigger

### Content Rendering Reuse

Extract the `ContentDisplay` component logic to be reusable between inline and fullscreen views. The existing `ContentDisplay` function (lines 320-476) handles:
- Text submissions
- URL submissions (including Google Docs)
- File attachments (images, PDFs, notebooks, scripts, documents)

This can be reused directly in the overlay.

## Acceptance Criteria

- [x] Expand button visible in SubmissionViewer header
- [x] Clicking expand opens fullscreen overlay
- [x] Overlay shows submission content at full size
- [x] Close button (X) closes the overlay
- [x] Escape key closes the overlay
- [x] Clicking backdrop closes the overlay
- [x] All content types render correctly in fullscreen (PDF, text, Google Docs, images)
- [x] Animation matches existing overlay pattern (`animate-fade-up`)

## References

### Internal References
- FeedbackReviewOverlay pattern: `src/components/FeedbackReviewOverlay.tsx`
- BatchUploadModal pattern: `src/components/BatchUploadModal.tsx`
- Current SubmissionViewer: `src/components/SubmissionViewer.tsx`
- Animation definitions: `src/app/globals.css`

### Design Tokens
- Backdrop: `bg-black/70 backdrop-blur-sm`
- Modal: `bg-background border border-surface rounded-xl shadow-2xl`
- Header font: `font-display text-sm text-text-primary`
- Animation: `animate-fade-up`
