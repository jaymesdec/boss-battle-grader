'use client';

// =============================================================================
// FeedbackComposer - Text feedback with AI assistance
// =============================================================================

import { useState } from 'react';
import type { FeedbackInput, CompetencyId, Grade } from '@/types';

interface FeedbackComposerProps {
  studentName: string;
  submissionContent?: string;
  currentGrades: Partial<Record<CompetencyId, Grade>>;
  currentFeedback: FeedbackInput;
  onFeedbackChange: (feedback: FeedbackInput) => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
  // Engagement tracking for scroll-to-unlock
  engagementMet?: boolean;
  scrollPercent?: number;
}

export function FeedbackComposer({
  studentName,
  currentGrades,
  currentFeedback,
  onFeedbackChange,
  onGenerateAI,
  isGenerating = false,
  engagementMet = true, // Default to true for backward compatibility
  scrollPercent = 100,
}: FeedbackComposerProps) {
  // Fully controlled component - use parent's state directly
  const textFeedback = currentFeedback.text;

  const handleTextChange = (newText: string) => {
    onFeedbackChange({
      text: newText,
      voiceDurationSeconds: 0,
    });
  };

  // Count graded competencies
  const gradedCount = Object.keys(currentGrades).length;
  const hasContent = textFeedback.trim().length > 0;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm text-text-muted">
          FEEDBACK FOR {studentName.toUpperCase()}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {gradedCount}/9 competencies
          </span>
          {hasContent && (
            <span className="text-xs text-accent-primary">✓ Has feedback</span>
          )}
        </div>
      </div>

      {/* Text Input */}
      <div className="flex-1 mb-3">
        <textarea
          value={textFeedback}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Type your feedback here..."
          className="w-full h-full p-3 bg-surface/50 border border-surface rounded-lg
                     text-text-primary placeholder-text-muted text-sm resize-none
                     focus:outline-none focus:border-accent-primary transition-colors"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onGenerateAI && (
          engagementMet ? (
            // Engagement met - show enabled AI button
            <button
              onClick={onGenerateAI}
              disabled={isGenerating}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                font-display text-sm transition-all
                ${isGenerating
                  ? 'bg-surface text-text-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-accent-secondary to-accent-primary text-background hover:opacity-90'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⚡</span>
                  <span>GENERATING...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>SYNTHESIZE FEEDBACK</span>
                </>
              )}
            </button>
          ) : (
            // Engagement not met - show locked state with progress
            <div className="flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-surface/50 border border-surface">
              <div className="relative">
                {/* Progress ring */}
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-surface"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${scrollPercent * 0.94} 100`}
                    strokeLinecap="round"
                    className="text-accent-primary transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs">🔒</span>
              </div>
              <div className="text-left">
                <p className="text-xs font-display text-text-muted">READ TO UNLOCK</p>
                <p className="text-xs text-text-muted/60">Scroll through the submission</p>
              </div>
            </div>
          )
        )}

        <FeedbackTemplates onSelect={(template) => handleTextChange(template)} />
      </div>
    </div>
  );
}

// =============================================================================
// Feedback Templates
// =============================================================================

const TEMPLATES = [
  {
    name: 'Great Work',
    text: 'Excellent work on this assignment! Your understanding of the core concepts is clear, and your execution demonstrates strong technical skills.',
  },
  {
    name: 'Needs Improvement',
    text: 'This submission shows promise, but there are areas that need more attention. Consider revisiting the key concepts and strengthening your approach.',
  },
  {
    name: 'Missing Elements',
    text: 'Your submission is missing some required elements. Please review the assignment requirements and ensure all components are addressed.',
  },
  {
    name: 'Strong Concept',
    text: 'Your conceptual approach is strong, showing good understanding of the design principles. Focus on refining the execution to match your vision.',
  },
];

function FeedbackTemplates({ onSelect }: { onSelect: (template: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-surface rounded-lg text-text-muted
                   hover:bg-surface/80 transition-colors text-sm"
      >
        📋 Templates
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-background
                          border border-surface rounded-lg shadow-xl z-50">
            <div className="p-2">
              <p className="text-xs text-text-muted px-2 py-1 mb-1">
                QUICK TEMPLATES
              </p>
              {TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  onClick={() => {
                    onSelect(template.text);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text-primary
                             hover:bg-surface rounded transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

