'use client'

import { useState, useEffect } from 'react'
import { Camera, Grid3X3, PictureInPicture, WifiOff } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface CameraFeed {
  uid: string
  name: string
  enabled: boolean
}

interface MultiCameraStreamProps {
  className?: string
  displayMode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  enabledCameras: CameraFeed[]
  onCameraSelect?: (uid: string) => void
  imageRendering?: 'auto' | 'crisp-edges' | 'pixelated'
  orientation?: 'horizontal' | 'vertical'
  disableInteraction?: boolean
}

export function MultiCameraStream({
  className,
  displayMode,
  enabledCameras,
  onCameraSelect,
  imageRendering = 'auto',
  orientation = 'horizontal',
  disableInteraction = false
}: MultiCameraStreamProps) {
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [cameraErrors, setCameraErrors] = useState<Record<string, boolean>>({})

  // Reset selected camera when cameras change
  useEffect(() => {
    if (selectedCameraIndex >= enabledCameras.length) {
      setSelectedCameraIndex(0)
    }
  }, [enabledCameras.length, selectedCameraIndex])

  // Automatic camera switching for offline_video_swap mode
  useEffect(() => {
    if (displayMode !== 'offline_video_swap' || enabledCameras.length <= 1) return

    const currentCamera = enabledCameras[selectedCameraIndex]
    if (!currentCamera || !cameraErrors[currentCamera.uid]) return

    // Find next available camera that's not offline
    let nextIndex = (selectedCameraIndex + 1) % enabledCameras.length
    let attempts = 0
    const maxAttempts = enabledCameras.length

    // Round-robin through cameras to find one that's online
    while (attempts < maxAttempts) {
      const nextCamera = enabledCameras[nextIndex]
      if (!cameraErrors[nextCamera.uid]) {
        // Found an online camera, switch to it
        setIsTransitioning(true)
        setSelectedCameraIndex(nextIndex)
        onCameraSelect?.(nextCamera.uid)
        setTimeout(() => setIsTransitioning(false), 300)
        return
      }
      nextIndex = (nextIndex + 1) % enabledCameras.length
      attempts++
    }
  }, [cameraErrors, selectedCameraIndex, enabledCameras, displayMode, onCameraSelect])

  // Handle camera selection with callback
  const handleCameraSelect = (index: number) => {
    if (index !== selectedCameraIndex && !isTransitioning) {
      setIsTransitioning(true)
      setSelectedCameraIndex(index)
      onCameraSelect?.(enabledCameras[index].uid)
      
      // Reset transition state after animation
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  // Handle camera feed errors (video drops)
  const handleCameraError = (cameraUid: string) => {
    setCameraErrors(prev => ({ ...prev, [cameraUid]: true }))
  }

  // Handle camera feed recovery
  const handleCameraLoad = (cameraUid: string) => {
    setCameraErrors(prev => ({ ...prev, [cameraUid]: false }))
  }

  // Render camera image with error overlay
  const renderCameraImage = (camera: CameraFeed, className?: string, includeKey = false) => (
    <div className="relative w-full h-full">
      <img
        key={includeKey ? camera.uid : undefined}
        src={`/api/camera/stream?uid=${camera.uid}`}
        alt={`${camera.name} Stream`}
        className={className}
        style={{ imageRendering }}
        onError={() => handleCameraError(camera.uid)}
        onLoad={() => handleCameraLoad(camera.uid)}
      />
      {cameraErrors[camera.uid] && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <WifiOff className="h-12 w-12 mx-auto mb-2 text-gray-500" />
            <p className="text-gray-400 text-sm">No video feed</p>
          </div>
        </div>
      )}
    </div>
  )

  if (enabledCameras.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-black/50 backdrop-blur-md rounded-lg",
        className
      )}>
        <div className="text-center p-8">
          <Camera className="h-16 w-16 mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400">No cameras available</p>
        </div>
      </div>
    )
  }

  // Single camera view
  if (displayMode === 'single') {
    return (
      <div className={cn("relative", className)}>
        {/* Main camera feed */}
        <div className="relative w-full h-full">
          {renderCameraImage(
            enabledCameras[selectedCameraIndex],
            cn(
              "w-full h-full object-cover rounded-lg transition-opacity duration-300",
              isTransitioning ? "opacity-0" : "opacity-100"
            ),
            true // Include key for transition
          )}
        </div>

        {/* Camera switcher - Only show if multiple cameras and interaction is enabled */}
        {enabledCameras.length > 1 && !disableInteraction && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/70 backdrop-blur-md rounded-full px-4 py-2">
            {enabledCameras.map((camera, index) => (
              <Button
                key={camera.uid}
                onClick={() => handleCameraSelect(index)}
                variant={index === selectedCameraIndex ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 transition-all",
                  index === selectedCameraIndex 
                    ? "bg-cyan-600 hover:bg-cyan-700" 
                    : "hover:bg-white/10"
                )}
              >
                <Camera className="h-4 w-4 mr-1" />
                {camera.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Grid view
  if (displayMode === 'grid') {
    return (
      <div className={cn(
        "grid gap-2",
        orientation === 'vertical' ? (
          // Vertical orientation: stack cameras vertically
          "grid-cols-1"
        ) : (
          // Horizontal orientation: use grid layout
          cn(
            enabledCameras.length === 1 && "grid-cols-1",
            enabledCameras.length === 2 && "grid-cols-2",
            enabledCameras.length === 3 && "grid-cols-2",
            enabledCameras.length >= 4 && "grid-cols-2 grid-rows-2"
          )
        ),
        className
      )}>
        {enabledCameras.map((camera) => (
          <div
            key={camera.uid}
            className="relative aspect-video bg-black/50 rounded-lg overflow-hidden group"
          >
            {renderCameraImage(
              camera,
              "w-full h-full object-cover"
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium text-white">{camera.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Picture-in-Picture view
  if (displayMode === 'pip') {
    return (
      <div className={cn("relative", className)}>
        {/* Main camera feed */}
        <div className="relative w-full h-full">
          {renderCameraImage(
            enabledCameras[selectedCameraIndex],
            cn(
              "w-full h-full object-cover rounded-lg transition-opacity duration-300",
              isTransitioning ? "opacity-0" : "opacity-100"
            ),
            true // Include key for transition
          )}
          
          {/* Main camera label */}
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2">
            <Camera className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium text-white">
              {enabledCameras[selectedCameraIndex].name}
            </span>
          </div>
        </div>

        {/* Thumbnail cameras - Only show if multiple cameras and interaction is enabled */}
        {enabledCameras.length > 1 && !disableInteraction && (
          <div className={cn(
            "absolute flex gap-3",
            orientation === 'vertical' 
              ? "bottom-4 left-4 right-4 flex-row justify-center" // Vertical: centered at bottom
              : "bottom-6 right-6 flex-col" // Horizontal: right side stack
          )}>
            {enabledCameras.map((camera, index) => {
              // Don't show the currently selected camera in thumbnails
              if (index === selectedCameraIndex) return null
              
              return (
                <button
                  key={camera.uid}
                  onClick={() => handleCameraSelect(index)}
                  className={cn(
                    "relative bg-black/50 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:border-cyan-500",
                    "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black",
                    orientation === 'vertical' ? "w-40 h-24" : "w-72 h-44", // Horizontal: 2.25x larger (was 32x20, now 72x44), Vertical: larger
                    index === selectedCameraIndex ? "border-cyan-500" : "border-white/20"
                  )}
                >
                  {renderCameraImage(
                    camera,
                    "w-full h-full object-cover"
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                    <span className={cn(
                      "font-medium text-white truncate",
                      orientation === 'vertical' ? "text-xs" : "text-sm"
                    )}>
                      {camera.name}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Offline Video Swap mode - Single camera with automatic switching on errors
  if (displayMode === 'offline_video_swap') {
    return (
      <div className={cn("relative", className)}>
        {/* Main camera feed */}
        <div className="relative w-full h-full">
          {renderCameraImage(
            enabledCameras[selectedCameraIndex],
            cn(
              "w-full h-full object-cover rounded-lg transition-opacity duration-300",
              isTransitioning ? "opacity-0" : "opacity-100"
            ),
            true // Include key for transition
          )}
        </div>

        {/* Camera info with auto-swap indicator */}
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md rounded-lg px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium text-white">
              {enabledCameras[selectedCameraIndex].name}
            </span>
          </div>
          {enabledCameras.length > 1 && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-300">
                Auto-swap {enabledCameras.length} cams
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
