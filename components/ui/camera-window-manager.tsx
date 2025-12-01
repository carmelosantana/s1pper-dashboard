'use client'

import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { FloatingWindow } from './floating-window'
import { DockedWindow, DockedWindowContainer, type DockedPosition } from './docked-window'
import { CameraFeed, type CameraFeedType } from './camera-feed'

export type CameraWindowPlacement = 'above' | 'below' | 'databoxes' | 'floating' | 'docked-above' | 'docked-below'

export interface CameraWindowConfig {
  id: string
  name: string
  url: string
  type: CameraFeedType
  fps?: number | string
  aspectRatio?: string
  chromaColor?: string
}

export interface CameraWindowState {
  id: string
  zIndex: number
}

export interface FloatingCameraManagerProps {
  cameras: CameraWindowConfig[]
  placement: CameraWindowPlacement
  timestamp?: number // For refreshing snapshots
  onCameraClose?: (id: string) => void
  className?: string
}

// Manager for floating camera windows with z-index handling
export const FloatingCameraManager = memo(function FloatingCameraManager({
  cameras,
  placement,
  timestamp,
  onCameraClose,
  className = '',
}: FloatingCameraManagerProps) {
  // Track z-index for each window
  const [windowStates, setWindowStates] = useState<CameraWindowState[]>([])
  const [baseZIndex, setBaseZIndex] = useState(1000)
  
  // Initialize window states when cameras change
  useEffect(() => {
    setWindowStates(cameras.map((camera, index) => ({
      id: camera.id,
      zIndex: baseZIndex + index,
    })))
  }, [cameras, baseZIndex])
  
  // Handle window focus - bring to front
  const handleWindowFocus = useCallback((id: string) => {
    setWindowStates(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex))
      return prev.map(w => 
        w.id === id 
          ? { ...w, zIndex: maxZ + 1 }
          : w
      )
    })
  }, [])
  
  // Handle window close
  const handleWindowClose = useCallback((id: string) => {
    onCameraClose?.(id)
  }, [onCameraClose])
  
  // Get z-index for a specific window
  const getZIndex = useCallback((id: string) => {
    return windowStates.find(w => w.id === id)?.zIndex || baseZIndex
  }, [windowStates, baseZIndex])
  
  // Calculate default positions spread across the screen
  const getDefaultPosition = useCallback((index: number) => {
    const offset = index * 40
    return {
      x: 100 + offset,
      y: 100 + offset,
    }
  }, [])
  
  // Only render if in floating mode
  if (placement !== 'floating') {
    return null
  }
  
  return (
    <div className={`floating-camera-manager ${className}`}>
      {cameras.map((camera, index) => (
        <FloatingWindow
          key={camera.id}
          id={camera.id}
          title={camera.name}
          defaultPosition={getDefaultPosition(index)}
          defaultSize={{ width: 400, height: 280 }}
          minWidth={200}
          minHeight={150}
          onFocus={handleWindowFocus}
          onClose={() => handleWindowClose(camera.id)}
          zIndex={getZIndex(camera.id)}
        >
          <CameraFeed
            id={camera.id}
            name={camera.name}
            url={camera.url}
            type={camera.type}
            fps={camera.fps}
            aspectRatio={camera.aspectRatio}
            chromaColor={camera.chromaColor}
            timestamp={timestamp}
            showBadge={true}
            badgePosition="top-left"
          />
        </FloatingWindow>
      ))}
    </div>
  )
})

export interface DockedCameraManagerProps {
  cameras: CameraWindowConfig[]
  placement: CameraWindowPlacement
  timestamp?: number
  onCameraClose?: (id: string) => void
  maxWindows?: number
  className?: string
}

// Manager for docked camera windows
export const DockedCameraManager = memo(function DockedCameraManager({
  cameras,
  placement,
  timestamp,
  onCameraClose,
  maxWindows = 3,
  className = '',
}: DockedCameraManagerProps) {
  // Only render if in docked mode
  if (placement !== 'docked-above' && placement !== 'docked-below') {
    return null
  }
  
  const dockedPosition: DockedPosition = placement === 'docked-above' ? 'above' : 'below'
  
  // Limit cameras to maxWindows
  const visibleCameras = useMemo(() => 
    cameras.slice(0, maxWindows),
    [cameras, maxWindows]
  )
  
  const handleClose = useCallback((id: string) => {
    onCameraClose?.(id)
  }, [onCameraClose])
  
  if (visibleCameras.length === 0) {
    return null
  }
  
  return (
    <DockedWindowContainer 
      position={dockedPosition} 
      maxWindows={maxWindows}
      className={className}
    >
      {visibleCameras.map(camera => (
        <DockedWindow
          key={camera.id}
          id={camera.id}
          title={camera.name}
          position={dockedPosition}
          onClose={() => handleClose(camera.id)}
        >
          <CameraFeed
            id={camera.id}
            name={camera.name}
            url={camera.url}
            type={camera.type}
            fps={camera.fps}
            aspectRatio={camera.aspectRatio}
            chromaColor={camera.chromaColor}
            timestamp={timestamp}
            showBadge={true}
            badgePosition="top-left"
          />
        </DockedWindow>
      ))}
    </DockedWindowContainer>
  )
})

export default FloatingCameraManager
