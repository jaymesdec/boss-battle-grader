'use client';

// =============================================================================
// CompetencyScorer - Grade selector for 9 TD Competencies
// =============================================================================

import { useState } from 'react';
import { COMPETENCY_ORDER, COMPETENCIES, RUBRIC_DESCRIPTORS } from '@/lib/competencies';
import type { CompetencyId, Grade } from '@/types';

const GRADES: Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];

interface CompetencyScorerProps {
  grades: Partial<Record<CompetencyId, Grade>>;
  onGradeChange: (competencyId: CompetencyId, grade: Grade | null) => void;
  onPostToCanvas: () => void;
  isPosting?: boolean;
  canPost?: boolean;
}

export function CompetencyScorer({
  grades,
  onGradeChange,
  onPostToCanvas,
  isPosting = false,
  canPost = false,
}: CompetencyScorerProps) {
  const [expandedId, setExpandedId] = useState<CompetencyId | null>(null);

  const gradedCount = Object.keys(grades).length;
  const allGraded = gradedCount === 9;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-surface">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm text-text-muted">COMPETENCIES</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{gradedCount}/9</span>
            {allGraded && <span className="text-accent-primary">✓</span>}
          </div>
        </div>
        <div className="w-full h-1 bg-surface rounded-full mt-2">
          <div
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all duration-300"
            style={{ width: `${(gradedCount / 9) * 100}%` }}
          />
        </div>
      </div>

      {/* Competency List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {COMPETENCY_ORDER.map((competencyId) => {
          const competency = COMPETENCIES[competencyId];
          const grade = grades[competencyId];
          const isExpanded = expandedId === competencyId;

          return (
            <div
              key={competencyId}
              className={`
                rounded-lg border transition-all
                ${grade
                  ? 'bg-surface/50 border-surface'
                  : 'bg-transparent border-surface/50'
                }
                ${isExpanded ? 'border-accent-primary' : ''}
              `}
            >
              {/* Competency Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : competencyId)}
                className="w-full flex items-center gap-2 p-2 text-left"
              >
                <span
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${competency.color}20` }}
                >
                  {competency.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {competency.name}
                  </p>
                </div>
                <GradeBadge grade={grade} />
                <span className="text-text-muted text-xs">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded Grade Selector */}
              {isExpanded && (
                <div className="px-2 pb-2">
                  {/* Grade Buttons */}
                  <div className="flex gap-1 mb-2">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          onGradeChange(competencyId, grade === g ? null : g);
                        }}
                        className={`
                          flex-1 py-2 rounded text-sm font-display transition-all
                          ${grade === g
                            ? 'bg-accent-primary text-background'
                            : 'bg-surface hover:bg-surface/80 text-text-primary'
                          }
                        `}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Rubric Preview */}
                  <div className="p-2 bg-background/50 rounded text-xs space-y-1">
                    <RubricPreview competencyId={competencyId} selectedGrade={grade} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Post to Canvas Button */}
      <div className="p-3 border-t border-surface">
        <button
          onClick={onPostToCanvas}
          disabled={isPosting || !canPost}
          className={`
            w-full py-3 rounded-lg font-display text-sm transition-all
            flex items-center justify-center gap-2
            ${isPosting || !canPost
              ? 'bg-surface text-text-muted cursor-not-allowed'
              : 'bg-gradient-to-r from-accent-gold to-accent-danger text-background hover:opacity-90'
            }
          `}
        >
          {isPosting ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>POSTING...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>POST TO CANVAS</span>
            </>
          )}
        </button>
        {!canPost && !isPosting && (
          <p className="text-xs text-text-muted text-center mt-2">
            Grade all 9 competencies to post
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Grade Badge
// =============================================================================

function GradeBadge({ grade }: { grade: Grade | undefined }) {
  if (!grade) {
    return (
      <span className="w-8 h-8 flex items-center justify-center rounded bg-surface text-text-muted text-sm">
        —
      </span>
    );
  }

  const colors: Record<Grade, string> = {
    'A+': 'bg-accent-primary text-background',
    'A': 'bg-accent-primary/80 text-background',
    'B': 'bg-accent-secondary text-background',
    'C': 'bg-accent-gold text-background',
    'D': 'bg-accent-danger/80 text-background',
    'F': 'bg-accent-danger text-background',
  };

  return (
    <span className={`w-8 h-8 flex items-center justify-center rounded font-display text-sm ${colors[grade]}`}>
      {grade}
    </span>
  );
}

// =============================================================================
// Rubric Preview
// =============================================================================

function RubricPreview({
  competencyId,
  selectedGrade,
}: {
  competencyId: CompetencyId;
  selectedGrade?: Grade;
}) {
  // Show rubric for selected grade or default to A
  const gradeToShow = selectedGrade || 'A';
  const rubricText = RUBRIC_DESCRIPTORS[competencyId][gradeToShow];

  return (
    <div>
      <p className="text-text-muted mb-1">
        {selectedGrade ? `${selectedGrade} Level:` : 'Select a grade to see criteria'}
      </p>
      <p className="text-text-primary leading-relaxed">
        {rubricText}
      </p>
    </div>
  );
}

// =============================================================================
// Quick Score Panel (for rapid grading)
// =============================================================================

interface QuickScorePanelProps {
  grades: Partial<Record<CompetencyId, Grade>>;
  onGradeChange: (competencyId: CompetencyId, grade: Grade) => void;
}

export function QuickScorePanel({ grades, onGradeChange }: QuickScorePanelProps) {
  const [selectedGrade, setSelectedGrade] = useState<Grade>('B');

  return (
    <div className="p-3 bg-surface/30 rounded-lg">
      <p className="text-xs text-text-muted mb-2">QUICK SCORE</p>

      {/* Grade selector */}
      <div className="flex gap-1 mb-3">
        {GRADES.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGrade(g)}
            className={`
              flex-1 py-1.5 rounded text-xs font-display transition-all
              ${selectedGrade === g
                ? 'bg-accent-primary text-background'
                : 'bg-surface hover:bg-surface/80 text-text-muted'
              }
            `}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Competency buttons */}
      <div className="grid grid-cols-3 gap-1">
        {COMPETENCY_ORDER.map((competencyId) => {
          const competency = COMPETENCIES[competencyId];
          const isGraded = !!grades[competencyId];

          return (
            <button
              key={competencyId}
              onClick={() => onGradeChange(competencyId, selectedGrade)}
              className={`
                p-2 rounded text-center transition-all
                ${isGraded
                  ? 'bg-accent-primary/20 border border-accent-primary'
                  : 'bg-surface hover:bg-surface/80 border border-transparent'
                }
              `}
              title={competency.name}
            >
              <span className="text-lg">{competency.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
