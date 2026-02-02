'use client';

// =============================================================================
// SubmissionViewerOverlay - Fullscreen view of student submission
// =============================================================================

import { useEffect, ReactNode } from 'react';

interface SubmissionViewerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function SubmissionViewerOverlay({
  isOpen,
  onClose,
  title = 'STUDENT SUBMISSION',
  children,
}: SubmissionViewerOverlayProps) {
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Full screen with small margin */}
      <div className="relative w-full h-full m-4 bg-background border border-surface rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface">
          <div className="flex items-center gap-2">
            <span className="text-accent-primary">📋</span>
            <span className="font-display text-sm text-text-primary">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface transition-colors text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Content - fill available space */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
