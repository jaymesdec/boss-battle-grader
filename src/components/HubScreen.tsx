'use client';

// =============================================================================
// HubScreen - World Map with Course Selection
// =============================================================================

import { useState, useEffect } from 'react';
import type { CanvasCourse, GameState } from '@/types';
import { formatXP, formatTime } from '@/lib/game';

// Biome configurations for different courses
const BIOMES = [
  { emoji: '🏔️', name: 'Mountain', gradient: 'from-slate-700 to-slate-900' },
  { emoji: '🌲', name: 'Forest', gradient: 'from-emerald-800 to-emerald-950' },
  { emoji: '🏜️', name: 'Desert', gradient: 'from-amber-700 to-amber-900' },
  { emoji: '🌊', name: 'Ocean', gradient: 'from-blue-700 to-blue-950' },
  { emoji: '🌋', name: 'Volcano', gradient: 'from-red-800 to-red-950' },
  { emoji: '❄️', name: 'Tundra', gradient: 'from-cyan-700 to-cyan-950' },
  { emoji: '🌙', name: 'Shadowlands', gradient: 'from-purple-800 to-purple-950' },
  { emoji: '☀️', name: 'Sunlands', gradient: 'from-yellow-600 to-orange-800' },
];

interface HubScreenProps {
  courses: CanvasCourse[];
  gameState: GameState;
  isLoading: boolean;
  error: string | null;
  onSelectCourse: (course: CanvasCourse) => void;
  onStartDemo: () => void;
}

export function HubScreen({
  courses,
  gameState,
  isLoading,
  error,
  onSelectCourse,
  onStartDemo,
}: HubScreenProps) {
  const [sessionDuration, setSessionDuration] = useState(0);

  // Update session duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - gameState.sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.sessionStartTime]);

  // Get biome for a course (deterministic based on course id)
  const getBiome = (courseId: number) => {
    return BIOMES[courseId % BIOMES.length];
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden animate-wipe-in">
      {/* Pixel-art world map background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 via-background to-background" />
        {/* Stars */}
        <div className="absolute top-10 left-[10%] text-2xl opacity-50">✦</div>
        <div className="absolute top-20 left-[30%] text-lg opacity-30">✧</div>
        <div className="absolute top-8 left-[50%] text-xl opacity-40">✦</div>
        <div className="absolute top-16 left-[70%] text-lg opacity-50">✧</div>
        <div className="absolute top-12 left-[90%] text-2xl opacity-30">✦</div>
        {/* Distant mountains */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-surface/30 to-transparent" />
      </div>

      {/* Session Stats Bar */}
      <header className="relative z-10 border-b border-surface/50 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <span className="text-4xl animate-pulse">⚔️</span>
              <div>
                <h1 className="font-display text-2xl tracking-wider">BOSS BATTLE GRADER</h1>
                <p className="text-xs text-text-muted">Franklin School D&T</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              {/* Session XP */}
              <div className="text-right">
                <p className="text-xs text-text-muted font-display">SESSION XP</p>
                <p className="text-2xl font-display text-accent-gold">
                  {formatXP(gameState.sessionXP)}
                </p>
              </div>

              {/* Session Time */}
              <div className="text-right">
                <p className="text-xs text-text-muted font-display">TIME</p>
                <p className="text-2xl font-display text-text-primary">
                  {formatTime(sessionDuration)}
                </p>
              </div>

              {/* Graded Count */}
              <div className="text-right">
                <p className="text-xs text-text-muted font-display">GRADED</p>
                <p className="text-2xl font-display text-accent-primary">
                  {gameState.gradedSubmissionIds.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl mb-2">
            <span className="text-text-muted">SELECT YOUR</span>{' '}
            <span className="text-accent-primary">WORLD</span>
          </h2>
          <p className="text-text-muted">Each course is a new adventure</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <span className="text-6xl animate-bounce block mb-4">🗺️</span>
              <p className="text-text-muted font-display">LOADING WORLDS...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-accent-danger/20 border-2 border-accent-danger rounded-xl p-6 mb-6 text-center">
            <span className="text-4xl block mb-2">⚠️</span>
            <p className="text-accent-danger font-display">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && courses.length === 0 && !error && (
          <div className="text-center py-16">
            <span className="text-8xl block mb-4">🏰</span>
            <p className="text-text-muted font-display text-xl mb-2">NO WORLDS FOUND</p>
            <p className="text-sm text-text-muted">
              Configure your Canvas API token in .env.local
            </p>
          </div>
        )}

        {/* Course Grid - World Map Tiles */}
        {!isLoading && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => {
              const biome = getBiome(course.id);
              return (
                <button
                  key={course.id}
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  onClick={() => onSelectCourse(course)}
                  className={`
                    relative group p-6 rounded-2xl border-2 border-surface
                    bg-gradient-to-br ${biome.gradient}
                    hover:border-accent-primary hover:scale-[1.02]
                    transition-all duration-200 text-left overflow-hidden
                    stagger-item pixel-card
                  `}
                >
                  {/* Biome Icon */}
                  <div className="absolute top-4 right-4 text-5xl opacity-50 group-hover:opacity-75 transition-opacity">
                    {biome.emoji}
                  </div>

                  {/* Course Info */}
                  <div className="relative z-10">
                    <p className="text-xs text-white/60 font-display mb-1">
                      {biome.name.toUpperCase()} REALM
                    </p>
                    <h3 className="font-display text-xl text-white mb-3 pr-12 line-clamp-2">
                      {course.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-white/80">
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        <span>{course.total_students || '?'} students</span>
                      </span>
                    </div>
                  </div>

                  {/* Enter indicator */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="font-display text-sm text-accent-primary">ENTER →</span>
                  </div>

                  {/* Pixel border effect */}
                  <div className="absolute inset-0 border-4 border-transparent group-hover:border-white/20 rounded-2xl transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        {/* Demo Mode */}
        <div className="mt-12 pt-8 border-t border-surface text-center">
          <p className="text-text-muted mb-4 font-display">OR ENTER THE TRAINING GROUNDS</p>
          <button
            onClick={onStartDemo}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-accent-secondary to-accent-primary text-background rounded-xl font-display text-lg hover:opacity-90 transition-opacity"
          >
            <span className="text-2xl">🎮</span>
            <span>START DEMO MODE</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 fixed bottom-0 left-0 right-0 border-t border-surface bg-background/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between text-sm text-text-muted">
          <span className="font-display">BOSS BATTLE GRADER v0.1</span>
          <span>Franklin School D&T Department</span>
        </div>
      </footer>
    </div>
  );
}
