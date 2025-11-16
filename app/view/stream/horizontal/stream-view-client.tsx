"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, Thermometer } from 'lucide-react'
import { FaviconManager } from '@/components/favicon-manager'
import { StreamMusicPlayer } from '@/components/stream-music-player'
import type { PrinterStatus, TemperatureHistory } from '@/lib/types'

interface StreamViewClientProps {
  initialStatus: PrinterStatus | null
  initialTemperatureHistory: TemperatureHistory | null
  musicEnabled: boolean
  musicVolume: number
  musicPlaylist: string[]
  musicLoop: boolean
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
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
    return `Tomorrow, ${timeString}`
  } else {
    return timeString
  }
}

export default function StreamViewClient({ 
  initialStatus, 
  initialTemperatureHistory,
  musicEnabled,
  musicVolume,
  musicPlaylist,
  musicLoop
}: StreamViewClientProps) {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(initialStatus)
  const [temperatureHistory, setTemperatureHistory] = useState<TemperatureHistory | null>(initialTemperatureHistory)
  const [streamUrl, setStreamUrl] = useState<string>('/api/camera/stream')
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch fresh data every 3 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusResponse, tempResponse] = await Promise.all([
          fetch('/api/printer/status', { cache: 'no-store' }),
          fetch('/api/printer/temperature-history', { cache: 'no-store' })
        ])

        if (statusResponse.ok) {
          const status = await statusResponse.json()
          setPrinterStatus(status)
        }

        if (tempResponse.ok) {
          const tempHistory = await tempResponse.json()
          setTemperatureHistory(tempHistory)
        }

        // Add cache busting to video stream
        setStreamUrl(`/api/camera/stream?t=${Date.now()}`)
      } catch (error) {
        console.error('Error fetching printer data:', error)
      }
    }

    // Initial fetch after component mounts
    const initialDelay = setTimeout(fetchData, 1000)
    
    // Then fetch every 3 seconds
    const interval = setInterval(fetchData, 3000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
    }
  }, [])

  if (!printerStatus || printerStatus.print.state === 'offline') {
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

  return (
    <div className="relative min-h-screen w-screen bg-black overflow-hidden">
      <FaviconManager status={printerStatus.print.state} />
      
      {/* Stream music player */}
      <StreamMusicPlayer 
        enabled={musicEnabled}
        volume={musicVolume}
        playlist={musicPlaylist}
        loop={musicLoop}
      />
      
      {/* Full screen video feed */}
      <div className="absolute inset-0">
        <img
          src={streamUrl}
          alt="Printer Camera Stream"
          className="w-full h-full object-cover"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Gradient overlays for better text readability */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 bottom-0 w-96 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 bottom-0 w-96 bg-gradient-to-l from-black/60 to-transparent pointer-events-none" />

      {/* Top Left: Printer Status */}
      <div className="absolute top-6 left-6 space-y-3">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">s1pper</h1>
            <p className="text-sm text-gray-300">Ender 3 S1 Pro</p>
          </div>
        </div>
        
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
            (isPrinting 
              ? "bg-white animate-pulse" 
              : printerStatus.print.state === 'cancelled'
              ? "bg-white"
              : "bg-white")
          } />
          {isPrinting ? 'PRINTING' : printerStatus.print.state.toUpperCase()}
        </Badge>

        {/* Current Time */}
        <div className="text-white/90 font-mono text-lg">
          {currentTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true 
          })}
        </div>
      </div>

      {/* Bottom Left: File Name and Progress */}
      <div className="absolute bottom-6 left-6 space-y-3 max-w-2xl">
        {printerStatus.print.filename && (
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10">
            <p className="text-xs text-gray-400 mb-1">Current File</p>
            <h2 className="text-2xl font-bold text-white truncate">
              {printerStatus.print.filename}
            </h2>
          </div>
        )}
        
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs text-gray-400">Progress</p>
              <p className="text-5xl font-bold text-white">{progress}%</p>
            </div>
            {printerStatus.print.currentLayer && printerStatus.print.totalLayers && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Layer</p>
                <p className="text-2xl font-bold text-white">
                  {printerStatus.print.currentLayer}/{printerStatus.print.totalLayers}
                </p>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Information */}
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Elapsed</p>
              <p className="text-white font-mono">{formatTime(printerStatus.print.printTime)}</p>
            </div>
            {printerStatus.print.estimatedTimeLeft !== null && (
              <>
                <div>
                  <p className="text-gray-400 text-xs">Remaining</p>
                  <p className="text-white font-mono">{formatTime(printerStatus.print.estimatedTimeLeft)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Finish</p>
                  <p className="text-white font-mono">{formatFinishTime(printerStatus.print.estimatedTimeLeft)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Right: Temperature and Stats */}
      <div className="absolute top-6 right-6 space-y-3">
        {/* Extruder Temperature */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="h-5 w-5 text-orange-500" />
            <p className="text-xs text-gray-400">EXTRUDER</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {Math.round(printerStatus.temperatures.extruder.actual)}°
            </span>
            <span className="text-xl text-gray-400">
              / {Math.round(printerStatus.temperatures.extruder.target)}°C
            </span>
          </div>
          {printerStatus.temperatures.extruder.power > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${printerStatus.temperatures.extruder.power * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Power: {Math.round(printerStatus.temperatures.extruder.power * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Bed Temperature */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="h-5 w-5 text-blue-500" />
            <p className="text-xs text-gray-400">BED</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {Math.round(printerStatus.temperatures.bed.actual)}°
            </span>
            <span className="text-xl text-gray-400">
              / {Math.round(printerStatus.temperatures.bed.target)}°C
            </span>
          </div>
          {printerStatus.temperatures.bed.power > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${printerStatus.temperatures.bed.power * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Power: {Math.round(printerStatus.temperatures.bed.power * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Print Speed */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <p className="text-xs text-gray-400 mb-2">PRINT SPEED</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {Math.round(printerStatus.speeds.current)}
            </span>
            <span className="text-lg text-gray-400">mm/s</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Factor: {Math.round(printerStatus.speeds.factor * 100)}%
          </p>
        </div>

        {/* Filament Used */}
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 min-w-[280px]">
          <p className="text-xs text-gray-400 mb-2">FILAMENT USED</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {(printerStatus.print.filamentUsed / 1000).toFixed(2)}
            </span>
            <span className="text-lg text-gray-400">m</span>
          </div>
        </div>
      </div>
    </div>
  )
}
