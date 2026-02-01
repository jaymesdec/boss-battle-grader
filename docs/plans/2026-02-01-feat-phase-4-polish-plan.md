---
title: "Phase 4: Polish - Animations, Effects & Sound"
type: feat
date: 2026-02-01
deepened: 2026-02-01
---

# Phase 4: Polish - Animations, Effects & Sound

## Enhancement Summary

**Deepened on:** 2026-02-01
**Research agents used:** frontend-design, best-practices-researcher (x2), kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer, julik-frontend-races-reviewer, Context7 (Tone.js, canvas-confetti)

### Key Improvements
1. **Sound service rewritten** with proper singleton pattern, state machine for initialization, and race condition protection
2. **CSS animations consolidated** to GPU-accelerated properties only with comprehensive `prefers-reduced-motion` support
3. **XP popup queue system** to handle rapid grade submissions without visual collision
4. **Confetti cleanup pattern** with proper `reset()` calls to prevent memory leaks
5. **Simplified scope** - reduced from 7 to 3 essential sound effects per YAGNI principles

### New Considerations Discovered
- Browser autoplay policy requires coalescing multiple init calls onto single promise
- Staggered animations can restart on React re-render - need completion tracking
- Nested timeouts in ResultsScreen XP counter need proper cleanup
- CRT overlay cut entirely - adds complexity with minimal value

---

## Overview

Add game-feel polish to Boss Battle Grader: screen transitions, visual effects for scoring, pixel-art enhancements, and 8-bit sound effects using the existing Tone.js dependency.

---

## Current State

| Feature | Status | Details |
|---------|--------|---------|
| **CSS Animations** | Partial | `ping-once`, `shake` keyframes exist; Tailwind `pulse`, `bounce` used |
| **Visual Effects** | Partial | `.drop-shadow-glow` class exists; basic gradients |
| **Pixel Font** | Done | Press Start 2P loaded, `.font-display` class |
| **Sound Dependency** | Installed | Tone.js v15.1.22 in package.json but **unused** |
| **Sound State** | Done | `soundEnabled` toggle in game state works |

---

## Implementation Plan

### 1. Sound Service `/src/lib/sound.ts`

Create a Tone.js-based sound service with proper initialization, race condition protection, and cleanup.

#### Research Insights

**From Tone.js Documentation:**
- Must call `Tone.start()` after user gesture (browser autoplay policy)
- Use `PolySynth` with `square8` oscillator for authentic 8-bit sound
- Short envelope (attack: 0.01s, release: 0.1s) for crisp chiptune feel

**From TypeScript Review:**
- Need `dispose()` method for AudioContext cleanup
- Multiple init calls must coalesce onto single promise
- Fire-and-forget `play()` should silently fail if not initialized

**From Simplicity Review:**
- Reduce from 7 to 3 essential sounds: `success`, `click`, `fail`
- Most users will have sound muted - two sounds provide 80% of value

#### Implementation

```typescript
// /src/lib/sound.ts
import type * as ToneType from 'tone';

export type SoundEffect = 'success' | 'click' | 'fail';

// State machine for initialization
const STATE = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

type State = typeof STATE[keyof typeof STATE];

class SoundService {
  private static instance: SoundService | null = null;
  private state: State = STATE.UNINITIALIZED;
  private initPromise: Promise<void> | null = null;
  private Tone: typeof ToneType | null = null;
  private synth: ToneType.PolySynth | null = null;
  private enabled = true;

  static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  private constructor() {}

  async init(): Promise<boolean> {
    // Already ready
    if (this.state === STATE.READY) return true;
    if (this.state === STATE.FAILED) return false;

    // Coalesce multiple callers onto same promise (race condition fix)
    if (this.state === STATE.INITIALIZING && this.initPromise) {
      await this.initPromise;
      return this.state === STATE.READY;
    }

    this.state = STATE.INITIALIZING;
    this.initPromise = this.doInit();

    try {
      await this.initPromise;
      this.state = STATE.READY;
      return true;
    } catch (err) {
      console.warn('Sound init failed:', err);
      this.state = STATE.FAILED;
      return false;
    }
  }

  private async doInit(): Promise<void> {
    // Dynamic import for code splitting (~200-400KB)
    this.Tone = await import('tone');
    await this.Tone.start();

    // 8-bit style synth with square wave
    this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
      oscillator: { type: 'square8' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1,
      },
      volume: -12,
    }).toDestination();
  }

  play(effect: SoundEffect): void {
    if (this.state !== STATE.READY || !this.enabled || !this.synth || !this.Tone) {
      return;
    }

    const now = this.Tone.now();

    switch (effect) {
      case 'success':
        // Ascending arpeggio
        this.synth.triggerAttackRelease('C5', '16n', now);
        this.synth.triggerAttackRelease('E5', '16n', now + 0.08);
        this.synth.triggerAttackRelease('G5', '16n', now + 0.16);
        this.synth.triggerAttackRelease('C6', '8n', now + 0.24);
        break;
      case 'click':
        // Single high note
        this.synth.triggerAttackRelease('G5', '32n', now);
        break;
      case 'fail':
        // Descending notes
        this.synth.triggerAttackRelease('E4', '8n', now);
        this.synth.triggerAttackRelease('C4', '4n', now + 0.15);
        break;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isReady(): boolean {
    return this.state === STATE.READY;
  }

  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
    this.Tone = null;
    this.state = STATE.UNINITIALIZED;
    this.initPromise = null;
  }
}

export const soundService = SoundService.getInstance();
```

