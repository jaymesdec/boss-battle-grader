'use client';

// =============================================================================
// RadarChart - 9-axis TD Competency Visualization
// =============================================================================

import { useMemo } from 'react';
import { COMPETENCY_ORDER, COMPETENCIES } from '@/lib/competencies';
import { GRADE_VALUES } from '@/types';
import type { CompetencyId, Grade } from '@/types';

interface RadarChartProps {
  grades: Partial<Record<CompetencyId, Grade>>;
  size?: number;
  showLabels?: boolean;
  animated?: boolean;
}

export function RadarChart({
  grades,
  size = 200,
  showLabels = true,
  animated = true,
}: RadarChartProps) {
  const center = size / 2;
  const radius = (size / 2) * 0.75;
  const labelRadius = (size / 2) * 0.92;

  // Calculate points for the radar chart
  const points = useMemo(() => {
    const angleStep = (2 * Math.PI) / 9;
    const startAngle = -Math.PI / 2; // Start from top

    return COMPETENCY_ORDER.map((competencyId, index) => {
      const angle = startAngle + index * angleStep;
      const grade = grades[competencyId];
      const value = grade ? GRADE_VALUES[grade] / 100 : 0;
      const competency = COMPETENCIES[competencyId];

      return {
        id: competencyId,
        name: competency.name,
        emoji: competency.emoji,
        color: competency.color,
        angle,
        value,
        x: center + Math.cos(angle) * radius * value,
        y: center + Math.sin(angle) * radius * value,
        labelX: center + Math.cos(angle) * labelRadius,
        labelY: center + Math.sin(angle) * labelRadius,
        gridX: center + Math.cos(angle) * radius,
        gridY: center + Math.sin(angle) * radius,
      };
    });
  }, [grades, center, radius, labelRadius]);

  // Build the polygon path
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Build grid lines (circles at 25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
    >
      {/* Background grid circles */}
      {gridLevels.map((level) => (
        <circle
          key={level}
          cx={center}
          cy={center}
          r={radius * level}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {points.map((point) => (
        <line
          key={`axis-${point.id}`}
          x1={center}
          y1={center}
          x2={point.gridX}
          y2={point.gridY}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="url(#radarGradient)"
        fillOpacity={0.3}
        stroke="url(#radarStroke)"
        strokeWidth={2}
        className={animated ? 'transition-all duration-300 ease-out' : ''}
      />

      {/* Data points */}
      {points.map((point) => (
        <circle
          key={`point-${point.id}`}
          cx={point.x}
          cy={point.y}
          r={point.value > 0 ? 4 : 0}
          fill={point.color}
          className={animated ? 'transition-all duration-300 ease-out' : ''}
        />
      ))}

      {/* Labels */}
      {showLabels &&
        points.map((point) => (
          <text
            key={`label-${point.id}`}
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-current opacity-70"
            style={{ fontSize: size < 150 ? '8px' : '10px' }}
          >
            {point.emoji}
          </text>
        ))}

      {/* Gradient definitions */}
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FFAA" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FFAA" />
          <stop offset="50%" stopColor="#4ECDC4" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// =============================================================================
// Mini Radar Chart (for queue items)
// =============================================================================

export function MiniRadarChart({
  grades,
}: {
  grades: Partial<Record<CompetencyId, Grade>>;
}) {
  return <RadarChart grades={grades} size={40} showLabels={false} />;
}
