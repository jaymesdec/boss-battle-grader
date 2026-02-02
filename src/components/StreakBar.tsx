'use client';

// =============================================================================
// StreakBar - Top HUD showing XP, combo, streak, and session stats
// =============================================================================

import { useEffect, useState, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { getComboMultiplier, getStreakLabel, formatXP, formatTime } from '@/lib/game';
import type { GameState } from '@/types';

// XP popup queue entry
interface XPPopupEntry {
  id: number;
  amount: number;
  timestamp: number;
}

interface StreakBarProps {
  gameState: GameState;
  gradedCount: number;
  totalCount: number;
  onBack: () => void;
  onToggleSound?: () => void;
  assignmentName?: string;
  courseName?: string;
}

export function StreakBar({
  gameState,
  gradedCount,
  totalCount,
  onBack,
  onToggleSound,
  assignmentName = 'Assignment',
  courseName = 'Course',
}: StreakBarProps) {
  const [sessionTime, setSessionTime] = useState(0);
  const [xpQueue, setXpQueue] = useState<XPPopupEntry[]>([]);
  const [lastXP, setLastXP] = useState(gameState.sessionXP);
  const popupIdRef = useRef(0);

  // Update session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(Math.floor((Date.now() - gameState.sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.sessionStartTime]);

  // Add XP to queue when XP changes
  useEffect(() => {
    if (gameState.sessionXP > lastXP) {
      const delta = gameState.sessionXP - lastXP;
      setXpQueue(prev => [...prev, {
        id: ++popupIdRef.current,
        amount: delta,
        timestamp: Date.now(),
      }]);
      setLastXP(gameState.sessionXP);
    }
  }, [gameState.sessionXP, lastXP]);

  // Clean old popups from queue
  useEffect(() => {
    const cleanup = setInterval(() => {
      setXpQueue(prev => prev.filter(p => Date.now() - p.timestamp < 1500));
    }, 100);
    return () => clearInterval(cleanup);
  }, []);

  const multiplier = getComboMultiplier(gameState.combo);
  const streakLabel = getStreakLabel(gameState.combo);
  const progress = totalCount > 0 ? (gradedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-background via-surface/30 to-background border-b border-surface">
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                     bg-surface/50 hover:bg-surface transition-colors
                     text-text-muted hover:text-text-primary"
        >
          <span>←</span>
          <span className="text-sm font-display">EXIT</span>
        </button>

        {/* Assignment Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-muted truncate">{courseName}</p>
          <p className="text-sm text-text-primary font-display truncate">{assignmentName}</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 w-48">
          <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-muted whitespace-nowrap">
            {gradedCount}/{totalCount}
          </span>
        </div>

        {/* Session Timer */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/50 rounded-lg">
          <span className="text-lg">⏱️</span>
          <span className="text-sm font-mono text-text-primary">
            {formatTime(sessionTime)}
          </span>
        </div>

        {/* Combo/Streak Display */}
        <ComboDisplay
          combo={gameState.combo}
          multiplier={multiplier}
          streakLabel={streakLabel}
        />

        {/* XP Display with popup queue */}
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-accent-gold/20 to-accent-primary/20 rounded-lg border border-accent-gold/30">
            <span className="text-lg">⚡</span>
            <span className="text-lg font-display text-accent-gold">
              {formatXP(gameState.sessionXP)} XP
            </span>
          </div>
          {/* XP popup queue - renders multiple popups with vertical offset */}
          {xpQueue.map((popup, index) => (
            <div
              key={popup.id}
              className="absolute left-1/2 -translate-x-1/2 xp-popup pointer-events-none"
              style={{ top: `${-24 - index * 28}px` }}
            >
              +{popup.amount}
            </div>
          ))}
        </div>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          className="p-2 rounded-lg bg-surface/50 hover:bg-surface transition-colors text-lg pixel-button"
          title={gameState.soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {gameState.soundEnabled ? '🔊' : '🔇'}
        </button>

        {/* Sign Out */}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="p-2 rounded-lg bg-surface/50 hover:bg-accent-danger/20 hover:text-accent-danger transition-colors text-lg pixel-button"
          title="Sign out"
        >
          🚪
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Combo Display
// =============================================================================

function ComboDisplay({
  combo,
  multiplier,
  streakLabel,
}: {
  combo: number;
  multiplier: number;
  streakLabel: string | null;
}) {
  if (combo === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/30 rounded-lg">
        <span className="text-text-muted text-sm">No combo</span>
      </div>
    );
  }

  const labelColors: Record<string, string> = {
    COMBO: 'text-accent-secondary',
    STREAK: 'text-accent-primary',
    'ON FIRE': 'text-accent-gold',
    UNSTOPPABLE: 'text-accent-danger',
  };

  // Determine combo glow intensity based on combo level
  const comboGlowClass =
    combo >= 10 ? 'combo-glow-high' :
    combo >= 5 ? 'combo-glow-medium' :
    'combo-glow-low';

  return (
    <div className="flex items-center gap-2">
      {/* Combo Counter with glow effect */}
      <div className={`flex items-center gap-1 px-3 py-1.5 bg-surface/50 rounded-lg ${comboGlowClass}`}>
        <span className="text-lg">🔥</span>
        <span className="text-lg font-display text-accent-primary">
          {combo}x
        </span>
      </div>

      {/* Multiplier */}
      <div className="px-2 py-1 bg-accent-primary/20 rounded text-accent-primary text-sm font-display">
        {multiplier.toFixed(1)}x
      </div>

      {/* Streak Label */}
      {streakLabel && (
        <div className={`
          px-3 py-1 rounded-lg font-display text-sm animate-pulse
          ${labelColors[streakLabel] || 'text-accent-primary'}
          bg-gradient-to-r from-transparent via-current/10 to-transparent
        `}>
          {streakLabel}!
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Mini Streak Bar (for compact displays)
// =============================================================================

interface MiniStreakBarProps {
  xp: number;
  combo: number;
  gradedCount: number;
  totalCount: number;
}

export function MiniStreakBar({ xp, combo, gradedCount, totalCount }: MiniStreakBarProps) {
  const multiplier = getComboMultiplier(combo);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-accent-gold">⚡ {formatXP(xp)} XP</span>
      {combo > 0 && (
        <span className="text-accent-primary">🔥 {combo}x ({multiplier.toFixed(1)}x)</span>
      )}
      <span className="text-text-muted">{gradedCount}/{totalCount} graded</span>
    </div>
  );
}

// =============================================================================
// XP Popup Animation
// =============================================================================

interface XPPopupProps {
  amount: number;
  onComplete: () => void;
}

export function XPPopup({ amount, onComplete }: XPPopupProps) {
  useEffect(() => {
    const timeout = setTimeout(onComplete, 1500);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
      <div className="animate-ping-once text-4xl font-display text-accent-gold drop-shadow-glow">
        +{amount} XP
      </div>
    </div>
  );
}

// =============================================================================
// Combo Break Animation
// =============================================================================

export function ComboBreak() {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
      <div className="animate-shake text-2xl font-display text-accent-danger">
        COMBO BREAK!
      </div>
    </div>
  );
}
