// =============================================================================
// Game State Management - XP, Combos, Streaks
// =============================================================================

import type { GameState, GradeAction, PointsBreakdown, StreakLabel, Achievement } from '@/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const POINTS = {
  GRADE_COMPETENCY: 50,
  COMPLETE_ALL_9: 300,
  SPEED_BONUS_2MIN: 200,
  SPEED_BONUS_3MIN: 100,
  ADD_FEEDBACK: 75,
  GENERATE_AI: 50,
  POST_TO_CANVAS: 100,
} as const;

export const COMBO_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_MULTIPLIER = 2.0;
export const MULTIPLIER_PER_COMBO = 0.1;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

export function createInitialGameState(): GameState {
  return {
    currentScreen: 'hub',
    selectedCourseId: null,
    selectedAssignmentId: null,
    sessionXP: 0,
    combo: 0,
    streak: 0,
    lastGradeTimestamp: null,
    sessionStartTime: Date.now(),
    gradedSubmissionIds: [],
    soundEnabled: true,
  };
}

// -----------------------------------------------------------------------------
// Combo & Multiplier Logic
// -----------------------------------------------------------------------------

export function getComboMultiplier(combo: number): number {
  const multiplier = 1.0 + combo * MULTIPLIER_PER_COMBO;
  return Math.min(multiplier, MAX_MULTIPLIER);
}

export function getStreakLabel(combo: number): StreakLabel {
  if (combo >= 10) return 'UNSTOPPABLE';
  if (combo >= 5) return 'ON FIRE';
  if (combo >= 3) return 'STREAK';
  if (combo >= 2) return 'COMBO';
  return null;
}

export function shouldResetCombo(lastTimestamp: number | null): boolean {
  if (!lastTimestamp) return false;
  return Date.now() - lastTimestamp > COMBO_IDLE_TIMEOUT_MS;
}

// -----------------------------------------------------------------------------
// Points Calculation
// -----------------------------------------------------------------------------

export function calculatePoints(
  action: GradeAction,
  combo: number
): PointsBreakdown {
  let base = 0;
  let speedBonus = 0;

  switch (action.type) {
    case 'grade_competency':
      base = POINTS.GRADE_COMPETENCY;
      break;
    case 'complete_all_9':
      base = POINTS.COMPLETE_ALL_9;
      break;
    case 'add_feedback':
      base = POINTS.ADD_FEEDBACK;
      break;
    case 'generate_ai':
      base = POINTS.GENERATE_AI;
      break;
    case 'post_to_canvas':
      base = POINTS.POST_TO_CANVAS;
      // Add speed bonus based on time spent
      if (action.timeSpentSeconds !== undefined) {
        if (action.timeSpentSeconds < 120) {
          speedBonus = POINTS.SPEED_BONUS_2MIN;
        } else if (action.timeSpentSeconds < 180) {
          speedBonus = POINTS.SPEED_BONUS_3MIN;
        }
      }
      break;
  }

  const multiplier = getComboMultiplier(combo);
  const total = Math.round((base + speedBonus) * multiplier);

  return {
    base,
    speedBonus,
    multiplier,
    total,
  };
}

// -----------------------------------------------------------------------------
// Game State Reducer Actions
// -----------------------------------------------------------------------------

export type GameAction =
  | { type: 'SET_SCREEN'; screen: GameState['currentScreen'] }
  | { type: 'SELECT_COURSE'; courseId: number }
  | { type: 'SELECT_ASSIGNMENT'; assignmentId: number }
  | { type: 'ADD_XP'; points: number }
  | { type: 'INCREMENT_COMBO' }
  | { type: 'RESET_COMBO' }
  | { type: 'MARK_GRADED'; submissionId: string }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'RESET_SESSION' }
  | { type: 'CHECK_IDLE' };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.screen };

    case 'SELECT_COURSE':
      return {
        ...state,
        selectedCourseId: action.courseId,
        selectedAssignmentId: null,
        currentScreen: 'level',
      };

    case 'SELECT_ASSIGNMENT':
      return {
        ...state,
        selectedAssignmentId: action.assignmentId,
        currentScreen: 'battle',
      };

    case 'ADD_XP':
      return {
        ...state,
        sessionXP: state.sessionXP + action.points,
      };

    case 'INCREMENT_COMBO':
      return {
        ...state,
        combo: state.combo + 1,
        streak: state.streak + 1,
        lastGradeTimestamp: Date.now(),
      };

    case 'RESET_COMBO':
      return {
        ...state,
        combo: 0,
        lastGradeTimestamp: null,
      };

    case 'MARK_GRADED':
      return {
        ...state,
        gradedSubmissionIds: [...state.gradedSubmissionIds, action.submissionId],
      };

    case 'TOGGLE_SOUND':
      return {
        ...state,
        soundEnabled: !state.soundEnabled,
      };

    case 'RESET_SESSION':
      return {
        ...createInitialGameState(),
        soundEnabled: state.soundEnabled,
      };

    case 'CHECK_IDLE':
      if (shouldResetCombo(state.lastGradeTimestamp)) {
        return { ...state, combo: 0 };
      }
      return state;

    default:
      return state;
  }
}

// -----------------------------------------------------------------------------
// Achievements
// -----------------------------------------------------------------------------

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_grade',
    name: 'First Blood',
    description: 'Grade your first submission',
    icon: '⚔️',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Average under 2 minutes per submission',
    icon: '⚡',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Score all 9 competencies on every submission',
    icon: '💎',
  },
  {
    id: 'feedback_champion',
    name: 'Feedback Champion',
    description: 'Add voice notes to every submission',
    icon: '🎤',
  },
  {
    id: 'canvas_synced',
    name: 'Canvas Synced',
    description: 'Post all grades to Canvas',
    icon: '📤',
  },
  {
    id: 'combo_5',
    name: 'On Fire',
    description: 'Reach a 5x combo',
    icon: '🔥',
  },
  {
    id: 'combo_10',
    name: 'Unstoppable',
    description: 'Reach a 10x combo',
    icon: '💥',
  },
  {
    id: 'session_1000',
    name: 'XP Hunter',
    description: 'Earn 1000 XP in a single session',
    icon: '🏆',
  },
  {
    id: 'session_5000',
    name: 'XP Legend',
    description: 'Earn 5000 XP in a single session',
    icon: '👑',
  },
];

export function checkAchievements(
  state: GameState,
  sessionStats: {
    totalGraded: number;
    avgTimeSeconds: number;
    allCompetenciesScored: boolean;
    allHaveFeedback: boolean;
    allPosted: boolean;
  }
): Achievement[] {
  const unlocked: Achievement[] = [];

  if (sessionStats.totalGraded >= 1) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'first_grade')!);
  }

  if (sessionStats.avgTimeSeconds < 120 && sessionStats.totalGraded >= 3) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'speed_demon')!);
  }

  if (sessionStats.allCompetenciesScored && sessionStats.totalGraded >= 3) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'perfectionist')!);
  }

  if (sessionStats.allHaveFeedback && sessionStats.totalGraded >= 3) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'feedback_champion')!);
  }

  if (sessionStats.allPosted && sessionStats.totalGraded >= 1) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'canvas_synced')!);
  }

  if (state.combo >= 5) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'combo_5')!);
  }

  if (state.combo >= 10) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'combo_10')!);
  }

  if (state.sessionXP >= 1000) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'session_1000')!);
  }

  if (state.sessionXP >= 5000) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'session_5000')!);
  }

  return unlocked.filter(Boolean);
}

// -----------------------------------------------------------------------------
// Session Stats
// -----------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatXP(xp: number): string {
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}
