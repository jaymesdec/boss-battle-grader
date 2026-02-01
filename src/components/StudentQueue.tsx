'use client';

// =============================================================================
// StudentQueue - Scrollable list of students for the assignment
// =============================================================================

import Image from 'next/image';
import type { CanvasSubmission } from '@/types';

interface StudentQueueProps {
  submissions: CanvasSubmission[];
  currentUserId: number | null;
  gradedIds: Set<number>;
  onSelect: (userId: number) => void;
}

export function StudentQueue({
  submissions,
  currentUserId,
  gradedIds,
  onSelect,
}: StudentQueueProps) {
  if (submissions.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted text-sm">
        No submissions found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <h3 className="text-xs font-display text-text-muted px-2 mb-2">
        STUDENTS ({submissions.length})
      </h3>
      {submissions.map((submission) => {
        const isSelected = submission.user_id === currentUserId;
        const isGraded = gradedIds.has(submission.user_id);
        const studentName = submission.user?.name || `Student ${submission.user_id}`;
        const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(
          studentName
        )}&backgroundColor=1a1a2e&size=32`;

        return (
          <button
            key={submission.id}
            onClick={() => onSelect(submission.user_id)}
            className={`
              flex items-center gap-2 p-2 rounded-lg transition-all
              ${isSelected
                ? 'bg-accent-primary/20 border border-accent-primary'
                : 'bg-surface/50 hover:bg-surface border border-transparent'
              }
            `}
          >
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image
                src={avatarUrl}
                alt={studentName}
                fill
                className="rounded pixelated"
                unoptimized
              />
              {isGraded && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary rounded-full flex items-center justify-center">
                  <span className="text-[10px]">✓</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-text-primary truncate">{studentName}</p>
              <p className="text-xs text-text-muted">
                {submission.late && <span className="text-accent-danger">Late • </span>}
                {submission.submitted_at
                  ? `Attempt ${submission.attempt}`
                  : 'Not submitted'}
              </p>
            </div>
            <StatusIndicator
              submitted={!!submission.submitted_at}
              graded={isGraded}
              hasScore={submission.score !== null}
            />
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Status Indicator
// =============================================================================

function StatusIndicator({
  submitted,
  graded,
  hasScore,
}: {
  submitted: boolean;
  graded: boolean;
  hasScore: boolean;
}) {
  if (graded || hasScore) {
    return <span className="text-accent-primary">✅</span>;
  }
  if (submitted) {
    return <span className="text-accent-gold">🔴</span>;
  }
  return <span className="text-text-muted">⚫</span>;
}
