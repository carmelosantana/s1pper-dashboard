"use client"

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, Thermometer } from 'lucide-react'
import { FaviconManager } from '@/components/favicon-manager'
import { MultiCameraStream } from '@/components/multi-camera-stream'
import { usePrinterData } from '@/lib/hooks/use-printer-data'
import type { PrinterStatus, TemperatureHistory } from '@/lib/types'

interface StreamViewClientProps {
  initialStatus: PrinterStatus | null
  initialTemperatureHistory: TemperatureHistory | null
  streamingTitleEnabled: boolean
  dashboardTitle: string
  dashboardSubtitle: string
  streamCameraDisplayMode: 'single' | 'grid' | 'pip'
  enabledCameras: Array<{ uid: string; name: string; enabled: boolean }>
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

function formatFinishTime(estimatedTimeLeft: number): string {
  const finishTime = new Date(Date.now() + estimatedTimeLeft * 1000)
  const now = new Date()
  const isNextDay = finishTime.getDate() !== now.getDate()
  
  const timeString = finishTime.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  if (isNextDay) {
    return `Tomorrow ${timeString}`
  } else {
    return timeString
  }
}

export default function StreamViewClient({ 
  initialStatus, 
  initialTemperatureHistory,
  streamingTitleEnabled,
  dashboardTitle,
  dashboardSubtitle,
  streamCameraDisplayMode,
  enabledCameras
}: StreamViewClientProps) {
  const { printerStatus, temperatureHistory, isConnected } = usePrinterData()
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [isPortrait, setIsPortrait] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)
  const filenameRef = useRef<HTMLDivElement>(null)

