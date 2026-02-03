'use client';

// =============================================================================
// ImageSelectionControls - Bulk selection controls for images
// =============================================================================

interface ImageSelectionControlsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  label?: string;
}

export function ImageSelectionControls({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  label = 'images',
}: ImageSelectionControlsProps) {
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-text-muted">
      <span>
        {selectedCount} of {totalCount} {label} selected for AI
      </span>
      <span className="text-text-muted/50">|</span>
      <button
        onClick={onSelectAll}
        disabled={selectedCount === totalCount}
        className={`
          transition-colors
          ${selectedCount === totalCount
            ? 'text-text-muted/50 cursor-not-allowed'
            : 'text-accent-primary hover:underline'
          }
        `}
      >
        Select All
      </button>
      <span className="text-text-muted/50">|</span>
      <button
        onClick={onDeselectAll}
        disabled={selectedCount === 0}
        className={`
          transition-colors
          ${selectedCount === 0
            ? 'text-text-muted/50 cursor-not-allowed'
            : 'text-accent-primary hover:underline'
          }
        `}
      >
        Deselect All
      </button>
    </div>
  );
}
