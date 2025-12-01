'use client'

import { memo, useState, useCallback } from 'react'
import { CameraBadge } from './camera-badge'

export type CameraFeedType = 'video' | 'snapshot'

export interface CameraFeedProps {
  id: string
  name: string
  url: string
  type: CameraFeedType
  fps?: number | string
  aspectRatio?: string
  chromaColor?: string
  showBadge?: boolean
  badgePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
  timestamp?: number // For snapshot refresh
  fillContainer?: boolean // When true, fills parent container without aspect ratio constraint
}

// Camera feed component with badge overlay
export const CameraFeed = memo(function CameraFeed({
  id,
  name,
  url,
  type,
  fps,
  aspectRatio = '16:9',
  chromaColor,
  showBadge = true,
  badgePosition = 'top-left',
  className = '',
  timestamp,
  fillContainer = false,
}: CameraFeedProps) {
  const [hasError, setHasError] = useState(false)
  
  // Check if URL is empty (like chroma backgrounds)
  const hasUrl = url && url.trim() !== ''
  
  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  const handleLoad = useCallback(() => {
    setHasError(false)
  }, [])

  // Calculate aspect ratio CSS value
  const getAspectRatio = () => {
    switch (aspectRatio) {
      case '16:9': return '16/9'
      case '4:3': return '4/3'
      case '1:1': return '1/1'
      default: return '16/9'
    }
  }

  // Build the full URL with timestamp for snapshots
  const getSourceUrl = () => {
    if (type === 'snapshot' && timestamp) {
      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}t=${timestamp}`
    }
    return url
  }

  return (
    <div 
      className={`camera-feed relative w-full ${fillContainer ? 'h-full' : ''} ${className}`}
      style={{
        backgroundColor: chromaColor || '#000000',
        ...(fillContainer ? {} : { aspectRatio: getAspectRatio() }),
      }}
      data-camera-id={id}
    >
      {/* Only render img if we have a URL */}
      {hasUrl && (
        type === 'video' ? (
          <img
            src={getSourceUrl()}
            alt=""
            className="w-full h-full object-cover"
            onError={handleError}
            onLoad={handleLoad}
            style={{
              display: hasError ? 'none' : 'block',
            }}
          />
        ) : (
          <img
            src={getSourceUrl()}
            alt={`${name} snapshot`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleError}
            onLoad={handleLoad}
            style={{
              display: hasError ? 'none' : 'block',
            }}
          />
        )
      )}
      
      {/* Error state - only show if we have URL and it failed */}
      {hasUrl && hasError && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
          <span>Camera unavailable</span>
        </div>
      )}
      
      {/* Badge overlay */}
      {showBadge && (
        <CameraBadge
          name={name}
          fps={fps}
          type={type}
          position={badgePosition}
        />
      )}
    </div>
  )
})

export default CameraFeed