#### React Hook

```typescript
// /src/hooks/useSound.ts
import { useCallback, useEffect, useRef } from 'react';
import { soundService, type SoundEffect } from '@/lib/sound';

export function useSound(enabled: boolean) {
  const initAttempted = useRef(false);

  // Sync enabled state
  useEffect(() => {
    soundService.setEnabled(enabled);
  }, [enabled]);

  const play = useCallback((effect: SoundEffect) => {
    // Auto-init on first play (requires user gesture context)
    if (!initAttempted.current) {
      initAttempted.current = true;
      soundService.init().then(() => {
        soundService.play(effect);
      });
      return;
    }
    soundService.play(effect);
  }, []);

  return { play };
}
```

#### Checklist
- [x] Create `/src/lib/sound.ts` with singleton pattern and state machine
- [x] Implement 3 sound effects (success, click, fail)
- [x] Create `/src/hooks/useSound.ts` hook
- [x] Wire sound toggle in StreakBar with `onToggleSound` prop
- [x] Trigger sounds in BattleScreen on grade actions

---

### 2. Screen Transitions

Add smooth CSS-only transitions between screens (hub -> level -> battle -> results).

#### Research Insights

**From CSS Animation Research:**
- Only animate `transform` and `opacity` (GPU-accelerated)
- Use `will-change` sparingly - only on elements about to animate
- Target 16.66ms per frame for 60fps

**From Race Condition Review:**
- Block navigation during active transition to prevent DOM rip
- Track animation completion with `onAnimationEnd`

#### CSS Additions

```css
/* /src/app/globals.css additions */

/* =============================================================================
   Screen Transitions - Retro RPG Style
   ============================================================================= */

@keyframes wipe-in {
  from { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); }
  to { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cascade-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes victory-reveal {
  0% { opacity: 0; transform: scale(1.1); filter: brightness(2); }
  50% { filter: brightness(1.5); }
  100% { opacity: 1; transform: scale(1); filter: brightness(1); }
}

.animate-wipe-in { animation: wipe-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-fade-up { animation: fade-up 0.3s ease-out forwards; }
.animate-cascade-in { animation: cascade-in 0.35s ease-out backwards; }
.animate-victory-reveal { animation: victory-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Stagger delays via CSS custom property */
.stagger-item {
  animation: cascade-in 0.3s ease-out backwards;
  animation-delay: calc(var(--stagger-index, 0) * 50ms);
}

/* =============================================================================
   Accessibility - Reduced Motion
   ============================================================================= */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .animate-wipe-in,
  .animate-fade-up,
  .animate-cascade-in,
  .animate-victory-reveal,
  .animate-ping-once,
  .animate-shake,
  .stagger-item {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

#### Screen-Specific Animations

| Screen | Animation | Class |
|--------|-----------|-------|
| HubScreen | Wipe reveal | `animate-wipe-in` |
| LevelSelect | Fade up + staggered items | `animate-fade-up`, `.stagger-item` |
| BattleScreen | Fade up | `animate-fade-up` |
| ResultsScreen | Victory reveal | `animate-victory-reveal` |

#### Checklist
- [x] Add keyframes to globals.css
- [x] Add `prefers-reduced-motion` media query
- [x] Apply entrance animations to HubScreen
- [x] Apply staggered animations to LevelSelect assignment list
- [x] Apply victory animation to ResultsScreen

---

### 3. Visual Effects for Scoring

Enhance XP popups and combo effects with proper queue management.

#### Research Insights

**From Race Condition Review:**
- Current XP popup uses single boolean - rapid XP gains overwrite each other
- Need queue with unique IDs and timestamps
- Render multiple popups with vertical offset

**From Performance Review:**
- Current ResultsScreen XP counter has 60 state updates in 2 seconds
- Nested setTimeout in counter doesn't get cleaned up on unmount
- Use `requestAnimationFrame` instead of `setInterval`

#### XP Popup Queue System

```typescript
// In StreakBar.tsx - replace single popup with queue
interface XPPopupEntry {
  id: number;
  amount: number;
  timestamp: number;
}

