'use client'

import { memo } from 'react'
import { Video, Camera } from 'lucide-react'

export interface CameraBadgeProps {
  name: string
  fps?: number | string
  type?: 'video' | 'snapshot'
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
}

const positionStyles = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
}

// Camera badge component for displaying camera name and FPS
export const CameraBadge = memo(function CameraBadge({
  name,
  fps,
  type = 'video',
  position = 'top-left',
  className = '',
}: CameraBadgeProps) {
  const Icon = type === 'video' ? Video : Camera
  
  return (
    <div 
      className={`absolute ${positionStyles[position]} flex items-center gap-1.5 pointer-events-none ${className}`}
    >
      {/* Camera name badge */}
      <div 
        className="flex items-center gap-1 px-2 py-1 rounded-md text-white text-[10px] font-medium"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <Icon className="w-3 h-3" />
        <span className="truncate max-w-[120px]">{name}</span>
      </div>
      
      {/* FPS badge */}
      {fps !== undefined && (
        <div 
          className="px-1.5 py-1 rounded-md text-white text-[10px] font-bold"
          style={{
            backgroundColor: type === 'video' 
              ? 'rgba(49, 106, 197, 0.9)' // Blue for live video
              : 'rgba(76, 175, 80, 0.9)',  // Green for snapshots
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          {typeof fps === 'number' ? `${fps}fps` : fps}
        </div>
      )}
    </div>
  )
})

export default CameraBadge
