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
  batchUploadedIds: Set<number>;
  onSelect: (userId: number) => void;
}

export function StudentQueue({
  submissions,
  currentUserId,
  gradedIds,
  batchUploadedIds,
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
        const isGraded = gradedIds.has(submission.user_id) || submission.score !== null;
        const hasBatchPdf = batchUploadedIds.has(submission.user_id);
        const isSubmitted = !!submission.submitted_at;
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
              <StudentStatus
                isSubmitted={isSubmitted}
                isGraded={isGraded}
                hasBatchPdf={hasBatchPdf}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Student Status - Shows submission and grading status
// =============================================================================

function StudentStatus({
  isSubmitted,
  isGraded,
  hasBatchPdf,
}: {
  isSubmitted: boolean;
  isGraded: boolean;
  hasBatchPdf: boolean;
}) {
  // Build status badges
  const badges: Array<{ text: string; icon: string; color: string }> = [];

  if (!isSubmitted && !hasBatchPdf) {
    badges.push({ text: 'Not submitted', icon: '⚫', color: 'text-text-muted' });
  } else {
    if (isGraded) {
      badges.push({ text: 'Graded', icon: '✓', color: 'text-accent-primary' });
    } else if (isSubmitted) {
      badges.push({ text: 'Needs grading', icon: '●', color: 'text-accent-gold' });
    }

    if (hasBatchPdf) {
      badges.push({ text: 'PDF', icon: '📄', color: 'text-accent-secondary' });
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-0.5 text-xs ${badge.color}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </span>
      ))}
    </div>
  );
}
