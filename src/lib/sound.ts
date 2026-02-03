// =============================================================================
// Sound Service - 8-bit Chiptune Effects with Tone.js
// =============================================================================
// Singleton pattern with proper initialization, race condition protection,
// and cleanup for browser autoplay policy compliance.

import type * as ToneType from 'tone';

export type SoundEffect = 'success' | 'click' | 'fail' | 'levelUp' | 'unlock' | 'encounter';

// State machine for initialization
const STATE = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

type State = (typeof STATE)[keyof typeof STATE];

const SOUND_PREFERENCE_KEY = 'boss-battle-sound-enabled';

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

  private constructor() {
    // Load saved preference on construction
    this.enabled = this.loadPreference();
  }

  /**
   * Load sound preference from localStorage.
   */
  private loadPreference(): boolean {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_PREFERENCE_KEY);
    return stored !== 'false'; // Default to enabled
  }

  /**
   * Save sound preference to localStorage.
   */
  private savePreference(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  }

  /**
   * Initialize the audio context. Must be called from a user gesture (click/tap).
   * Multiple calls coalesce onto the same promise (race condition safe).
   */
  async init(): Promise<boolean> {
    // Already ready
    if (this.state === STATE.READY) return true;
    if (this.state === STATE.FAILED) return false;

    // Coalesce multiple callers onto same promise (race condition fix)
    if (this.state === STATE.INITIALIZING && this.initPromise) {
      await this.initPromise;
      // After await, state may have changed - use fresh read
      return (this.state as State) === STATE.READY;
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

  /**
   * Play a sound effect. Silently fails if not initialized or disabled.
   */
  play(effect: SoundEffect): void {
    if (this.state !== STATE.READY || !this.enabled || !this.synth || !this.Tone) {
      return;
    }

    const now = this.Tone.now();

    switch (effect) {
      case 'success':
        // Ascending arpeggio - victory/grade submitted
        this.synth.triggerAttackRelease('C5', '16n', now);
        this.synth.triggerAttackRelease('E5', '16n', now + 0.08);
        this.synth.triggerAttackRelease('G5', '16n', now + 0.16);
        this.synth.triggerAttackRelease('C6', '8n', now + 0.24);
        break;
      case 'click':
        // Single high note - UI interaction
        this.synth.triggerAttackRelease('G5', '32n', now);
        break;
      case 'fail':
        // Descending notes - combo break
        this.synth.triggerAttackRelease('E4', '8n', now);
        this.synth.triggerAttackRelease('C4', '4n', now + 0.15);
        break;
      case 'levelUp':
        // Triumphant ascending fanfare - level up celebration
        this.synth.triggerAttackRelease('C4', '8n', now);
        this.synth.triggerAttackRelease('E4', '8n', now + 0.1);
        this.synth.triggerAttackRelease('G4', '8n', now + 0.2);
        this.synth.triggerAttackRelease('C5', '8n', now + 0.3);
        this.synth.triggerAttackRelease('E5', '8n', now + 0.4);
        this.synth.triggerAttackRelease('G5', '4n', now + 0.5);
        break;
      case 'unlock':
        // Single bright tone - feature unlocked
        this.synth.triggerAttackRelease('E6', '16n', now);
        this.synth.triggerAttackRelease('G6', '8n', now + 0.05);
        break;
      case 'encounter':
        // Quick dramatic intro - student encounter
        this.synth.triggerAttackRelease('D4', '16n', now);
        this.synth.triggerAttackRelease('A4', '16n', now + 0.08);
        this.synth.triggerAttackRelease('D5', '8n', now + 0.16);
        break;
    }
  }

  /**
   * Enable or disable sound globally. Persists to localStorage.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.savePreference(enabled);
  }

  /**
   * Get current enabled state.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if sound is ready to play.
   */
  isReady(): boolean {
    return this.state === STATE.READY;
  }

  /**
   * Clean up all audio resources. Call on app unmount.
   */
  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
    this.Tone = null;
    this.state = STATE.UNINITIALIZED;
    this.initPromise = null;
  }
}

export const soundService = SoundService.getInstance();
