'use client';

// =============================================================================
// ImageSelectionCheckbox - Overlay checkbox for toggling image inclusion in AI
// =============================================================================

interface ImageSelectionCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ImageSelectionCheckbox({
  checked,
  onChange,
  className = '',
}: ImageSelectionCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange(!checked);
      }}
      className={`
        absolute top-2 left-2 z-20 w-6 h-6 rounded border-2
        flex items-center justify-center
        bg-white/80 backdrop-blur-sm transition-all
        hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
        ${checked
          ? 'border-accent-primary bg-accent-primary text-white'
          : 'border-gray-400 bg-white/80 text-transparent'
        }
        ${className}
      `}
      aria-checked={checked}
      role="checkbox"
      aria-label={checked ? 'Image selected for AI' : 'Image not selected for AI'}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span className="text-sm font-bold">✓</span>
    </button>
  );
}
