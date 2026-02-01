---
title: "feat: Add Feedback Review Overlay"
type: feat
date: 2026-02-01
---

# feat: Add Feedback Review Overlay

## Overview

Add a "Review Feedback" button that opens a full-screen overlay showing all feedback and rubric grades before submitting to Canvas. This gives teachers a consolidated view of everything they're submitting, with the ability to make final edits.

## Problem Statement

Currently, grading information is spread across multiple panels (rubric scorer, feedback composer, competency scorer). Teachers want to see everything in one consolidated view before submitting to Canvas to catch any mistakes.

## Proposed Solution

Create a `FeedbackReviewOverlay` component that:
1. Opens via a "Review Feedback" button (left of Save to Canvas)
2. Shows summary feedback and rubric grades as expanded cards
3. Allows editing all fields
4. Has its own "Save to Canvas" button
5. Auto-advances to next student after successful save

## Technical Approach

### Component Architecture

```
BattleScreen.tsx
├── [existing components]
├── FeedbackReviewOverlay.tsx (NEW)
│   ├── Header (title, close button)
│   ├── Content (scrollable)
│   │   ├── Summary Feedback Section
│   │   │   └── Editable textarea
│   │   ├── Total Score Display
│   │   └── Rubric Section (if rubric exists)
│   │       └── Criterion Cards (expanded, editable)
│   └── Footer (Cancel, Save to Canvas buttons)
```

### State Management

The overlay receives **copies** of state from BattleScreen, not references:
- On open: Clone `rubricScores`, `currentFeedback` into local state
- On cancel: Discard local state (changes lost)
- On save: Post to Canvas, then call `onSave` callback with updated values

```tsx
interface FeedbackReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedScores: Record<string, RubricScore>, updatedFeedback: string) => Promise<void>;

  // Initial values (cloned on open)
  rubricScores: Record<string, RubricScore>;
  summaryFeedback: string;
  rubric?: CanvasRubric[];

  // Display info
  studentName: string;
  totalPoints: number;

  // Loading state
  isSaving: boolean;
}
```

### Key Files to Modify

| File | Change |
|------|--------|
| `src/components/FeedbackReviewOverlay.tsx` | **NEW** - Full overlay component |
| `src/components/BattleScreen.tsx` | Add Review button, overlay state, wire up props |
| `src/components/CompetencyScorer.tsx` | Add "Review Feedback" button next to Save |

## Acceptance Criteria

- [x] "Review Feedback" button appears left of "Save to Canvas" button
- [x] Button is disabled until all rubric criteria are scored (or no rubric exists)
- [x] Clicking button opens full-screen overlay
- [x] Overlay shows summary feedback in editable textarea
- [x] Overlay shows total score prominently
- [x] Overlay shows rubric criteria as expanded cards (if rubric exists)
- [x] Each criterion card shows: description, selected rating, points, per-criterion comment (editable)
- [x] User can change rubric scores within overlay
- [x] User can edit per-criterion comments within overlay
- [x] "Cancel" button closes overlay and discards all edits
- [x] "Save to Canvas" button posts grade + rubric + feedback to Canvas
- [x] On successful save: overlay closes, auto-advances to next ungraded student
- [x] On save failure: show error message, keep overlay open, preserve data
- [x] When no rubric exists: show only summary feedback and total score

## MVP Implementation

### FeedbackReviewOverlay.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { CanvasRubric, RubricScore } from '@/types';

interface FeedbackReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  rubricScores: Record<string, RubricScore>;
  onRubricScoresChange: (scores: Record<string, RubricScore>) => void;
  summaryFeedback: string;
  onSummaryFeedbackChange: (text: string) => void;
  rubric?: CanvasRubric[];
  studentName: string;
  totalPoints: number;
  isSaving: boolean;
}

