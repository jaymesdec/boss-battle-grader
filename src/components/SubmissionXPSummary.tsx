'use client';

// =============================================================================
// SubmissionXPSummary - Post-submission XP breakdown modal
// =============================================================================

import { useState, useEffect } from 'react';
import { formatXP } from '@/lib/game';

export interface XPBreakdown {
  engagement: number;
  specificity: number;
  personalization: number;
  baseTotal: number;
  timelinessMultiplier: number;
  comboMultiplier: number;
  finalTotal: number;
  completenessBonus?: number;
}

interface SubmissionXPSummaryProps {
  studentName: string;
  xpBreakdown: XPBreakdown;
  onContinue: () => void;
  isLastSubmission?: boolean;
}

export function SubmissionXPSummary({
  studentName,
  xpBreakdown,
  onContinue,
  isLastSubmission = false,
}: SubmissionXPSummaryProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate entrance
  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timeout);
  }, []);

  // Handle keyboard shortcut (Enter or Space to continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onContinue]);

  const {
    engagement,
    specificity,
    personalization,
    baseTotal,
    timelinessMultiplier,
    comboMultiplier,
    finalTotal,
    completenessBonus,
  } = xpBreakdown;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/80 backdrop-blur-sm
        transition-opacity duration-300
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onContinue}
    >
      <div
        className={`
          bg-gradient-to-br from-surface to-background
          border-2 border-accent-gold/50 rounded-2xl
          p-6 max-w-md w-full shadow-2xl
          transition-all duration-300
          ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">
            {isLastSubmission ? '🏆' : '⚔️'}
          </span>
          <h2 className="font-display text-xl text-accent-gold">
            {isLastSubmission ? 'ASSIGNMENT COMPLETE!' : 'GRADING COMPLETE'}
          </h2>
          <p className="text-text-muted text-sm mt-1">{studentName}</p>
        </div>

        {/* XP Breakdown */}
        <div className="bg-background/50 rounded-xl p-4 mb-4 space-y-2">
          {/* Category rows */}
          <XPRow
            icon="👁️"
            label="Engagement"
            value={engagement}
            dimmed={engagement === 0}
          />
          <XPRow
            icon="🎯"
            label="Specificity"
            value={specificity}
            dimmed={specificity === 0}
          />
          <XPRow
            icon="✍️"
            label="Personalization"
            value={personalization}
            dimmed={personalization === 0}
          />

          {/* Divider */}
          <div className="border-t border-surface my-2" />

          {/* Base total */}
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Base Total</span>
            <span className="text-text-primary font-display">
              {formatXP(baseTotal)} XP
            </span>
          </div>

          {/* Multipliers */}
          {timelinessMultiplier !== 1.0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted flex items-center gap-1">
                <span>⏰</span> Timeliness
              </span>
              <span
                className={
                  timelinessMultiplier > 1
                    ? 'text-accent-secondary'
                    : 'text-accent-danger'
                }
              >
                ×{timelinessMultiplier.toFixed(1)}
              </span>
            </div>
          )}

          {comboMultiplier > 1.0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted flex items-center gap-1">
                <span>🔥</span> Combo
              </span>
              <span className="text-accent-primary">
                ×{comboMultiplier.toFixed(2)}
              </span>
            </div>
          )}

          {/* Completeness bonus */}
          {completenessBonus && completenessBonus > 0 && (
            <>
              <div className="border-t border-surface my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-accent-gold flex items-center gap-1">
                  <span>🏆</span> Completeness Bonus
                </span>
                <span className="text-accent-gold font-display">
                  +{formatXP(completenessBonus)} XP
                </span>
              </div>
            </>
          )}

          {/* Final total */}
          <div className="border-t-2 border-accent-gold/30 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-text-primary font-display text-lg">
                💰 TOTAL
              </span>
              <span className="text-accent-gold font-display text-2xl">
                +{formatXP(finalTotal)} XP
              </span>
            </div>
          </div>
        </div>

        {/* Continue button */}
        <div className="space-y-3">
          <button
            onClick={onContinue}
            className="w-full py-3 bg-gradient-to-r from-accent-secondary to-accent-primary text-background rounded-xl font-display text-sm hover:opacity-90 transition-opacity"
          >
            {isLastSubmission ? 'VIEW RESULTS' : 'NEXT STUDENT →'}
          </button>

          <p className="text-center text-xs text-text-muted">
            Press Enter or click anywhere to continue
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function XPRow({
  icon,
  label,
  value,
  dimmed = false,
}: {
  icon: string;
  label: string;
  value: number;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center ${dimmed ? 'opacity-40' : ''}`}
    >
      <span className="flex items-center gap-2 text-sm">
        <span>{icon}</span>
        <span className="text-text-primary">{label}</span>
      </span>
      <span
        className={`font-display ${dimmed ? 'text-text-muted' : 'text-accent-primary'}`}
      >
        {dimmed ? '—' : `+${formatXP(value)}`}
      </span>
    </div>
  );
}
