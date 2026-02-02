'use client';

// =============================================================================
// ResultsScreen - Session Summary with XP, Stats, and Achievements
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { GameState, Achievement } from '@/types';
import { formatXP, formatTime, checkAchievements, ACHIEVEMENTS } from '@/lib/game';

// Check if user prefers reduced motion
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface SessionStats {
  totalGraded: number;
  totalTimeSeconds: number;
  avgTimeSeconds: number;
  fastestTimeSeconds: number;
  allCompetenciesScored: boolean;
  allHaveFeedback: boolean;
  allPosted: boolean;
}

interface ResultsScreenProps {
  gameState: GameState;
  sessionStats: SessionStats;
  onContinue: () => void;
  onNewSession: () => void;
}

export function ResultsScreen({
  gameState,
  sessionStats,
  onContinue,
  onNewSession,
}: ResultsScreenProps) {
  const [displayXP, setDisplayXP] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);

  // Fire victory confetti burst
  const fireConfetti = useCallback(() => {
    if (prefersReducedMotion()) return;

    // Gold and accent colored confetti from both sides
    const colors = ['#FFD93D', '#00FFAA', '#6C5CE7'];

    // Left side burst
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });

    // Right side burst
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });
  }, []);

  // Fire confetti on mount
  useEffect(() => {
    // Small delay to let the entrance animation start first
    const timeout = setTimeout(() => {
      fireConfetti();
    }, 300);

    return () => {
      clearTimeout(timeout);
      confetti.reset();
    };
  }, [fireConfetti]);

  // Animate XP counter with proper cleanup
  useEffect(() => {
    let canceled = false;
    let achievementTimeout: ReturnType<typeof setTimeout> | null = null;

    const duration = 2000;
    const steps = 60;
    const increment = gameState.sessionXP / steps;
    let step = 0;

    const timer = setInterval(() => {
      if (canceled) return;

      step++;
      const current = Math.min(Math.round(increment * step), gameState.sessionXP);
      setDisplayXP(current);

      if (step >= steps) {
        clearInterval(timer);
        achievementTimeout = setTimeout(() => {
          if (!canceled) setShowAchievements(true);
        }, 500);
      }
    }, duration / steps);

    return () => {
      canceled = true;
      clearInterval(timer);
      if (achievementTimeout) clearTimeout(achievementTimeout);
    };
  }, [gameState.sessionXP]);

  // Get unlocked achievements
  const unlockedAchievements = checkAchievements(gameState, sessionStats);

  // Fire extra confetti when achievements appear
  useEffect(() => {
    if (showAchievements && unlockedAchievements.length > 0) {
      fireConfetti();
    }
  }, [showAchievements, unlockedAchievements.length, fireConfetti]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 animate-victory-reveal">
      <div className="max-w-2xl w-full">
        {/* Victory Banner */}
        <div className="text-center mb-8">
          <span className="text-8xl block mb-4 animate-bounce">🏆</span>
          <h1 className="font-display text-4xl text-accent-gold mb-2">SESSION COMPLETE!</h1>
          <p className="text-text-muted">Your grading adventure has concluded</p>
        </div>

        {/* XP Display */}
        <div className="bg-gradient-to-br from-accent-gold/20 to-accent-primary/20 rounded-2xl p-8 mb-6 text-center border-2 border-accent-gold/50">
          <p className="font-display text-sm text-text-muted mb-2">TOTAL XP EARNED</p>
          <p className="font-display text-6xl text-accent-gold">{formatXP(displayXP)}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="📝"
            label="Graded"
            value={sessionStats.totalGraded.toString()}
          />
          <StatCard
            icon="⏱️"
            label="Session Time"
            value={formatTime(sessionStats.totalTimeSeconds)}
          />
          <StatCard
            icon="🔥"
            label="Best Combo"
            value={`${gameState.streak}x`}
          />
          <StatCard
            icon="✨"
            label="Quality XP"
            value={formatXP(
              gameState.categoryXP.engagement +
              gameState.categoryXP.specificity +
              gameState.categoryXP.personalization
            )}
          />
        </div>

        {/* Category XP Breakdown */}
        <div className="bg-surface/50 rounded-xl p-6 mb-6">
          <h3 className="font-display text-lg mb-4 text-text-primary">QUALITY BREAKDOWN</h3>
          <div className="space-y-3">
            <CategoryRow
              icon="👁️"
              label="Engagement"
              description="Reviewed submissions"
              value={gameState.categoryXP.engagement}
            />
            <CategoryRow
              icon="🎯"
              label="Specificity"
              description="Referenced specific details"
              value={gameState.categoryXP.specificity}
            />
            <CategoryRow
              icon="✍️"
              label="Personalization"
              description="Customized feedback"
              value={gameState.categoryXP.personalization}
            />
            <CategoryRow
              icon="⏰"
              label="Timeliness"
              description="Graded promptly"
              value={gameState.categoryXP.timeliness}
            />
            <CategoryRow
              icon="🏆"
              label="Completeness"
              description="Finished assignments"
              value={gameState.categoryXP.completeness}
            />
            <div className="border-t border-surface pt-3 flex justify-between font-display text-lg">
              <span className="text-text-primary">Total</span>
              <span className="text-accent-gold">{formatXP(gameState.sessionXP)} XP</span>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {showAchievements && unlockedAchievements.length > 0 && (
          <div className="bg-surface/50 rounded-xl p-6 mb-8 animate-fade-in">
            <h3 className="font-display text-lg mb-4 text-text-primary">
              ACHIEVEMENTS UNLOCKED <span className="text-accent-gold">({unlockedAchievements.length})</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {unlockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 bg-background/50 rounded-lg p-3"
                >
                  <span className="text-3xl">{achievement.icon}</span>
                  <div>
                    <p className="font-display text-sm text-accent-gold">{achievement.name}</p>
                    <p className="text-xs text-text-muted">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onContinue}
            className="flex-1 px-6 py-4 bg-surface rounded-xl font-display text-lg hover:bg-surface/80 transition-colors"
          >
            CONTINUE GRADING
          </button>
          <button
            onClick={onNewSession}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-accent-secondary to-accent-primary text-background rounded-xl font-display text-lg hover:opacity-90 transition-opacity"
          >
            NEW SESSION
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface/50 rounded-xl p-4 text-center">
      <span className="text-2xl block mb-2">{icon}</span>
      <p className="font-display text-2xl text-text-primary">{value}</p>
      <p className="text-xs text-text-muted font-display">{label}</p>
    </div>
  );
}

function CategoryRow({
  icon,
  label,
  description,
  value,
}: {
  icon: string;
  label: string;
  description: string;
  value: number;
}) {
  const hasPoints = value > 0;
  return (
    <div className={`flex items-center justify-between py-2 ${hasPoints ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm text-text-primary font-display">{label}</p>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <span className={`font-display ${hasPoints ? 'text-accent-primary' : 'text-text-muted'}`}>
        {hasPoints ? `+${formatXP(value)}` : '—'}
      </span>
    </div>
  );
}