export function FeedbackReviewOverlay({
  isOpen,
  onClose,
  onSave,
  rubricScores,
  onRubricScoresChange,
  summaryFeedback,
  onSummaryFeedbackChange,
  rubric,
  studentName,
  totalPoints,
  isSaving,
}: FeedbackReviewOverlayProps) {
  // Clone state on open for cancel-discard behavior
  const [localScores, setLocalScores] = useState<Record<string, RubricScore>>({});
  const [localFeedback, setLocalFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset local state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setLocalScores({ ...rubricScores });
      setLocalFeedback(summaryFeedback);
      setError(null);
    }
  }, [isOpen, rubricScores, summaryFeedback]);

  if (!isOpen) return null;

  const calculatedTotal = Object.values(localScores).reduce(
    (sum, score) => sum + score.points,
    0
  );

  const handleSave = async () => {
    try {
      setError(null);
      // Update parent state with local changes
      onRubricScoresChange(localScores);
      onSummaryFeedbackChange(localFeedback);
      // Then trigger save
      await onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to Canvas');
    }
  };

  const handleScoreChange = (criterionId: string, score: RubricScore) => {
    setLocalScores(prev => ({ ...prev, [criterionId]: score }));
  };

  const handleCommentChange = (criterionId: string, comments: string) => {
    setLocalScores(prev => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], comments },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-surface rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface">
          <div>
            <h2 className="font-display text-xl text-accent-gold">REVIEW FEEDBACK</h2>
            <p className="text-sm text-text-muted">{studentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-lg bg-accent-danger/20 border border-accent-danger text-accent-danger">
              {error}
            </div>
          )}

          {/* Total Score */}
          <div className="text-center p-4 rounded-lg bg-surface/50">
            <p className="text-sm text-text-muted font-display">TOTAL SCORE</p>
            <p className="text-3xl font-display text-accent-gold">
              {calculatedTotal} / {totalPoints}
            </p>
          </div>

          {/* Summary Feedback */}
          <div>
            <h3 className="font-display text-sm text-text-muted mb-2">SUMMARY FEEDBACK</h3>
            <textarea
              value={localFeedback}
              onChange={(e) => setLocalFeedback(e.target.value)}
              className="w-full p-4 rounded-lg bg-surface/50 border border-surface text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
              rows={4}
              placeholder="Enter feedback for the student..."
            />
          </div>

          {/* Rubric Criteria Cards */}
          {rubric && rubric.length > 0 && (
            <div>
              <h3 className="font-display text-sm text-text-muted mb-4">RUBRIC CRITERIA</h3>
              <div className="space-y-4">
                {rubric.map((criterion) => {
                  const score = localScores[criterion.id];
                  const selectedRating = criterion.ratings.find(
                    r => r.id === score?.ratingId
                  );

                  return (
                    <div
                      key={criterion.id}
                      className="p-4 rounded-lg bg-surface/50 border border-surface"
                    >
                      {/* Criterion Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-display text-sm text-text-primary">
                            {criterion.description}
                          </h4>
                          {criterion.long_description && (
                            <p className="text-xs text-text-muted mt-1">
                              {criterion.long_description}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <span className="font-display text-accent-primary">
                            {score?.points ?? 0} / {criterion.points}
                          </span>
                        </div>
                      </div>

                      {/* Rating Selection */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {criterion.ratings.map((rating) => {
                          const isSelected = score?.ratingId === rating.id;
                          return (
                            <button
                              key={rating.id}
                              onClick={() => handleScoreChange(criterion.id, {
                                criterionId: criterion.id,
                                ratingId: rating.id,
                                points: rating.points,
                                comments: score?.comments || '',
                              })}
                              className={`px-3 py-1.5 rounded text-xs font-display transition-all ${
                                isSelected
                                  ? 'bg-accent-primary text-background'
                                  : 'bg-background hover:bg-surface text-text-primary'
                              }`}
                            >
                              {rating.points} - {rating.description}
                            </button>
                          );
                        })}
                      </div>

                      {/* Per-criterion Comment */}
                      <textarea
                        value={score?.comments || ''}
                        onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                        placeholder="Add feedback for this criterion..."
                        className="w-full p-2 rounded text-sm bg-background/50 border border-surface text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
                        rows={2}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-surface bg-surface/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-surface transition-colors font-display"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-lg font-display text-sm transition-all flex items-center gap-2 ${
              isSaving
                ? 'bg-surface text-text-muted cursor-not-allowed'
                : 'bg-gradient-to-r from-accent-gold to-accent-danger text-background hover:opacity-90'
            }`}
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>SAVING...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>SAVE TO CANVAS</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### BattleScreen.tsx Changes

```tsx
// Add state for overlay
const [isReviewOpen, setIsReviewOpen] = useState(false);

// Add handler to open review
const handleOpenReview = useCallback(() => {
  setIsReviewOpen(true);
}, []);

// Modify handlePostToCanvas to accept optional callback
const handlePostToCanvas = useCallback(async () => {
  // ... existing implementation ...

  // On success, close overlay if open
  setIsReviewOpen(false);

  // ... rest of success handling (auto-advance) ...
}, [/* deps */]);

// In render, pass to CompetencyScorer:
<CompetencyScorer
  // ... existing props ...
  onOpenReview={handleOpenReview}
  canReview={canSubmit} // reuse existing validation
/>

// Add overlay component:
<FeedbackReviewOverlay
  isOpen={isReviewOpen}
  onClose={() => setIsReviewOpen(false)}
  onSave={handlePostToCanvas}
  rubricScores={rubricScores}
  onRubricScoresChange={setRubricScores}
  summaryFeedback={currentFeedback.text}
  onSummaryFeedbackChange={(text) => setCurrentFeedback(prev => ({ ...prev, text }))}
  rubric={rubric}
  studentName={currentSubmission?.user?.name || 'Student'}
  totalPoints={assignment.points_possible || 100}
  isSaving={isPosting}
/>
```

### CompetencyScorer.tsx Changes

```tsx
// Add to props interface
interface CompetencyScorerProps {
  // ... existing props ...
  onOpenReview?: () => void;
  canReview?: boolean;
}

// Add Review button before Save to Canvas button
{onOpenReview && (
  <button
    onClick={onOpenReview}
    disabled={!canReview}
    className={`px-4 py-2.5 rounded-lg font-display text-sm transition-all flex items-center gap-2 ${
      canReview
        ? 'bg-surface hover:bg-surface/80 text-text-primary'
        : 'bg-surface/50 text-text-muted cursor-not-allowed'
    }`}
  >
    <span>👁️</span>
    <span>REVIEW</span>
  </button>
)}
```

## References

### Internal References
- Modal pattern: `src/components/BatchUploadModal.tsx`
- Rubric scoring: `src/components/CompetencyScorer.tsx`
- Save flow: `src/components/BattleScreen.tsx:425-535`
- Types: `src/types/index.ts` (RubricScore, CanvasRubric)

### Design Tokens
- Background: `bg-background` (#0D1117)
- Surface: `bg-surface`, `bg-surface/50` (#1A1A2E)
- Accent gold: `text-accent-gold` (#FFD93D)
- Font display: `font-display` (Press Start 2P)