  // Detect orientation based on window aspect ratio
  useEffect(() => {
    const checkOrientation = () => {
      const aspectRatio = window.innerWidth / window.innerHeight
      // Portrait if aspect ratio is less than 1 (taller than wide)
      // Also consider narrow vertical streams (like 9:16, 1080x1920)
      setIsPortrait(aspectRatio < 1)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    return () => window.removeEventListener('resize', checkOrientation)
  }, [])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Scroll filename if too long (for portrait mode)
  useEffect(() => {
    if (!isPortrait || !filenameRef.current || !printerStatus?.print.filename) return

    const container = filenameRef.current
    const textWidth = container.scrollWidth
    const containerWidth = container.clientWidth

    if (textWidth <= containerWidth) {
      setScrollPosition(0)
      return
    }

    const maxScroll = textWidth - containerWidth
    let currentPos = 0
    let direction: 'forward' | 'backward' = 'forward'

    const scroll = () => {
      if (direction === 'forward') {
        currentPos += 1
        if (currentPos >= maxScroll) {
          direction = 'backward'
          setTimeout(scroll, 2000)
          return
        }
      } else {
        currentPos -= 1
        if (currentPos <= 0) {
          direction = 'forward'
          setTimeout(scroll, 2000)
          return
        }
      }
      setScrollPosition(currentPos)
    }

    const interval = setInterval(scroll, 50)
    return () => clearInterval(interval)
  }, [isPortrait, printerStatus?.print.filename])

  if (!isConnected || !printerStatus || printerStatus.print.state === 'offline') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <FaviconManager status="offline" />
        <div className="text-center">
          <Activity className="h-16 w-16 mx-auto mb-4 text-gray-500" />
          <h1 className="text-2xl font-bold mb-2">Printer Offline</h1>
          <p className="text-gray-400">Waiting for connection...</p>
        </div>
      </div>
    )
  }

  const isPrinting = printerStatus.print.state === 'printing'
  const progress = Math.round(printerStatus.print.progress * 100)

  // PORTRAIT LAYOUT (Vertical/Mobile)
  if (isPortrait) {
    return (
      <div className="relative min-h-screen w-screen bg-black overflow-hidden" style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <FaviconManager status={printerStatus.print.state} />
        
        {/* Full screen video feed - Portrait aspect ratio */}
        <div className="relative h-screen">
          <MultiCameraStream
            className="w-full h-full"
            displayMode={streamCameraDisplayMode}
            enabledCameras={enabledCameras}
            imageRendering="auto"
          />

          {/* Gradient overlays */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

          {/* Header: Logo and Status */}
          <div className="absolute top-8 left-8 right-8 space-y-5">
            <div className="flex items-center justify-between">
              {streamingTitleEnabled && (
                <div className="flex items-center gap-3">
                  <Activity className="h-8 w-8 text-cyan-500" />
                  <div>
                    <h1 className="text-2xl font-bold text-white">{dashboardTitle}</h1>
                    <p className="text-sm text-gray-300">{dashboardSubtitle}</p>
                  </div>
                </div>
              )}
              
              <Badge
                className={
                  "text-sm px-4 py-2 shadow-none rounded-full " +
                  (isPrinting 
                    ? "bg-amber-600/90 hover:bg-amber-600/90 text-white border-amber-500" 
                    : printerStatus.print.state === 'cancelled'
                    ? "bg-gray-600/90 hover:bg-gray-600/90 text-white border-gray-500"
                    : "bg-emerald-600/90 hover:bg-emerald-600/90 text-white border-emerald-500")
                }
              >
                <div className={
                  "h-2 w-2 rounded-full mr-2 " +
                  (isPrinting ? "bg-white animate-pulse" : "bg-white")
                } />
                {printerStatus.print.state === 'printing' ? 'Printing' :
                 printerStatus.print.state === 'cancelled' ? 'Cancelled' :
                 printerStatus.print.state === 'paused' ? 'Paused' :
                 printerStatus.print.state === 'complete' ? 'Complete' : 'Ready'}
              </Badge>
            </div>

            {/* Consolidated Info Card */}
            <div className="bg-black/50 backdrop-blur-md rounded-2xl px-8 py-6 border border-white/10">
              <div className="space-y-6">
                {/* Temperatures */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Thermometer className="h-5 w-5 text-cyan-500" />
                    <h3 className="text-lg font-semibold text-white">Temperatures</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg px-4 py-3">
                      <div className="text-xs text-gray-400 mb-1">Extruder</div>
                      <div className="text-2xl font-bold text-white">
                        {Math.round(printerStatus.temperature.tool0.actual)}°C
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Target: {Math.round(printerStatus.temperature.tool0.target)}°C
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg px-4 py-3">
                      <div className="text-xs text-gray-400 mb-1">Bed</div>
                      <div className="text-2xl font-bold text-white">
                        {Math.round(printerStatus.temperature.bed.actual)}°C
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Target: {Math.round(printerStatus.temperature.bed.target)}°C
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print Stats */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Elapsed</div>
                    <div className="text-lg font-semibold text-white">
                      {formatTime(printerStatus.print.duration)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Remaining</div>
                    <div className="text-lg font-semibold text-white">
                      {printerStatus.print.estimatedTimeLeft > 0 
                        ? formatTime(printerStatus.print.estimatedTimeLeft)
                        : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">ETA</div>
                    <div className="text-lg font-semibold text-white">
                      {printerStatus.print.estimatedTimeLeft > 0
                        ? formatFinishTime(printerStatus.print.estimatedTimeLeft)
                        : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Speed</div>
                    <div className="text-lg font-semibold text-white">
                      {Math.round(printerStatus.print.feedrate * 100)}%
                    </div>
                  </div>
                </div>

                {/* Layer Info */}
                {printerStatus.print.currentLayer && printerStatus.print.totalLayers && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400">Layer Progress</div>
                      <div className="text-sm font-semibold text-white">
                        {printerStatus.print.currentLayer} / {printerStatus.print.totalLayers}
                      </div>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(printerStatus.print.currentLayer / printerStatus.print.totalLayers) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: File and Progress */}
          <div className="absolute bottom-8 left-8 right-8 space-y-4">
            {printerStatus.print.filename && (
              <div className="bg-black/50 backdrop-blur-md rounded-xl px-6 py-4 border border-white/10">
                <div className="text-xs text-gray-400 mb-2">Printing</div>
                <div 
                  ref={filenameRef}
                  className="text-xl font-bold text-white whitespace-nowrap overflow-hidden"
                  style={{ transform: `translateX(-${scrollPosition}px)` }}
                >
                  {printerStatus.print.filename}
                </div>
              </div>
            )}
            
            <div className="bg-black/50 backdrop-blur-md rounded-xl px-6 py-6 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-400">Progress</div>
                <div className="text-2xl font-bold text-white">{progress}%</div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {printerStatus.print.filamentUsed > 0 && (
                <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                  <div>Filament: {(printerStatus.print.filamentUsed / 1000).toFixed(2)}m</div>
                  {printerStatus.print.layer_height && (
                    <div>Layer: {printerStatus.print.layer_height}mm</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // LANDSCAPE LAYOUT (Horizontal/Desktop)
  return (
    <div className="relative min-h-screen w-screen bg-black overflow-hidden">
      <FaviconManager status={printerStatus.print.state} />
      
      {/* Full screen video feed */}
      <div className="absolute inset-0 bg-black">
        <MultiCameraStream
          className="w-full h-full"
          displayMode={streamCameraDisplayMode}
          enabledCameras={enabledCameras}
          imageRendering="auto"
        />
      </div>

      {/* Gradient overlays for better text readability */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 bottom-0 w-96 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 bottom-0 w-96 bg-gradient-to-l from-black/60 to-transparent pointer-events-none" />

      {/* Top Left: Printer Status */}
      <div className="absolute top-6 left-6 space-y-3">
        {streamingTitleEnabled && (
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-cyan-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">{dashboardTitle}</h1>
              <p className="text-sm text-gray-300">{dashboardSubtitle}</p>
            </div>
          </div>
        )}
        
        <Badge
          className={
            "text-sm px-4 py-2 shadow-none rounded-full " +
            (isPrinting 
              ? "bg-amber-600/90 hover:bg-amber-600/90 text-white border-amber-500" 
              : printerStatus.print.state === 'cancelled'
              ? "bg-gray-600/90 hover:bg-gray-600/90 text-white border-gray-500"
              : "bg-emerald-600/90 hover:bg-emerald-600/90 text-white border-emerald-500")
          }
        >
          <div className={
            "h-2 w-2 rounded-full mr-2 " +
            (isPrinting ? "bg-white animate-pulse" : "bg-white")
          } />
          {printerStatus.print.state === 'printing' ? 'Printing' :
           printerStatus.print.state === 'cancelled' ? 'Cancelled' :
           printerStatus.print.state === 'paused' ? 'Paused' :
           printerStatus.print.state === 'complete' ? 'Complete' : 'Ready'}
        </Badge>

        {/* Current Time */}
        <div className="text-white/90 font-mono text-lg">
          {currentTime.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </div>
      </div>

      {/* Bottom Left: File Name and Progress */}
      <div className="absolute bottom-6 left-6 space-y-3 max-w-2xl">
        {printerStatus.print.filename && (
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-3 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">Printing</div>
            <div className="text-xl font-bold text-white truncate">
              {printerStatus.print.filename}
            </div>
          </div>
        )}
        
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-400">Progress</div>
            <div className="text-2xl font-bold text-white">{progress}%</div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 mb-1">Elapsed</div>
              <div className="text-white font-semibold">
                {formatTime(printerStatus.print.duration)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Remaining</div>
              <div className="text-white font-semibold">
                {printerStatus.print.estimatedTimeLeft > 0 
                  ? formatTime(printerStatus.print.estimatedTimeLeft)
                  : '--'}
              </div>
            </div>
          </div>

          {printerStatus.print.estimatedTimeLeft > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-xs text-gray-400 mb-1">Estimated Finish</div>
              <div className="text-white font-semibold">
                {formatFinishTime(printerStatus.print.estimatedTimeLeft)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Right: Temperature and Stats */}
      <div className="absolute top-6 right-6 space-y-3">
        {/* Temperatures */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="h-5 w-5 text-cyan-500" />
            <h3 className="text-sm font-semibold text-white">Temperatures</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Extruder</span>
                <span className="text-lg font-bold text-white">
                  {Math.round(printerStatus.temperature.tool0.actual)}°C
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Target: {Math.round(printerStatus.temperature.tool0.target)}°C
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Bed</span>
                <span className="text-lg font-bold text-white">
                  {Math.round(printerStatus.temperature.bed.actual)}°C
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Target: {Math.round(printerStatus.temperature.bed.target)}°C
              </div>
            </div>
          </div>
        </div>

        {/* Speed & Flow */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <h3 className="text-sm font-semibold text-white mb-3">Motion</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Speed</span>
              <span className="text-lg font-bold text-white">
                {Math.round(printerStatus.print.feedrate * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Flow</span>
              <span className="text-lg font-bold text-white">
                {Math.round(printerStatus.print.flowrate * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Fan</span>
              <span className="text-lg font-bold text-white">
                {Math.round(printerStatus.print.fanSpeed * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Layer Info */}
        {printerStatus.print.currentLayer && printerStatus.print.totalLayers && (
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
            <h3 className="text-sm font-semibold text-white mb-3">Layers</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Progress</span>
              <span className="text-lg font-bold text-white">
                {printerStatus.print.currentLayer} / {printerStatus.print.totalLayers}
              </span>
            </div>
          </div>
        )}

        {/* Filament Usage */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <h3 className="text-sm font-semibold text-white mb-3">Filament</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Used</span>
              <span className="text-lg font-bold text-white">
                {(printerStatus.print.filamentUsed / 1000).toFixed(2)}m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
