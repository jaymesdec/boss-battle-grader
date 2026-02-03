'use client';

// =============================================================================
// useNudgeDetection - Anti-pattern detection for quality grading
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import type { NudgeType } from '@/components/Companion';

export type NudgePattern =
  | 'skipping_scroll'
  | 'empty_notes'
  | 'unchanged_feedback'
  | 'rapid_fire';

export interface NudgeMessage {
  type: NudgeType;
  message: string;
  pattern: NudgePattern;
}

interface NudgeState {
  unchangedFeedbackStreak: number;
  rapidGradeCount: number;
  lastGradeTimestamp: number | null;
  lastScrollPercentages: number[];
}

// Nudge messages from spec section 2.4
const NUDGE_MESSAGES: Record<NudgePattern, string> = {
  skipping_scroll:
    "Hmm, looks like you haven't read through this one yet. Want to take a look?",
  empty_notes:
    'Your notes help me write better feedback! Even a sentence or two makes a big difference.',
  unchanged_feedback:
    "I'm flattered, but students can tell when feedback is personal. Want to add your touch?",
  rapid_fire:
    "Whoa, you're moving fast! Are you sure you want to skip feedback on these?",
};

// Thresholds
const SCROLL_THRESHOLD = 90; // Must scroll 90% before AI
const NOTES_WORD_THRESHOLD = 10; // Minimum words in notes
const UNCHANGED_STREAK_THRESHOLD = 3; // Consecutive unchanged feedback
const RAPID_FIRE_TIME_MS = 90000; // 90 seconds
const RAPID_FIRE_COUNT = 3; // Number of rapid submissions

export function useNudgeDetection() {
  const [nudge, setNudge] = useState<NudgeMessage | null>(null);
  const nudgeState = useRef<NudgeState>({
    unchangedFeedbackStreak: 0,
    rapidGradeCount: 0,
    lastGradeTimestamp: null,
    lastScrollPercentages: [],
  });

  // Clear current nudge
  const clearNudge = useCallback(() => {
    setNudge(null);
  }, []);

  // Check if user clicked AI button before scrolling 90%
  const checkScrollNudge = useCallback((scrollPercent: number): boolean => {
    if (scrollPercent < SCROLL_THRESHOLD) {
      setNudge({
        type: 'warning',
        message: NUDGE_MESSAGES.skipping_scroll,
        pattern: 'skipping_scroll',
      });
      return true; // Nudge shown
    }
    return false; // No nudge
  }, []);

  // Check if notes are too short when synthesizing
  const checkEmptyNotesNudge = useCallback((notes: string): boolean => {
    const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount < NOTES_WORD_THRESHOLD) {
      setNudge({
        type: 'info',
        message: NUDGE_MESSAGES.empty_notes,
        pattern: 'empty_notes',
      });
      return true;
    }
    return false;
  }, []);

  // Check if feedback was unchanged from AI draft
  const checkUnchangedFeedbackNudge = useCallback(
    (originalDraft: string, finalFeedback: string): boolean => {
      // Simple edit distance check - if exactly the same
      const unchanged = originalDraft.trim() === finalFeedback.trim();

      if (unchanged) {
        nudgeState.current.unchangedFeedbackStreak++;

        if (nudgeState.current.unchangedFeedbackStreak >= UNCHANGED_STREAK_THRESHOLD) {
          setNudge({
            type: 'warning',
            message: NUDGE_MESSAGES.unchanged_feedback,
            pattern: 'unchanged_feedback',
          });
          return true;
        }
      } else {
        // Reset streak on any edit
        nudgeState.current.unchangedFeedbackStreak = 0;
      }

      return false;
    },
    []
  );

  // Check for rapid-fire grading without notes or AI
  const checkRapidFireNudge = useCallback((hasNotes: boolean, hasAiFeedback: boolean): boolean => {
    const now = Date.now();
    const lastTimestamp = nudgeState.current.lastGradeTimestamp;

    if (lastTimestamp && now - lastTimestamp < RAPID_FIRE_TIME_MS && !hasNotes && !hasAiFeedback) {
      nudgeState.current.rapidGradeCount++;

      if (nudgeState.current.rapidGradeCount >= RAPID_FIRE_COUNT) {
        setNudge({
          type: 'warning',
          message: NUDGE_MESSAGES.rapid_fire,
          pattern: 'rapid_fire',
        });
        nudgeState.current.rapidGradeCount = 0; // Reset after showing
        return true;
      }
    } else if (hasNotes || hasAiFeedback) {
      // Reset if they're using notes or AI
      nudgeState.current.rapidGradeCount = 0;
    }

    nudgeState.current.lastGradeTimestamp = now;
    return false;
  }, []);

  // Record that a grade was submitted (for tracking)
  const recordGradeSubmission = useCallback(() => {
    nudgeState.current.lastGradeTimestamp = Date.now();
  }, []);

  // Reset all tracking (e.g., when switching assignments)
  const resetTracking = useCallback(() => {
    nudgeState.current = {
      unchangedFeedbackStreak: 0,
      rapidGradeCount: 0,
      lastGradeTimestamp: null,
      lastScrollPercentages: [],
    };
    setNudge(null);
  }, []);

  return {
    nudge,
    clearNudge,
    checkScrollNudge,
    checkEmptyNotesNudge,
    checkUnchangedFeedbackNudge,
    checkRapidFireNudge,
    recordGradeSubmission,
    resetTracking,
  };
}
