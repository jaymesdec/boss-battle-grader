// =============================================================================
// useSound Hook - React integration for sound service
// =============================================================================

import { useCallback, useEffect, useRef } from 'react';
import { soundService, type SoundEffect } from '@/lib/sound';

/**
 * Hook for playing sound effects in React components.
 * Handles lazy initialization on first play (requires user gesture context).
 *
 * @param enabled - Whether sound is enabled (from gameState.soundEnabled)
 * @returns Object with play function
 */
export function useSound(enabled: boolean) {
  const initAttempted = useRef(false);

  // Sync enabled state with sound service
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

export type { SoundEffect };
