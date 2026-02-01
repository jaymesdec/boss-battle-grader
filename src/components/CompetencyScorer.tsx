'use client';

// =============================================================================
// CompetencyScorer - Grade selector for TD Competencies OR Assignment Rubric
// =============================================================================

import { useState } from 'react';
import { COMPETENCY_ORDER, COMPETENCIES, RUBRIC_DESCRIPTORS } from '@/lib/competencies';
import type { CompetencyId, Grade, CanvasRubric } from '@/types';

const GRADES: Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];

type ScoringMode = 'competencies' | 'rubric';

interface RubricScore {
  criterionId: string;
  ratingId: string;
  points: number;
}

interface CompetencyScorerProps {
  // Competency grading
  grades: Partial<Record<CompetencyId, Grade>>;
  onGradeChange: (competencyId: CompetencyId, grade: Grade | null) => void;
  // Rubric grading
  rubric?: CanvasRubric[];
  rubricScores: Record<string, RubricScore>;
  onRubricScoreChange: (criterionId: string, score: RubricScore | null) => void;
  // Actions
  onPostToCanvas: () => void;
  isPosting?: boolean;
  canPost?: boolean;
}

export function CompetencyScorer({
  grades,
  onGradeChange,
  rubric,
  rubricScores,
  onRubricScoreChange,
  onPostToCanvas,
  isPosting = false,
  canPost = false,
}: CompetencyScorerProps) {
  const [mode, setMode] = useState<ScoringMode>(rubric?.length ? 'rubric' : 'competencies');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasRubric = rubric && rubric.length > 0;

  // Calculate progress based on mode
  const gradedCount = mode === 'competencies'
    ? Object.keys(grades).length
    : Object.keys(rubricScores).length;
  const totalCount = mode === 'competencies'
    ? 9
    : (rubric?.length || 0);
  const allGraded = gradedCount === totalCount && totalCount > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Mode Toggle */}
      <div className="p-3 border-b border-surface">
        {/* Mode Toggle */}
        {hasRubric && (
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setMode('rubric')}
              className={`
                flex-1 py-2 px-3 rounded-lg text-xs font-display transition-all
                ${mode === 'rubric'
                  ? 'bg-accent-primary text-background'
                  : 'bg-surface text-text-muted hover:bg-surface/80'
                }
              `}
            >
              📋 RUBRIC
            </button>
            <button
              onClick={() => setMode('competencies')}
              className={`
                flex-1 py-2 px-3 rounded-lg text-xs font-display transition-all
                ${mode === 'competencies'
                  ? 'bg-accent-primary text-background'
                  : 'bg-surface text-text-muted hover:bg-surface/80'
                }
              `}
            >
              🎯 COMPETENCIES
            </button>
          </div>
        )}

        {/* Progress Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm text-text-muted">
            {mode === 'competencies' ? 'COMPETENCIES' : 'RUBRIC CRITERIA'}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{gradedCount}/{totalCount}</span>
            {allGraded && <span className="text-accent-primary">✓</span>}
          </div>
        </div>
        <div className="w-full h-1 bg-surface rounded-full mt-2">
          <div
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all duration-300"
            style={{ width: totalCount > 0 ? `${(gradedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Scoring List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {mode === 'competencies' ? (
          // Competency List
          COMPETENCY_ORDER.map((competencyId) => {
            const competency = COMPETENCIES[competencyId];
            const grade = grades[competencyId];
            const isExpanded = expandedId === competencyId;

            return (
              <CompetencyItem
                key={competencyId}
                competencyId={competencyId}
                competency={competency}
                grade={grade}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : competencyId)}
                onGradeChange={onGradeChange}
              />
            );
          })
        ) : (
          // Rubric Criteria List
          rubric?.map((criterion) => {
            const score = rubricScores[criterion.id];
            const isExpanded = expandedId === criterion.id;

            return (
              <RubricCriterionItem
                key={criterion.id}
                criterion={criterion}
                score={score}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : criterion.id)}
                onScoreChange={onRubricScoreChange}
              />
            );
          })
        )}

        {mode === 'rubric' && !hasRubric && (
          <div className="text-center py-8 text-text-muted">
            <span className="text-4xl block mb-2">📋</span>
            <p className="text-sm">No rubric found for this assignment</p>
            <p className="text-xs mt-1">Use competencies mode instead</p>
          </div>
        )}
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
            {mode === 'competencies'
              ? 'Grade all 9 competencies to post'
              : `Score all ${totalCount} criteria to post`
            }
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Competency Item
// =============================================================================

interface CompetencyItemProps {
  competencyId: CompetencyId;
  competency: typeof COMPETENCIES[CompetencyId];
  grade?: Grade;
  isExpanded: boolean;
  onToggle: () => void;
  onGradeChange: (competencyId: CompetencyId, grade: Grade | null) => void;
}

function CompetencyItem({
  competencyId,
  competency,
  grade,
  isExpanded,
  onToggle,
  onGradeChange,
}: CompetencyItemProps) {
  return (
    <div
      className={`
        rounded-lg border transition-all
        ${grade ? 'bg-surface/50 border-surface' : 'bg-transparent border-surface/50'}
        ${isExpanded ? 'border-accent-primary' : ''}
      `}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        <span
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${competency.color}20` }}
        >
          {competency.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate">{competency.name}</p>
        </div>
        <GradeBadge grade={grade} />
        <span className="text-text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2">
          <div className="flex gap-1 mb-2">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => onGradeChange(competencyId, grade === g ? null : g)}
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
          <div className="p-2 bg-background/50 rounded text-xs">
            <p className="text-text-muted mb-1">
              {grade ? `${grade} Level:` : 'Select a grade to see criteria'}
            </p>
            <p className="text-text-primary leading-relaxed">
              {RUBRIC_DESCRIPTORS[competencyId][grade || 'A']}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Rubric Criterion Item
// =============================================================================

interface RubricCriterionItemProps {
  criterion: CanvasRubric;
  score?: RubricScore;
  isExpanded: boolean;
  onToggle: () => void;
  onScoreChange: (criterionId: string, score: RubricScore | null) => void;
}

function RubricCriterionItem({
  criterion,
  score,
  isExpanded,
  onToggle,
  onScoreChange,
}: RubricCriterionItemProps) {
  const selectedRating = score
    ? criterion.ratings.find((r) => r.id === score.ratingId)
    : null;

  return (
    <div
      className={`
        rounded-lg border transition-all
        ${score ? 'bg-surface/50 border-surface' : 'bg-transparent border-surface/50'}
        ${isExpanded ? 'border-accent-primary' : ''}
      `}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        <span className="w-8 h-8 flex items-center justify-center rounded-lg text-lg bg-accent-secondary/20">
          📋
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate">{criterion.description}</p>
          <p className="text-xs text-text-muted">{criterion.points} pts max</p>
        </div>
        <PointsBadge points={score?.points} maxPoints={criterion.points} />
        <span className="text-text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {criterion.long_description && (
            <p className="text-xs text-text-muted p-2 bg-background/30 rounded">
              {criterion.long_description}
            </p>
          )}
          {criterion.ratings.map((rating) => {
            const isSelected = score?.ratingId === rating.id;
            return (
              <button
                key={rating.id}
                onClick={() => {
                  if (isSelected) {
                    onScoreChange(criterion.id, null);
                  } else {
                    onScoreChange(criterion.id, {
                      criterionId: criterion.id,
                      ratingId: rating.id,
                      points: rating.points,
                    });
                  }
                }}
                className={`
                  w-full p-2 rounded text-left transition-all
                  ${isSelected
                    ? 'bg-accent-primary/20 border border-accent-primary'
                    : 'bg-surface hover:bg-surface/80 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-display text-text-primary">
                    {rating.description}
                  </span>
                  <span className={`text-sm font-display ${isSelected ? 'text-accent-primary' : 'text-text-muted'}`}>
                    {rating.points} pts
                  </span>
                </div>
                {rating.long_description && (
                  <p className="text-xs text-text-muted">{rating.long_description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Badges
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

function PointsBadge({ points, maxPoints }: { points?: number; maxPoints: number }) {
  if (points === undefined) {
    return (
      <span className="px-2 py-1 rounded bg-surface text-text-muted text-xs">
        — / {maxPoints}
      </span>
    );
  }

  const percentage = (points / maxPoints) * 100;
  const colorClass = percentage >= 90
    ? 'bg-accent-primary text-background'
    : percentage >= 70
    ? 'bg-accent-secondary text-background'
    : percentage >= 50
    ? 'bg-accent-gold text-background'
    : 'bg-accent-danger text-background';

  return (
    <span className={`px-2 py-1 rounded font-display text-xs ${colorClass}`}>
      {points} / {maxPoints}
    </span>
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