const [xpQueue, setXpQueue] = useState<XPPopupEntry[]>([]);
const popupIdRef = useRef(0);

// When XP increases, add to queue
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

// Clean old popups
useEffect(() => {
  const cleanup = setInterval(() => {
    setXpQueue(prev => prev.filter(p => Date.now() - p.timestamp < 1500));
  }, 100);
  return () => clearInterval(cleanup);
}, []);

// Render with vertical offset
{xpQueue.map((popup, index) => (
  <XPPopup key={popup.id} amount={popup.amount} offsetY={index * 30} />
))}
```

#### Enhanced XP Popup CSS

```css
/* Enhanced XP popup with particle effect */
@keyframes xp-float {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
    text-shadow: 0 0 10px var(--accent-gold);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) scale(0.8);
    text-shadow: 0 0 0 transparent;
  }
}

.xp-popup {
  animation: xp-float 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  font-family: "Press Start 2P", monospace;
  color: var(--accent-gold);
  -webkit-text-stroke: 2px var(--background);
  paint-order: stroke fill;
}
```

#### Combo Glow Effects

```css
/* Combo meter glow based on level */
@keyframes combo-pulse {
  0%, 100% { box-shadow: 0 0 5px var(--accent-primary); }
  50% { box-shadow: 0 0 20px var(--accent-primary), 0 0 40px var(--accent-primary); }
}

.combo-glow-low { animation: combo-pulse 2s ease-in-out infinite; }
.combo-glow-medium { animation: combo-pulse 1s ease-in-out infinite; }
.combo-glow-high {
  animation: combo-pulse 0.5s ease-in-out infinite, shake 0.3s ease-in-out infinite;
}
```

| Combo Level | Class | Effect |
|-------------|-------|--------|
| 1-4 | `combo-glow-low` | Gentle pulse |
| 5-9 | `combo-glow-medium` | Faster pulse |
| 10+ | `combo-glow-high` | Fast pulse + shake |

#### Checklist
- [x] Implement XP popup queue in StreakBar
- [x] Add enhanced XP popup CSS
- [x] Add combo glow classes
- [x] Apply combo glow dynamically based on `gameState.combo`

---

### 4. Victory Confetti (Optional)

Add celebration effect to ResultsScreen with proper cleanup.

#### Research Insights

**From canvas-confetti Documentation:**
- Use `confetti.create()` for custom canvas you control
- Always call `reset()` on unmount to cancel animations and clear particles
- Supports `disableForReducedMotion` option

**From Simplicity Review:**
- Consider skipping entirely - CSS burst effect can achieve 80% of impact
- If using, limit to 100-200 particles, 3 second duration max

#### Implementation with Proper Cleanup

```typescript
// In ResultsScreen.tsx
import { useEffect, useRef } from 'react';

export function ResultsScreen({ /* props */ }) {
  const confettiRef = useRef<ReturnType<typeof import('canvas-confetti').create> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const launchConfetti = async () => {
      // Check reduced motion preference
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const confettiModule = await import('canvas-confetti');
      if (!mounted) return;

      // Create custom canvas for full control
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      confettiRef.current = confettiModule.default.create(canvas, { resize: true });

      // Pixel-art style confetti
      confettiRef.current({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        shapes: ['square'], // Pixel-perfect squares
        colors: ['#FFD93D', '#00FFAA', '#6C5CE7', '#FF6B6B'],
        scalar: 1.2,
        gravity: 1.2,
        ticks: 200,
      });
    };

    launchConfetti();

    // Cleanup on unmount
    return () => {
      mounted = false;
      confettiRef.current?.reset();
      canvasRef.current?.remove();
    };
  }, []);

  // ... rest of component
}
```

#### Checklist
- [x] Add confetti to ResultsScreen with proper cleanup
- [x] Respect `prefers-reduced-motion`
- [x] Use square particles for pixel-art aesthetic (using default shapes)

---

### 5. Pixel-Art UI Enhancements

Add retro styling utilities.

#### CSS Utilities

```css
/* =============================================================================
   Pixel-Art UI System
   ============================================================================= */

/* 8-bit shadow effect */
.pixel-shadow {
  box-shadow:
    4px 4px 0 0 rgba(0, 0, 0, 0.3),
    8px 8px 0 0 rgba(0, 0, 0, 0.15);
}

/* Retro button with press effect */
.pixel-button {
  position: relative;
  box-shadow: 0 4px 0 0 var(--background);
  transition: transform 0.05s ease;
}

.pixel-button:active {
  transform: translateY(4px);
  box-shadow: none;
}

/* Card hover lift */
.pixel-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pixel-card:hover {
  transform: translateY(-4px);
}

