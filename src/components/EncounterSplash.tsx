'use client';

// =============================================================================
// EncounterSplash - RPG-style student encounter animation
// =============================================================================

import { useEffect, useState } from 'react';

interface EncounterSplashProps {
  studentName: string;
  studentAvatar: string;
  assignmentName: string;
  onComplete: () => void;
}

export function EncounterSplash({
  studentName,
  studentAvatar,
  assignmentName,
  onComplete,
}: EncounterSplashProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animation for reduced motion
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }

    // Enter phase
    const enterTimer = setTimeout(() => setPhase('show'), 300);

    // Exit phase
    const exitTimer = setTimeout(() => setPhase('exit'), 1200);

    // Complete callback
    const completeTimer = setTimeout(onComplete, 1500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, prefersReducedMotion]);

  return (
    <div
      className={`
        fixed inset-0 z-50 flex flex-col items-center justify-center
        bg-background/95 backdrop-blur-sm
        ${prefersReducedMotion ? '' : 'encounter-splash'}
      `}
      style={{
        animationPlayState: phase === 'exit' ? 'running' : 'paused',
      }}
    >
      {/* VS Banner */}
      <div
        className={`
          text-4xl font-display text-accent-gold mb-8
          ${prefersReducedMotion ? '' : 'animate-pulse'}
        `}
        style={{
          textShadow: '0 0 20px var(--accent-gold), 0 0 40px var(--accent-gold)',
        }}
      >
        ENCOUNTER!
      </div>

      {/* Student Avatar */}
      <div
        className={`
          relative w-32 h-32 mb-6 rounded-lg overflow-hidden
          border-4 border-accent-primary
          ${prefersReducedMotion ? '' : 'encounter-avatar'}
        `}
        style={{
          boxShadow: '0 0 30px var(--accent-primary)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={studentAvatar}
          alt={studentName}
          className="w-full h-full pixelated"
        />

        {/* Scanline effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
          }}
        />
      </div>

      {/* Student Name */}
      <div className="text-2xl font-display text-text-primary mb-2 text-center px-4">
        {studentName.toUpperCase()}
      </div>

      {/* Assignment Context */}
      <div className="text-sm font-mono text-text-muted text-center px-4 max-w-md">
        {assignmentName}
      </div>

      {/* Battle Ready Text */}
      <div
        className={`
          mt-8 text-sm font-display text-accent-primary
          ${prefersReducedMotion ? '' : 'animate-pulse'}
        `}
      >
        GET READY TO GRADE!
      </div>
    </div>
  );
}
