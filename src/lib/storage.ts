// =============================================================================
// Storage Module - localStorage Persistence for Competency Scores
// =============================================================================
// Competency scores are not sent to Canvas (not a Canvas feature).
// They are stored locally per student per assignment for tracking.

import type { CompetencyId, Grade } from '@/types';

const COMPETENCY_STORAGE_PREFIX = 'bbg_competency_scores';

interface StoredCompetencyData {
  userId: number;
  assignmentId: number;
  grades: Partial<Record<CompetencyId, Grade>>;
  timestamp: string;
}

/**
 * Generate storage key for a student's competency scores on an assignment.
 */
function getStorageKey(userId: number, assignmentId: number): string {
  return `${COMPETENCY_STORAGE_PREFIX}_${userId}_${assignmentId}`;
}

/**
 * Save competency scores to localStorage.
 */
export function saveCompetencyScores(
  userId: number,
  assignmentId: number,
  grades: Partial<Record<CompetencyId, Grade>>
): void {
  if (typeof window === 'undefined') return;

  const key = getStorageKey(userId, assignmentId);
  const data: StoredCompetencyData = {
    userId,
    assignmentId,
    grades,
    timestamp: new Date().toISOString(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save competency scores to localStorage:', error);
  }
}

/**
 * Load competency scores from localStorage.
 * Returns null if no data found or data is invalid.
 */
export function loadCompetencyScores(
  userId: number,
  assignmentId: number
): Partial<Record<CompetencyId, Grade>> | null {
  if (typeof window === 'undefined') return null;

  const key = getStorageKey(userId, assignmentId);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const data: StoredCompetencyData = JSON.parse(stored);

    // Validate the data structure
    if (
      typeof data !== 'object' ||
      data.userId !== userId ||
      data.assignmentId !== assignmentId ||
      typeof data.grades !== 'object'
    ) {
      return null;
    }

    return data.grades;
  } catch (error) {
    console.error('Failed to load competency scores from localStorage:', error);
    return null;
  }
}

/**
 * Delete competency scores from localStorage.
 */
export function deleteCompetencyScores(userId: number, assignmentId: number): void {
  if (typeof window === 'undefined') return;

  const key = getStorageKey(userId, assignmentId);

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to delete competency scores from localStorage:', error);
  }
}

/**
 * Get all stored competency scores for an assignment.
 * Returns a map of userId -> grades.
 */
export function getAllCompetencyScoresForAssignment(
  assignmentId: number
): Map<number, Partial<Record<CompetencyId, Grade>>> {
  if (typeof window === 'undefined') return new Map();

  const result = new Map<number, Partial<Record<CompetencyId, Grade>>>();
  const prefix = `${COMPETENCY_STORAGE_PREFIX}_`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      const stored = localStorage.getItem(key);
      if (!stored) continue;

      try {
        const data: StoredCompetencyData = JSON.parse(stored);
        if (data.assignmentId === assignmentId && typeof data.grades === 'object') {
          result.set(data.userId, data.grades);
        }
      } catch {
        // Skip invalid entries
      }
    }
  } catch (error) {
    console.error('Failed to enumerate localStorage:', error);
  }

  return result;
}

/**
 * Clear all competency scores from localStorage.
 * Use with caution - this deletes all stored data.
 */
export function clearAllCompetencyScores(): void {
  if (typeof window === 'undefined') return;

  const prefix = `${COMPETENCY_STORAGE_PREFIX}_`;
  const keysToRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Failed to clear competency scores from localStorage:', error);
  }
}
