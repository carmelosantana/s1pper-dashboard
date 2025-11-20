"use client"

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, Thermometer, Clock, Zap, Layers } from 'lucide-react'
import { FaviconManager } from '@/components/favicon-manager'
import { StreamMusicPlayer } from '@/components/stream-music-player'
import { MultiCameraStream } from '@/components/multi-camera-stream'
import { usePrinterData } from '@/lib/hooks/use-printer-data'
import type { PrinterStatus, TemperatureHistory } from '@/lib/types'

interface VerticalStreamClientProps {
  initialStatus: PrinterStatus | null
  initialTemperatureHistory: TemperatureHistory | null
  musicEnabled: boolean
  musicVolume: number
  musicPlaylist: string[]
  musicLoop: boolean
  streamingTitleEnabled: boolean
  dashboardTitle: string
  dashboardSubtitle: string
  streamCameraDisplayMode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
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

export default function VerticalStreamClient({ 
  initialStatus, 
  initialTemperatureHistory,
  musicEnabled,
  musicVolume,
  musicPlaylist,
  musicLoop,
  streamingTitleEnabled,
  dashboardTitle,
  dashboardSubtitle,
  streamCameraDisplayMode,
  enabledCameras
}: VerticalStreamClientProps) {
  const { printerStatus, temperatureHistory, isConnected } = usePrinterData()
  const [scrollPosition, setScrollPosition] = useState(0)
  const [scrollDirection, setScrollDirection] = useState<'forward' | 'backward'>('forward')
  const filenameRef = useRef<HTMLDivElement>(null)

  // Scroll filename if too long
  useEffect(() => {
    if (!filenameRef.current || !printerStatus?.print.filename) return

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
          setTimeout(scroll, 2000) // Pause at end
          return
        }
      } else {
        currentPos -= 1
        if (currentPos <= 0) {
          direction = 'forward'
          setTimeout(scroll, 2000) // Pause at start
          return
        }
      }
      setScrollPosition(currentPos)
      setScrollDirection(direction)
    }