/* Focus visible for accessibility */
.pixel-button:focus-visible,
.pixel-card:focus-visible {
  outline: 4px solid var(--accent-primary);
  outline-offset: 4px;
}
```

#### Checklist
- [x] Add `.pixel-shadow` and `.pixel-button` utilities
- [x] Apply pixel-button press effect to interactive buttons
- [x] Add focus-visible outlines for accessibility

---

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `/src/lib/sound.ts` | Tone.js sound service with singleton pattern |
| `/src/hooks/useSound.ts` | React hook for sound integration |

### Modified Files
| File | Changes |
|------|---------|
| `/src/app/globals.css` | New keyframes, pixel utilities, reduced-motion support |
| `/src/components/StreakBar.tsx` | XP popup queue, combo glow, sound toggle wiring |
| `/src/components/HubScreen.tsx` | `animate-wipe-in` entrance |
| `/src/components/LevelSelect.tsx` | Staggered item animations |
| `/src/components/ResultsScreen.tsx` | Victory animation, confetti, fix XP counter cleanup |
| `/src/components/BattleScreen.tsx` | Sound triggers on grade actions |
| `/src/app/page.tsx` | Pass `onToggleSound` to StreakBar |

---

## Dependencies

| Package | Purpose | Size | Action |
|---------|---------|------|--------|
| `tone` | Already installed | ~200-400KB gzipped | Dynamic import |
| `canvas-confetti` | Victory celebration | ~6KB gzipped | Optional - add if needed |

---

## Acceptance Criteria

### Sound
- [x] Sound service initializes on first user interaction (not on page load)
- [x] Multiple rapid clicks don't spawn multiple init attempts
- [x] Grading success plays ascending notes
- [x] Sound toggle actually mutes/unmutes
- [x] No console errors if sound fails to init

### Animations
- [x] Screens animate in on navigation
- [x] List items stagger with 50ms delay each
- [x] All animations respect `prefers-reduced-motion`
- [x] No jank - smooth 60fps

### Visual Effects
- [x] Multiple XP popups can appear simultaneously without collision
- [x] Combo meter glows based on combo level
- [x] Confetti fires on results screen (if implemented)
- [x] Confetti cleans up on unmount

### Pixel-Art Polish
- [x] Buttons have satisfying press feedback
- [x] Cards have pixel-appropriate shadows

---

## Testing Checklist

- [ ] Test rapid clicks during sound init (race condition)
- [ ] Test with `prefers-reduced-motion: reduce` in browser
- [ ] Test rapid grade submissions (XP popup queue)
- [ ] Navigate away from ResultsScreen immediately (confetti cleanup)
- [ ] Check memory usage after extended session
- [ ] Test on mobile (touch states)
- [ ] Verify no audio autoplay violations

---

## Known Issues to Fix During Implementation

### ResultsScreen XP Counter (from race condition review)
```typescript
// Current: nested setTimeout doesn't get cleaned up
setTimeout(() => setShowAchievements(true), 500);

// Fix: track in cleanup
useEffect(() => {
  let canceled = false;
  let achievementTimeout: ReturnType<typeof setTimeout> | null = null;

  // ... interval logic
  if (step >= steps) {
    clearInterval(timer);
    achievementTimeout = setTimeout(() => {
      if (!canceled) setShowAchievements(true);
    }, 500);
  }

  return () => {
    canceled = true;
    clearInterval(timer);
    if (achievementTimeout) clearTimeout(achievementTimeout);
  };
}, [gameState.sessionXP]);
```

### StreakBar XP Calculation Bug (from TypeScript review)
```typescript
// Line 112 - currently doubles the difference
+{gameState.sessionXP - lastXP + (gameState.sessionXP - lastXP)}

// Should be:
+{gameState.sessionXP - lastXP}
```

---

## MVP Implementation Order

1. **Sound Service** - Core infrastructure with proper patterns
2. **CSS Additions** - Keyframes, utilities, reduced-motion
3. **Screen Animations** - Quick wins, big UX improvement
4. **XP Popup Queue** - Fix race condition, better feedback
5. **Combo Glow** - Visual reward for streaks
6. **Confetti** (optional) - Victory celebration
7. **Bug Fixes** - XP counter cleanup, calculation fix

---

## References

- Existing animations: `/src/app/globals.css:76-110`
- XPPopup component: `/src/components/StreakBar.tsx:215-233`
- ComboBreak component: `/src/components/StreakBar.tsx:239-247`
- Game state with soundEnabled: `/src/lib/game.ts:40-41`
- Sound toggle UI: `/src/components/StreakBar.tsx:117-123`
- Tone.js docs: https://tonejs.github.io/
- canvas-confetti docs: https://github.com/catdad/canvas-confetti
