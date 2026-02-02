'use client';

// =============================================================================
// FeedbackReviewOverlay - Full-screen review of all feedback before submitting
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import type { CanvasRubric, RubricScore } from '@/types';

interface FeedbackReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedFeedback: string) => Promise<void>;
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

  // Ref for auto-resizing summary textarea
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize summary textarea to fit content
  useEffect(() => {
    if (summaryRef.current) {
      summaryRef.current.style.height = 'auto';
      summaryRef.current.style.height = summaryRef.current.scrollHeight + 'px';
    }
  }, [localFeedback]);

  // Reset local state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setLocalScores({ ...rubricScores });
      setLocalFeedback(summaryFeedback);
      setError(null);
    }
  }, [isOpen, rubricScores, summaryFeedback]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      // Pass edited feedback directly to avoid stale state race condition
      await onSave(localFeedback);
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

      {/* Modal - Full screen with small margin */}
      <div className="relative w-full h-full m-4 bg-background border border-surface rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header - compact with score inline */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="font-display text-lg text-accent-gold">REVIEW FEEDBACK</h2>
              <p className="text-xs text-text-muted">{studentName}</p>
            </div>
            <div className="px-4 py-1 rounded-lg bg-surface/50">
              <span className="text-xs text-text-muted font-display">TOTAL: </span>
              <span className="text-lg font-display text-accent-gold">
                {calculatedTotal}/{totalPoints}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface transition-colors text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Content - fill available space */}
        <div className="flex-1 min-h-0 px-4 py-3 flex flex-col gap-3">
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-accent-danger/20 border border-accent-danger text-accent-danger text-sm">
              {error}
            </div>
          )}

          {/* Summary Feedback - auto-expands to fit content */}
          <div className="shrink-0">
            <h3 className="font-display text-xs text-text-muted mb-1">SUMMARY FEEDBACK</h3>
            <textarea
              ref={summaryRef}
              value={localFeedback}
              onChange={(e) => setLocalFeedback(e.target.value)}
              className="w-full p-3 rounded-lg bg-surface/50 border border-surface text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none overflow-hidden"
              placeholder="Enter feedback for the student..."
              rows={1}
            />
          </div>

          {/* Rubric Criteria Cards - fill remaining space */}
          {rubric && rubric.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="font-display text-xs text-text-muted mb-2 shrink-0">RUBRIC CRITERIA</h3>
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
                {rubric.map((criterion) => {
                  const score = localScores[criterion.id];

                  return (
                    <div
                      key={criterion.id}
                      className="p-3 rounded-lg bg-surface/50 border border-surface flex flex-col min-h-[150px]"
                    >
                      {/* Criterion Header - compact */}
                      <div className="flex items-start justify-between mb-2 shrink-0">
                        <h4 className="font-display text-xs text-text-primary flex-1 pr-2">
                          {criterion.description}
                        </h4>
                        <span className="font-display text-sm text-accent-primary shrink-0">
                          {score?.points ?? 0}/{criterion.points}
                        </span>
                      </div>

                      {/* Rating Selection - inline */}
                      <div className="flex flex-wrap gap-1 mb-2 shrink-0">
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
                              title={rating.long_description || rating.description}
                              className={`px-2 py-0.5 rounded text-xs font-display transition-all ${
                                isSelected
                                  ? 'bg-accent-primary text-background'
                                  : 'bg-background hover:bg-surface text-text-primary'
                              }`}
                            >
                              {rating.points}
                            </button>
                          );
                        })}
                      </div>

                      {/* Per-criterion Comment - auto-expands to fit content */}
                      <AutoExpandTextarea
                        value={score?.comments || ''}
                        onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                        placeholder="Feedback..."
                        className="w-full p-2 rounded text-sm bg-background/50 border border-surface text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none flex-1 min-h-[60px]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer - compact */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-surface bg-surface/20">
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

// Auto-expanding textarea component
function AutoExpandTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.max(60, ref.current.scrollHeight) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  );
}
