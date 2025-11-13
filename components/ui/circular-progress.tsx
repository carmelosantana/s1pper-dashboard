'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number;
  renderLabel?: (progress: number) => number | string;
  size?: number;
  strokeWidth?: number;
  circleStrokeWidth?: number;
  progressStrokeWidth?: number;
  shape?: 'square' | 'round';
  className?: string;
  progressClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
  // Temperature-specific props
  currentTemp?: number;
  targetTemp?: number;
  isTemperatureMode?: boolean;
  // Disabled state for non-printing
  disabled?: boolean;
}

const CircularProgress = ({
  value,
  renderLabel,
  className,
  progressClassName,
  labelClassName,
  showLabel,
  shape = 'round',
  size = 100,
  strokeWidth,
  circleStrokeWidth = 10,
  progressStrokeWidth = 10,
  currentTemp,
  targetTemp,
  isTemperatureMode = false,
  disabled = false,
}: CircularProgressProps) => {
  const radius = size / 2 - 10;
  const circumference = Math.ceil(3.14 * radius * 2);
  
  // Calculate progress value and colors based on mode
  let progressValue = value;
  let progressColor = 'stroke-cyan-400';
  let baseColor = 'stroke-cyan-400/25';

  if (disabled) {
    // When disabled (not printing), use cyan for all progress bars
    progressColor = 'stroke-cyan-400';
    baseColor = 'stroke-cyan-400/25';
  } else if (isTemperatureMode && currentTemp !== undefined && targetTemp !== undefined) {
    // Temperature mode: show progress from 90% to 110% of target
    const minTemp = targetTemp * 0.9;
    const maxTemp = targetTemp * 1.1;
    const tempRange = maxTemp - minTemp;
    
    // Calculate percentage within the range (0-100%)
    progressValue = Math.max(0, Math.min(100, ((currentTemp - minTemp) / tempRange) * 100));
    
    // Color based on temperature vs target
    if (currentTemp < targetTemp * 0.95) {
      // Below target (with 5% tolerance) - Blue
      progressColor = 'stroke-blue-500';
      baseColor = 'stroke-blue-500/25';
    } else if (currentTemp > targetTemp * 1.05) {
      // Above target (with 5% tolerance) - Red
      progressColor = 'stroke-red-500';
      baseColor = 'stroke-red-500/25';
    } else {
      // At target (within 5% tolerance) - Green
      progressColor = 'stroke-green-500';
      baseColor = 'stroke-green-500/25';
    }
  } else {
    // Regular power mode colors
    if (progressValue < 50) {
      progressColor = 'stroke-cyan-400'; // Blue for under 50
      baseColor = 'stroke-cyan-400/25';
    } else if (progressValue <= 75) {
      progressColor = 'stroke-orange-500'; // Orange for 50-75
      baseColor = 'stroke-orange-500/25';
    } else {
      progressColor = 'stroke-red-500'; // Red for over 75
      baseColor = 'stroke-red-500/25';
    }
  }

  const percentage = Math.ceil(circumference * ((100 - progressValue) / 100));
  const viewBox = `-${size * 0.125} -${size * 0.125} ${size * 1.25} ${
    size * 1.25
  }`;

  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'rotate(-90deg)' }}
        className="relative"
      >
        {/* Base Circle */}
        <circle
          r={radius}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          strokeWidth={strokeWidth ?? circleStrokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset="0"
          className={cn(baseColor, className)}
        />

        {/* Progress */}
        <circle
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeWidth={strokeWidth ?? progressStrokeWidth}
          strokeLinecap={shape}
          strokeDashoffset={percentage}
          fill="transparent"
          strokeDasharray={circumference}
          className={cn(progressColor, progressClassName)}
        />
      </svg>
      {showLabel && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-sm font-mono',
            labelClassName
          )}
        >
          {renderLabel ? renderLabel(value) : value}
        </div>
      )}
    </div>
  );
};

export { CircularProgress };