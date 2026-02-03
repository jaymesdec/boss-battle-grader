'use client';

// =============================================================================
// Companion - Pixel-art character for anti-pattern nudges
// =============================================================================

import { useEffect, useState } from 'react';

export type NudgeType = 'info' | 'warning' | 'celebration';

export interface CompanionProps {
  message: string | null;
  type: NudgeType;
  onDismiss: () => void;
}

// Pixel art companion (owl assistant) as inline SVG
function CompanionSprite({ type }: { type: NudgeType }) {
  const eyeColor = type === 'warning' ? '#FFD700' : type === 'celebration' ? '#00FF00' : '#00BFFF';

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 16 16"
      className="companion-sprite"
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Body */}
      <rect x="4" y="6" width="8" height="8" fill="#5D4E6D" />
      <rect x="3" y="7" width="1" height="6" fill="#5D4E6D" />
      <rect x="12" y="7" width="1" height="6" fill="#5D4E6D" />

      {/* Head */}
      <rect x="3" y="2" width="10" height="5" fill="#8B7B9B" />
      <rect x="2" y="3" width="1" height="3" fill="#8B7B9B" />
      <rect x="13" y="3" width="1" height="3" fill="#8B7B9B" />

      {/* Ears */}
      <rect x="2" y="1" width="2" height="2" fill="#8B7B9B" />
      <rect x="12" y="1" width="2" height="2" fill="#8B7B9B" />

      {/* Eyes */}
      <rect x="4" y="4" width="3" height="2" fill="#FFFFFF" />
      <rect x="9" y="4" width="3" height="2" fill="#FFFFFF" />
      <rect x="5" y="4" width="1" height="1" fill={eyeColor} />
      <rect x="10" y="4" width="1" height="1" fill={eyeColor} />

      {/* Beak */}
      <rect x="7" y="6" width="2" height="1" fill="#FFA500" />

      {/* Feet */}
      <rect x="5" y="14" width="2" height="1" fill="#FFA500" />
      <rect x="9" y="14" width="2" height="1" fill="#FFA500" />

      {/* Wings (small bumps on sides) */}
      <rect x="2" y="9" width="1" height="3" fill="#6D5D7D" />
      <rect x="13" y="9" width="1" height="3" fill="#6D5D7D" />
    </svg>
  );
}

export function Companion({ message, type, onDismiss }: CompanionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      setIsExiting(false);

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      onDismiss();
    }, prefersReducedMotion ? 0 : 300);
  };

  if (!message || !isVisible) return null;

  const bubbleColors = {
    info: 'border-blue-400 bg-blue-900/90',
    warning: 'border-yellow-400 bg-yellow-900/90',
    celebration: 'border-green-400 bg-green-900/90',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-end gap-2 transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      } ${prefersReducedMotion ? '' : 'animate-bounce-gentle'}`}
      onClick={handleDismiss}
      role="alert"
      aria-live="polite"
    >
      {/* Speech bubble */}
      <div
        className={`relative max-w-xs rounded-lg border-2 px-4 py-3 shadow-lg cursor-pointer ${bubbleColors[type]}`}
      >
        {/* Tail pointing to companion */}
        <div
          className={`absolute -right-2 bottom-4 h-4 w-4 rotate-45 border-b-2 border-r-2 ${bubbleColors[type]}`}
          style={{ clipPath: 'polygon(0 0, 100% 100%, 100% 0)' }}
        />

        <p className="font-mono text-sm text-white leading-relaxed">{message}</p>

        <p className="mt-2 text-xs text-white/60 text-right">click to dismiss</p>
      </div>

      {/* Companion sprite */}
      <div className={prefersReducedMotion ? '' : 'animate-hover'}>
        <CompanionSprite type={type} />
      </div>
    </div>
  );
}
