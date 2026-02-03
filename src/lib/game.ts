// =============================================================================
// Game State Management - XP, Combos, Streaks
// =============================================================================

import type {
  GameState,
  GradeAction,
  PointsBreakdown,
  StreakLabel,
  Achievement,
  CategoryGradeAction,
  CategoryPointsBreakdown,
  PersonalizationTier,
  SpecificityTier,
  CategoryXP,
} from '@/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Legacy points (kept for backward compatibility during transition)
export const POINTS = {
  GRADE_COMPETENCY: 50,
  COMPLETE_ALL_9: 300,
  ADD_FEEDBACK: 75,
  GENERATE_AI: 50,
  POST_TO_CANVAS: 100,
} as const;

// Behavior category XP values
export const CATEGORY_POINTS = {
  ENGAGEMENT: 50,
  SPECIFICITY: {
    low: 30,
    medium: 60,
    high: 90,
  },
  PERSONALIZATION: {
    untouched: 0,
    reviewed: 50,
    personalized: 100,
  },
  COMPLETENESS_BONUS: 500,
} as const;

// Timeliness multipliers based on days since deadline
export const TIMELINESS_MULTIPLIERS = {
  SAME_DAY: 1.2,      // 0 days
  ONE_TO_TWO: 1.0,    // 1-2 days
  THREE_TO_SIX: 0.8,  // 3-6 days
  SEVEN_PLUS: 0.5,    // 7+ days
  NO_DEADLINE: 1.0,   // No due date set
} as const;

export const COMBO_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (extended for quality grading)
export const MAX_MULTIPLIER = 1.5; // Reduced from 2.0 - behavior categories are main driver
export const MULTIPLIER_PER_COMBO = 0.05; // 10 combos = 1.5x max

// Level XP thresholds
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  500,    // Level 2
  1500,   // Level 3
  3000,   // Level 4
  5000,   // Level 5
  8000,   // Level 6
  12000,  // Level 7
  17000,  // Level 8
  23000,  // Level 9
  30000,  // Level 10
] as const;

export const LEVEL_TITLES = [
  'Apprentice Grader',    // Level 1
  'Grading Squire',       // Level 2
  'Feedback Knight',      // Level 3
  'Quality Guardian',     // Level 4
  'Assessment Wizard',    // Level 5
  'Grading Champion',     // Level 6
  'Evaluation Master',    // Level 7
  'Feedback Sage',        // Level 8
  'Grading Legend',       // Level 9
  'Grand Master Grader',  // Level 10
] as const;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

export function createInitialCategoryXP(): CategoryXP {
  return {
    engagement: 0,
    specificity: 0,
    personalization: 0,
    timeliness: 0,
    completeness: 0,
  };
}

// Load sound preference from localStorage (client-side only)
function loadSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('boss-battle-sound-enabled');
  return stored !== 'false';
}

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
    soundEnabled: loadSoundPreference(),
    categoryXP: createInitialCategoryXP(),
    submissionEngagement: {},
    aiDraftBaselines: {},
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
// Level Calculation
// -----------------------------------------------------------------------------

export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || 'Grader';
}

export function getXPToNextLevel(totalXP: number): { current: number; required: number; progress: number } {
  const level = calculateLevel(totalXP);

  if (level >= LEVEL_THRESHOLDS.length) {
    // Max level reached
    return {
      current: totalXP - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1],
      required: 0,
      progress: 100,
    };
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level];
  const xpIntoLevel = totalXP - currentThreshold;
  const xpForLevel = nextThreshold - currentThreshold;

  return {
    current: xpIntoLevel,
    required: xpForLevel,
    progress: Math.round((xpIntoLevel / xpForLevel) * 100),
  };
}

