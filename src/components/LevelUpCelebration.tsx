'use client';

// =============================================================================
// LevelUpCelebration - Epic level-up overlay with celebration effects
// =============================================================================

import { useEffect, useState } from 'react';
import { useSound } from '@/hooks/useSound';

interface LevelUpCelebrationProps {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
  onComplete: () => void;
  soundEnabled?: boolean;
}

export function LevelUpCelebration({
  previousLevel,
  newLevel,
  newTitle,
  onComplete,
  soundEnabled = true,
}: LevelUpCelebrationProps) {
  const [phase, setPhase] = useState<'flash' | 'reveal' | 'title' | 'fade'>('flash');
  const { play: playSound } = useSound(soundEnabled);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // Play level up sound
    playSound('levelUp');

    if (prefersReducedMotion) {
      // Skip animation for reduced motion
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }

    // Animation phases
    const flashTimer = setTimeout(() => setPhase('reveal'), 300);
    const revealTimer = setTimeout(() => setPhase('title'), 1000);
    const titleTimer = setTimeout(() => setPhase('fade'), 2500);
    const completeTimer = setTimeout(onComplete, 3000);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(revealTimer);
      clearTimeout(titleTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, prefersReducedMotion, playSound]);

  return (
    <div
      className={`
        fixed inset-0 z-50 flex flex-col items-center justify-center
        transition-all duration-300
        ${phase === 'flash' ? 'bg-accent-gold' : 'bg-background/95'}
        ${phase === 'fade' ? 'opacity-0' : 'opacity-100'}
      `}
    >
      {/* Particle effects - simple pixel stars */}
      {!prefersReducedMotion && phase !== 'flash' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-float-up"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${100 + Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {['⭐', '✨', '💫', '🌟'][Math.floor(Math.random() * 4)]}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="relative text-center px-4">
        {/* LEVEL UP banner */}
        <div
          className={`
            text-5xl font-display text-accent-gold mb-8
            transition-all duration-500
            ${phase === 'flash' ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}
            ${!prefersReducedMotion && phase !== 'fade' ? 'animate-pulse' : ''}
          `}
          style={{
            textShadow: '0 0 30px var(--accent-gold), 0 0 60px var(--accent-gold)',
          }}
        >
          LEVEL UP!
        </div>

        {/* Level numbers */}
        <div
          className={`
            flex items-center justify-center gap-6 mb-6
            transition-all duration-500 delay-300
            ${phase === 'reveal' || phase === 'title' || phase === 'fade' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
        >
          {/* Previous level */}
          <div className="text-center">
            <div className="text-3xl font-display text-text-muted">{previousLevel}</div>
            <div className="text-xs font-mono text-text-muted/60 mt-1">WAS</div>
          </div>

          {/* Arrow */}
          <div className="text-3xl text-accent-primary animate-pulse">→</div>

          {/* New level */}
          <div className="text-center">
            <div
              className="text-6xl font-display text-accent-primary"
              style={{
                textShadow: '0 0 20px var(--accent-primary)',
              }}
            >
              {newLevel}
            </div>
            <div className="text-xs font-mono text-accent-primary/60 mt-1">NOW</div>
          </div>
        </div>

        {/* New title */}
        <div
          className={`
            text-xl font-display text-text-primary
            transition-all duration-500 delay-500
            ${phase === 'title' || phase === 'fade' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
        >
          {newTitle.toUpperCase()}
        </div>

        {/* Continue prompt */}
        <div
          className={`
            mt-12 text-sm font-mono text-text-muted
            transition-all duration-300 delay-700
            ${phase === 'title' ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <span className="animate-pulse">Press any key to continue</span>
        </div>
      </div>
    </div>
  );
}
