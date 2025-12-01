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
  savedPositions?: Record<string, { x: number; y: number }>
  savedSizes?: Record<string, { width: number; height: number }>
  onPositionChange?: (id: string, position: { x: number; y: number }) => void
  onSizeChange?: (id: string, size: { width: number; height: number }) => void
  className?: string
}

// Manager for floating camera windows with z-index handling
export const FloatingCameraManager = memo(function FloatingCameraManager({
  cameras,
  placement,
  timestamp,
  onCameraClose,
  savedPositions = {},
  savedSizes = {},
  onPositionChange,
  onSizeChange,
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
  const getDefaultPosition = useCallback((index: number, id: string) => {
    // Use saved position if available, otherwise calculate default
    if (savedPositions[id]) {
      return savedPositions[id]
    }
    const offset = index * 40
    return {
      x: 100 + offset,
      y: 100 + offset,
    }
  }, [savedPositions])

  // Get default size for window
  const getDefaultSize = useCallback((id: string) => {
    // Use saved size if available, otherwise use default
    if (savedSizes[id]) {
      return savedSizes[id]
    }
    return { width: 400, height: 280 }
  }, [savedSizes])
  
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
          defaultPosition={getDefaultPosition(index, camera.id)}
          defaultSize={getDefaultSize(camera.id)}
          minWidth={200}
          minHeight={150}
          onFocus={handleWindowFocus}
          onClose={() => handleWindowClose(camera.id)}
          onPositionChange={onPositionChange}
          onSizeChange={onSizeChange}
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
            fillContainer={true}
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
  onOrderChange?: (orderedIds: string[]) => void
  onWindowSizeChange?: (cameraId: string, width: number | string, height: number) => void
  windowSizes?: Record<string, { width: number | string; height: number }>
  maxWindows?: number
  className?: string
}

// Manager for docked camera windows with drag-and-drop reordering
export const DockedCameraManager = memo(function DockedCameraManager({
  cameras,
  placement,
  timestamp,
  onCameraClose,
  onOrderChange,
  onWindowSizeChange,
  windowSizes = {},
  maxWindows = 3,
  className = '',
}: DockedCameraManagerProps) {
  // Track drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  
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

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Add some opacity to the dragged element
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedId(null)
    setDragOverId(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedId && id !== draggedId) {
      setDragOverId(id)
    }
  }, [draggedId])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    
    if (!sourceId || sourceId === dropTargetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    
    // Reorder the cameras
    const currentOrder = visibleCameras.map(c => c.id)
    const sourceIndex = currentOrder.indexOf(sourceId)
    const targetIndex = currentOrder.indexOf(dropTargetId)
    
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    
    // Remove from source position and insert at target position
    const newOrder = [...currentOrder]
    newOrder.splice(sourceIndex, 1)
    newOrder.splice(targetIndex, 0, sourceId)
    
    // Notify parent of the new order
    onOrderChange?.(newOrder)
    
    setDraggedId(null)
    setDragOverId(null)
  }, [visibleCameras, onOrderChange])
  
  if (visibleCameras.length === 0) {
    return null
  }
  
  return (
    <DockedWindowContainer 
      position={dockedPosition} 
      maxWindows={maxWindows}
      className={className}
    >
      {visibleCameras.map(camera => {
        // Create drag handle props to pass to DockedWindow
        const dragHandleProps = {
          draggable: true,
          onDragStart: (e: React.DragEvent) => handleDragStart(e, camera.id),
          onDragEnd: handleDragEnd,
        }
        
        return (
        <div
          key={camera.id}
          onDragOver={(e) => handleDragOver(e, camera.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, camera.id)}
          className={`min-w-0 transition-all duration-150 ${
            dragOverId === camera.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          } ${draggedId === camera.id ? 'opacity-50' : ''}`}
          style={{ flex: '1 1 0%' }}
        >
          <DockedWindow
            id={camera.id}
            title={camera.name}
            position={dockedPosition}
            onClose={() => handleClose(camera.id)}
            defaultHeight={windowSizes[camera.id]?.height || 300}
            defaultWidth={windowSizes[camera.id]?.width || '100%'}
            minHeight={150}
            maxHeight={800}
            onSizeChange={onWindowSizeChange}
            dragHandleProps={dragHandleProps}
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
              fillContainer={true}
            />
          </DockedWindow>
        </div>
      )})}
    </DockedWindowContainer>
  )
})

export default FloatingCameraManager