    const interval = setInterval(scroll, 50)
    return () => clearInterval(interval)
  }, [printerStatus?.print.filename])

  // Only show full offline screen if truly disconnected (no status at all)
  const isTrulyOffline = !isConnected || !printerStatus
  const isPrinterOffline = printerStatus?.print.state === 'offline'
  
  if (isTrulyOffline) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <FaviconManager status="offline" />
        {/* Keep music playing even when disconnected */}
        <StreamMusicPlayer 
          enabled={musicEnabled}
          volume={musicVolume}
          playlist={musicPlaylist}
          loop={musicLoop}
        />
        <div className="text-center">
          <Activity className="h-16 w-16 mx-auto mb-4 text-gray-500" />
          <h1 className="text-2xl font-bold mb-2">Printer Disconnected</h1>
          <p className="text-gray-400">Waiting for connection...</p>
        </div>
      </div>
    )
  }

  const isPrinting = printerStatus.print.state === 'printing'
  const progress = Math.round(printerStatus.print.progress * 100)

  // Render consolidated info card with all data
  const renderInfoCard = () => {
    return (
      <div className="bg-black/50 backdrop-blur-md rounded-2xl px-8 py-6 border border-white/10">
        <div className="space-y-6">
          {/* Temperatures */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Thermometer className="h-8 w-8 text-orange-500" />
              <h3 className="text-2xl font-semibold text-white">Temperatures</h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-base text-gray-400 mb-2">EXTRUDER</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">
                    {Math.round(printerStatus.temperatures.extruder.actual)}°
                  </span>
                  <span className="text-xl text-gray-400">
                    / {Math.round(printerStatus.temperatures.extruder.target)}°
                  </span>
                </div>
                {(printerStatus.temperatures.extruder.target > 0 || printerStatus.temperatures.extruder.power > 0) && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${printerStatus.temperatures.extruder.power * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-base text-gray-400 mb-2">BED</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">
                    {Math.round(printerStatus.temperatures.bed.actual)}°
                  </span>
                  <span className="text-xl text-gray-400">
                    / {Math.round(printerStatus.temperatures.bed.target)}°
                  </span>
                </div>
                {(printerStatus.temperatures.bed.target > 0 || printerStatus.temperatures.bed.power > 0) && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${printerStatus.temperatures.bed.power * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Speed & Filament */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-7 w-7 text-cyan-500" />
                <p className="text-base text-gray-400">SPEED</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-cyan-400">
                  {Math.round(printerStatus.speeds.current)}
                </span>
                <span className="text-xl text-gray-400">mm/s</span>
              </div>
              <p className="text-lg text-gray-500 mt-1">
                {Math.round(printerStatus.speeds.factor * 100)}% factor
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-7 w-7 text-purple-500" />
                <p className="text-base text-gray-400">FILAMENT</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-purple-400">
                  {(printerStatus.print.filamentUsed / 1000).toFixed(1)}
                </span>
                <span className="text-xl text-gray-400">m</span>
              </div>
              <p className="text-lg text-gray-500 mt-1">
                {(printerStatus.print.filamentUsed / 10).toFixed(0)} cm used
              </p>
            </div>
          </div>

          {/* Layer Progress */}
          {printerStatus.print.currentLayer && printerStatus.print.totalLayers && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-7 w-7 text-green-500" />
                <p className="text-base text-gray-400">LAYERS</p>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-bold text-green-400">
                  {printerStatus.print.currentLayer}
                </span>
                <span className="text-2xl text-gray-400">
                  / {printerStatus.print.totalLayers}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${(printerStatus.print.currentLayer / printerStatus.print.totalLayers) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-screen bg-black overflow-hidden" style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <FaviconManager status={printerStatus.print.state} />
      
      {/* Stream music player */}
      <StreamMusicPlayer 
        enabled={musicEnabled}
        volume={musicVolume}
        playlist={musicPlaylist}
        loop={musicLoop}
      />
      
      {/* Full screen video feed - Portrait aspect ratio */}
      <div className="relative h-screen">
        <MultiCameraStream
          className="w-full h-full"
          displayMode={streamCameraDisplayMode}
          enabledCameras={enabledCameras}
          imageRendering="auto"
          orientation="vertical"
          disableInteraction={true}
        />

        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

        {/* Header: Logo and Status */}
        <div className="absolute top-8 left-8 right-8 space-y-5">
          <div className="flex items-center justify-between">
            {streamingTitleEnabled && (
              <div className="flex items-center gap-4">
                <Activity className="h-10 w-10 text-cyan-500" />
                <div>
                  <h1 className="text-3xl font-bold text-white">{dashboardTitle}</h1>
                  <p className="text-base text-gray-300">{dashboardSubtitle}</p>
                </div>
              </div>
            )}
            
            <Badge
              className={
                "text-xl px-6 py-3 shadow-none rounded-full font-semibold " +
                (isPrinting 
                  ? "bg-amber-600/90 hover:bg-amber-600/90 text-white border-amber-500" 
                  : printerStatus.print.state === 'cancelled'
                  ? "bg-gray-600/90 hover:bg-gray-600/90 text-white border-gray-500"
                  : "bg-emerald-600/90 hover:bg-emerald-600/90 text-white border-emerald-500")
              }
            >
              <div className={
                "h-3 w-3 rounded-full mr-3 " +
                (isPrinting 
                  ? "bg-white animate-pulse" 
                  : "bg-white")
              } />
              {isPrinting ? 'PRINTING' : printerStatus.print.state.toUpperCase()}
            </Badge>
          </div>

          {/* Consolidated Info Card */}
          <div>
            {renderInfoCard()}
          </div>
        </div>

        {/* Bottom: File and Progress */}
        <div className="absolute bottom-8 left-8 right-8 space-y-4">
          {printerStatus.print.filename && (
            <div className="bg-black/50 backdrop-blur-md rounded-xl px-6 py-4 border border-white/10 overflow-hidden">
              <p className="text-base text-gray-400 mb-2">Current File</p>
              <div ref={filenameRef} className="overflow-hidden">
                <h2 
                  className="text-xl font-bold text-white whitespace-nowrap transition-transform duration-100 ease-linear"
                  style={{ transform: `translateX(-${scrollPosition}px)` }}
                >
                  {printerStatus.print.filename}
                </h2>
              </div>
            </div>
          )}
          
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-6 py-6 border border-white/10">
            {/* Progress Bar with percentage on right */}
            <div className="mb-5">
              <p className="text-base text-gray-400 mb-3">Progress</p>
              <div className="flex items-center gap-5">
                <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-6xl font-bold text-white min-w-[140px] text-right">{progress}%</p>
              </div>
            </div>

            {/* Time Information */}
            <div className="grid grid-cols-3 gap-5 text-lg">
              <div>
                <p className="text-gray-400 text-base mb-2">Elapsed</p>
                <p className="text-white font-mono font-bold text-xl">{formatTime(printerStatus.print.printTime)}</p>
              </div>
              {printerStatus.print.estimatedTimeLeft !== null && (
                <>
                  <div>
                    <p className="text-gray-400 text-base mb-2">Left</p>
                    <p className="text-white font-mono font-bold text-xl">{formatTime(printerStatus.print.estimatedTimeLeft)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-base mb-2">Finish</p>
                    <p className="text-white font-mono font-bold text-base">{formatFinishTime(printerStatus.print.estimatedTimeLeft)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