export interface LevelUpInfo {
  leveled: boolean;
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

export function checkLevelUp(previousXP: number, newXP: number): LevelUpInfo | null {
  const prevLevel = calculateLevel(previousXP);
  const newLevel = calculateLevel(newXP);

  if (newLevel > prevLevel) {
    return {
      leveled: true,
      previousLevel: prevLevel,
      newLevel,
      newTitle: getLevelTitle(newLevel),
    };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Timeliness Calculation
// -----------------------------------------------------------------------------

export function calculateTimelinessMultiplier(daysSinceDeadline: number | null): number {
  // No deadline = neutral multiplier
  if (daysSinceDeadline === null) {
    return TIMELINESS_MULTIPLIERS.NO_DEADLINE;
  }

  if (daysSinceDeadline <= 0) {
    return TIMELINESS_MULTIPLIERS.SAME_DAY;
  } else if (daysSinceDeadline <= 2) {
    return TIMELINESS_MULTIPLIERS.ONE_TO_TWO;
  } else if (daysSinceDeadline <= 6) {
    return TIMELINESS_MULTIPLIERS.THREE_TO_SIX;
  } else {
    return TIMELINESS_MULTIPLIERS.SEVEN_PLUS;
  }
}

export function getDaysSinceDeadline(dueAt: string | null): number | null {
  if (!dueAt) return null;

  const dueDate = new Date(dueAt);
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  return diffDays;
}

// -----------------------------------------------------------------------------
// Personalization Calculation
// -----------------------------------------------------------------------------

export function calculateSimilarity(original: string, current: string): number {
  if (original === current) return 1;
  if (!original.length || !current.length) return 0;

  // Space-optimized Levenshtein - O(min(m,n)) space
  let [str1, str2] = original.length > current.length
    ? [current, original] : [original, current];

  const len1 = str1.length;
  const len2 = str2.length;

  let prevRow = Array.from({ length: len1 + 1 }, (_, i) => i);
  let currRow = new Array(len1 + 1);

  for (let j = 1; j <= len2; j++) {
    currRow[0] = j;
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        prevRow[i] + 1,
        currRow[i - 1] + 1,
        prevRow[i - 1] + cost
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  const distance = prevRow[len1];
  const maxLen = Math.max(original.length, current.length);
  return 1 - (distance / maxLen);
}

export function getPersonalizationTier(similarity: number): PersonalizationTier {
  const diffPercent = (1 - similarity) * 100;
  if (diffPercent === 0) return 'untouched';
  if (diffPercent <= 20) return 'reviewed';
  return 'personalized';
}

export function calculatePersonalizationTier(
  originalDraft: string | null,
  finalText: string
): PersonalizationTier {
  if (!originalDraft) return 'untouched'; // No AI draft = no personalization to measure
  const similarity = calculateSimilarity(originalDraft, finalText);
  return getPersonalizationTier(similarity);
}

// -----------------------------------------------------------------------------
// Category-Based Points Calculation
// -----------------------------------------------------------------------------

export function calculateCategoryPoints(
  action: CategoryGradeAction,
  combo: number
): CategoryPointsBreakdown {
  // Calculate base points for each category
  const engagementPoints = action.engagementMet ? CATEGORY_POINTS.ENGAGEMENT : 0;
  const specificityPoints = action.specificityTier
    ? CATEGORY_POINTS.SPECIFICITY[action.specificityTier]
    : 0;
  const personalizationPoints = action.personalizationTier
    ? CATEGORY_POINTS.PERSONALIZATION[action.personalizationTier]
    : 0;

  // Calculate multipliers
  const timelinessMultiplier = calculateTimelinessMultiplier(action.daysSinceDeadline);
  const comboMultiplier = getComboMultiplier(combo);

  // Combo only applies to Engagement and Personalization (per spec)
  const engagementWithCombo = Math.round(engagementPoints * comboMultiplier);
  const personalizationWithCombo = Math.round(personalizationPoints * comboMultiplier);

  // Subtotal before timeliness
  const subtotal = engagementWithCombo + specificityPoints + personalizationWithCombo;

  // Apply timeliness multiplier to entire subtotal
  const total = Math.round(subtotal * timelinessMultiplier);

  return {
    engagement: engagementWithCombo,
    specificity: specificityPoints,
    personalization: personalizationWithCombo,
    subtotal,
    timelinessMultiplier,
    comboMultiplier,
    total,
  };
}

// -----------------------------------------------------------------------------
// Legacy Points Calculation (for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * Legacy points calculation - retained for backward compatibility
 * Speed bonuses have been removed in favor of behavior categories
 */
export function calculatePoints(
  action: GradeAction,
  combo: number
): PointsBreakdown {
  let base = 0;
  const speedBonus = 0; // Speed bonuses removed - quality over speed

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
      // Speed bonuses intentionally removed - use category-based scoring instead
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
  | { type: 'CHECK_IDLE' }
  // New category-based actions
  | { type: 'ADD_CATEGORY_XP'; category: keyof CategoryXP; points: number }
  | { type: 'SET_SUBMISSION_ENGAGEMENT'; submissionId: string; scrollPercentage: number; engagementMet: boolean }
  | { type: 'SET_AI_DRAFT_BASELINE'; submissionId: string; draft: string }
  | { type: 'AWARD_COMPLETENESS_BONUS' };

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

    // New category-based actions
    case 'ADD_CATEGORY_XP':
      return {
        ...state,
        categoryXP: {
          ...state.categoryXP,
          [action.category]: state.categoryXP[action.category] + action.points,
        },
        sessionXP: state.sessionXP + action.points,
      };

    case 'SET_SUBMISSION_ENGAGEMENT':
      return {
        ...state,
        submissionEngagement: {
          ...state.submissionEngagement,
          [action.submissionId]: {
            scrollPercentage: action.scrollPercentage,
            engagementMet: action.engagementMet,
          },
        },
      };

    case 'SET_AI_DRAFT_BASELINE':
      return {
        ...state,
        aiDraftBaselines: {
          ...state.aiDraftBaselines,
          [action.submissionId]: action.draft,
        },
      };

    case 'AWARD_COMPLETENESS_BONUS':
      return {
        ...state,
        categoryXP: {
          ...state.categoryXP,
          completeness: state.categoryXP.completeness + CATEGORY_POINTS.COMPLETENESS_BONUS,
        },
        sessionXP: state.sessionXP + CATEGORY_POINTS.COMPLETENESS_BONUS,
      };

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
    id: 'quality_champion',
    name: 'Quality Champion',
    description: 'Achieve "Personalized" tier on 5 consecutive submissions',
    icon: '✨',
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
  // New behavior category achievements
  {
    id: 'engaged_reader',
    name: 'Engaged Reader',
    description: 'Meet engagement threshold on 10 submissions',
    icon: '👁️',
  },
  {
    id: 'specific_feedback',
    name: 'Specific Feedback',
    description: 'Achieve "High" specificity on 5 submissions',
    icon: '🎯',
  },
  {
    id: 'batch_master',
    name: 'Batch Master',
    description: 'Complete an entire assignment in one session',
    icon: '🏆',
  },
  {
    id: 'timely_grader',
    name: 'Timely Grader',
    description: 'Grade 10 submissions on the same day as deadline',
    icon: '⏰',
  },
];

export interface SessionStats {
  totalGraded: number;
  avgTimeSeconds: number;
  allCompetenciesScored: boolean;
  allHaveFeedback: boolean;
  allPosted: boolean;
  // New category-based stats
  personalizedCount?: number;
  highSpecificityCount?: number;
  engagementMetCount?: number;
  sameDayCount?: number;
  completedAssignment?: boolean;
}

export function checkAchievements(
  state: GameState,
  sessionStats: SessionStats
): Achievement[] {
  const unlocked: Achievement[] = [];

  if (sessionStats.totalGraded >= 1) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'first_grade')!);
  }

  // Quality Champion: 5+ personalized submissions (replaces Speed Demon)
  if ((sessionStats.personalizedCount ?? 0) >= 5) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'quality_champion')!);
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

  // New behavior category achievements
  if ((sessionStats.engagementMetCount ?? 0) >= 10) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'engaged_reader')!);
  }

  if ((sessionStats.highSpecificityCount ?? 0) >= 5) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'specific_feedback')!);
  }

  if (sessionStats.completedAssignment) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'batch_master')!);
  }

  if ((sessionStats.sameDayCount ?? 0) >= 10) {
    unlocked.push(ACHIEVEMENTS.find((a) => a.id === 'timely_grader')!);
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
