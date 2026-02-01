'use client';

// =============================================================================
// CharacterCard - Student profile with radar chart and stats
// =============================================================================

import Image from 'next/image';
import { RadarChart } from './RadarChart';
import { COMPETENCY_ORDER, COMPETENCIES } from '@/lib/competencies';
import { GRADE_VALUES } from '@/types';
import type { StudentCharacter, CompetencyId, Grade } from '@/types';

interface CharacterCardProps {
  student: StudentCharacter | null;
  currentGrades: Partial<Record<CompetencyId, Grade>>;
  isLoading?: boolean;
}

export function CharacterCard({
  student,
  currentGrades,
  isLoading = false,
}: CharacterCardProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="animate-pulse">
          <div className="w-20 h-20 rounded-full bg-surface mb-4" />
          <div className="w-32 h-4 bg-surface rounded mb-2" />
          <div className="w-24 h-3 bg-surface rounded" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-text-muted">
        <span className="text-4xl mb-2">👤</span>
        <p className="text-sm">No student selected</p>
      </div>
    );
  }

  // Generate DiceBear avatar URL
  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(
    student.displayName
  )}&backgroundColor=1a1a2e`;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Student Header */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-20 h-20 mb-2">
          <Image
            src={avatarUrl}
            alt={student.displayName}
            fill
            className="rounded-lg border-2 border-accent-primary pixelated"
            unoptimized
          />
        </div>
        <h2 className="font-display text-sm text-center text-text-primary truncate max-w-full">
          {student.displayName}
        </h2>
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center mb-4">
        <RadarChart grades={currentGrades} size={160} />
      </div>

      {/* Competency Stats */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {COMPETENCY_ORDER.map((competencyId) => {
          const competency = COMPETENCIES[competencyId];
          const grade = currentGrades[competencyId];
          const stat = student.competencyStats[competencyId];
          const value = grade ? GRADE_VALUES[grade] : 0;

          return (
            <div key={competencyId} className="flex items-center gap-2">
              <span className="text-sm" title={competency.name}>
                {competency.emoji}
              </span>
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${value}%`,
                    backgroundColor: competency.color,
                  }}
                />
              </div>
              <span className="text-xs text-text-muted w-6 text-right">
                {grade || '—'}
              </span>
              <TrendArrow trend={stat?.trend || 'new'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Trend Arrow
// =============================================================================

function TrendArrow({ trend }: { trend: 'improving' | 'steady' | 'declining' | 'new' }) {
  switch (trend) {
    case 'improving':
      return <span className="text-accent-primary text-xs">↑</span>;
    case 'declining':
      return <span className="text-accent-danger text-xs">↓</span>;
    case 'steady':
      return <span className="text-text-muted text-xs">→</span>;
    case 'new':
    default:
      return <span className="text-text-muted text-xs opacity-50">•</span>;
  }
}
