'use client';

// =============================================================================
// LevelSelect - Assignment Selection as Dungeon Doors
// =============================================================================

import type { CanvasCourse, CanvasAssignment, GameState } from '@/types';
import { formatXP } from '@/lib/game';

interface LevelSelectProps {
  course: CanvasCourse;
  assignments: CanvasAssignment[];
  gameState: GameState;
  isLoading: boolean;
  onSelectAssignment: (assignment: CanvasAssignment) => void;
  onBack: () => void;
}

// Status indicators based on grading progress
type DungeonStatus = 'ungraded' | 'in_progress' | 'cleared' | 'no_submissions';

function getDungeonStatus(assignment: CanvasAssignment): DungeonStatus {
  const summary = assignment.submission_summary;
  if (!summary) return 'ungraded';

  if (summary.ungraded === 0 && summary.graded === 0 && summary.not_submitted > 0) {
    return 'no_submissions';
  }
  if (summary.ungraded === 0 && summary.graded > 0) {
    return 'cleared';
  }
  if (summary.graded > 0 && summary.ungraded > 0) {
    return 'in_progress';
  }
  return 'ungraded';
}

const STATUS_CONFIG: Record<DungeonStatus, { icon: string; label: string; color: string }> = {
  ungraded: { icon: '🔴', label: 'UNGRADED', color: 'text-red-400' },
  in_progress: { icon: '🟡', label: 'IN PROGRESS', color: 'text-yellow-400' },
  cleared: { icon: '✅', label: 'CLEARED', color: 'text-green-400' },
  no_submissions: { icon: '⚫', label: 'NO SUBMISSIONS', color: 'text-gray-500' },
};

export function LevelSelect({
  course,
  assignments,
  gameState,
  isLoading,
  onSelectAssignment,
  onBack,
}: LevelSelectProps) {
  // Calculate overall progress
  const totalGraded = assignments.reduce(
    (sum, a) => sum + (a.submission_summary?.graded || 0),
    0
  );
  const totalSubmissions = assignments.reduce(
    (sum, a) =>
      sum +
      (a.submission_summary?.graded || 0) +
      (a.submission_summary?.ungraded || 0),
    0
  );
  const progressPercent = totalSubmissions > 0 ? (totalGraded / totalSubmissions) * 100 : 0;

  return (
    <div className="min-h-screen bg-background animate-fade-up">
      {/* Header */}
      <header className="border-b border-surface bg-surface/20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back button and course info */}
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg hover:bg-surface/80 transition-colors font-display"
              >
                <span>←</span>
                <span>BACK</span>
              </button>
              <div>
                <p className="text-xs text-text-muted font-display">WORLD</p>
                <h1 className="font-display text-xl">{course.name}</h1>
              </div>
            </div>

            {/* Session XP */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-text-muted font-display">SESSION XP</p>
                <p className="text-2xl font-display text-accent-gold">
                  {formatXP(gameState.sessionXP)}
                </p>
              </div>
            </div>
          </div>

          {/* Course Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-display text-text-muted">WORLD PROGRESS</span>
              <span className="font-display text-accent-primary">
                {totalGraded}/{totalSubmissions} GRADED
              </span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-secondary to-accent-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl mb-2">
            <span className="text-text-muted">SELECT YOUR</span>{' '}
            <span className="text-accent-gold">DUNGEON</span>
          </h2>
          <p className="text-text-muted">Each assignment awaits your judgment</p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <span className="text-6xl animate-bounce block mb-4">🏰</span>
              <p className="text-text-muted font-display">LOADING DUNGEONS...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && assignments.length === 0 && (
          <div className="text-center py-16">
            <span className="text-8xl block mb-4">🚪</span>
            <p className="text-text-muted font-display text-xl mb-2">NO DUNGEONS FOUND</p>
            <p className="text-sm text-text-muted">
              This course has no assignments yet
            </p>
          </div>
        )}

        {/* Assignment Grid - Dungeon Doors */}
        {!isLoading && assignments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((assignment, index) => {
              const status = getDungeonStatus(assignment);
              const statusConfig = STATUS_CONFIG[status];
              const summary = assignment.submission_summary;
              const gradedCount = summary?.graded || 0;
              const totalCount =
                (summary?.graded || 0) + (summary?.ungraded || 0);

              return (
                <button
                  key={assignment.id}
                  onClick={() => onSelectAssignment(assignment)}
                  disabled={status === 'no_submissions'}
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  className={`
                    relative group p-6 rounded-2xl border-2 stagger-item pixel-card
                    ${status === 'no_submissions'
                      ? 'border-surface/50 bg-surface/20 cursor-not-allowed opacity-60'
                      : 'border-surface bg-surface/50 hover:border-accent-gold hover:bg-surface/70'
                    }
                    transition-all duration-200 text-left overflow-hidden
                  `}
                >
                  {/* Dungeon number */}
                  <div className="absolute top-4 right-4 w-10 h-10 bg-background/50 rounded-full flex items-center justify-center font-display text-lg text-text-muted">
                    {index + 1}
                  </div>

                  {/* Dungeon door icon */}
                  <div className="text-5xl mb-4">🏰</div>

                  {/* Assignment Info */}
                  <h3 className="font-display text-xl text-text-primary mb-2 pr-12 line-clamp-2 group-hover:text-accent-gold transition-colors">
                    {assignment.name}
                  </h3>

                  {/* Status and meta */}
                  <div className="flex items-center gap-4 text-sm mb-3">
                    <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                      <span>{statusConfig.icon}</span>
                      <span className="font-display">{statusConfig.label}</span>
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 text-sm text-text-muted">
                    <span className="flex items-center gap-1">
                      <span>💎</span>
                      <span>{assignment.points_possible || 100} pts</span>
                    </span>
                    {assignment.due_at && (
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span>{new Date(assignment.due_at).toLocaleDateString()}</span>
                      </span>
                    )}
                    {totalCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span>📝</span>
                        <span>{gradedCount}/{totalCount} graded</span>
                      </span>
                    )}
                  </div>

                  {/* Progress bar for this dungeon */}
                  {totalCount > 0 && (
                    <div className="mt-4">
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            status === 'cleared'
                              ? 'bg-green-500'
                              : 'bg-gradient-to-r from-accent-secondary to-accent-primary'
                          }`}
                          style={{ width: `${(gradedCount / totalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Enter indicator */}
                  {status !== 'no_submissions' && (
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="font-display text-sm text-accent-gold">ENTER →</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
