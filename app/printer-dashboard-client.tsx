"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Flame, Thermometer, Activity, Camera, AlertCircle, Grid2X2, CupSoda, Github, ExternalLink, Printer, Video, Cpu, Clock, Lock } from "lucide-react"
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text"
import { SparklesText } from "@/components/ui/sparkles-text"
import { AuroraText } from "@/components/ui/aurora-text"
import { FaviconManager } from "@/components/favicon-manager"
import { Confetti, type ConfettiRef } from "@/components/ui/confetti"
import { usePrinterData } from "@/lib/hooks/use-printer-data"
import type { PrinterStatus, TemperatureHistory, LifetimeStats } from '@/lib/types'
import type { ModuleSettings } from '@/lib/database'
import { CameraComponent } from "@/components/camera-component"
import { CircularProgress } from "@/components/ui/circular-progress"
import { trackEvent } from "@/components/umami-analytics"
import { formatTime, formatFilamentLength, formatLifetimeTime, formatFinishTime } from "@/lib/utils/formatting"
import { ModuleRenderer } from "@/components/modules/module-renderer"

import GuestbookCard from "@/components/guestbook-card"
import { SettingsControl } from "@/components/settings-control"

interface PrinterDashboardClientProps {
  initialStatus: PrinterStatus | null
  initialTemperatureHistory: TemperatureHistory | null
  initialLifetimeStats: LifetimeStats | null
  isDatabaseConfigured?: boolean
  dashboardTitle?: string
  dashboardSubtitle?: string
  enabledModules?: ModuleSettings[]
}

export default function PrinterDashboardClient({ 
  initialStatus, 
  initialTemperatureHistory, 
  initialLifetimeStats, 
  isDatabaseConfigured = false,
  dashboardTitle = "s1pper's Dashboard",
  dashboardSubtitle = "A dashboard for s1pper, the Ender 3 S1 Pro",
  enabledModules = []
}: PrinterDashboardClientProps) {
  const { printerStatus: wsStatus, temperatureHistory, isConnected } = usePrinterData()
  // Use WebSocket data if available, otherwise fall back to initial server-side data
  const printerStatus = wsStatus || initialStatus
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats | null>(initialLifetimeStats)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [previousProgress, setPreviousProgress] = useState<number>(0)
  const [hasShownConfetti, setHasShownConfetti] = useState<boolean>(false)
  const confettiRef = useRef<ConfettiRef>(null)

  // Function to trigger celebration confetti
  const triggerCelebrationConfetti = () => {
    if (confettiRef.current) {
      // Multiple bursts for celebration
      const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'] // Using your dashboard colors
      
      // First burst - from left
      confettiRef.current.fire({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.2, y: 0.6 },
        colors,
        startVelocity: 55,
        gravity: 0.8,
        decay: 0.9,
        scalar: 1.2
      })
      
      // Second burst - from right
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.8, y: 0.6 },
          colors,
          startVelocity: 55,
          gravity: 0.8,
          decay: 0.9,
          scalar: 1.2
        })
      }, 200)
      
      // Third burst - from center top
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 150,
          spread: 120,
          origin: { x: 0.5, y: 0.3 },
          colors,
          startVelocity: 60,
          gravity: 1,
          decay: 0.85,
          scalar: 1.4
        })
      }, 400)
    }
  }

  // Watch for print completion to trigger confetti
  useEffect(() => {
    if (printerStatus) {
      const currentProgress = Math.round(printerStatus.print.progress * 100)
      const isCompleted = printerStatus.print.state === 'complete'
      const isPrinting = printerStatus.print.state === 'printing'
      const justReached100 = currentProgress === 100 && previousProgress < 100
      const justCompleted = isCompleted && previousProgress < 100
      
      if ((justReached100 || justCompleted) && !hasShownConfetti) {
        // Trigger confetti effect
        triggerCelebrationConfetti()
        setHasShownConfetti(true)
        trackEvent('print_completed', { 
          reason: justReached100 ? 'progress_100' : 'status_complete',
          filename: printerStatus.print.filename || 'unknown',
          printTime: printerStatus.print.print_time || 0
        })
      }
      
      // Reset confetti flag when starting a new print
      if (isPrinting && hasShownConfetti && currentProgress < 100) {
        setHasShownConfetti(false)
        trackEvent('print_started', {
          filename: printerStatus.print.filename || 'unknown'
        })
      }
      
      setPreviousProgress(currentProgress)
    }
  }, [printerStatus, previousProgress, hasShownConfetti])

  // Fetch lifetime stats separately (less frequent updates needed)
  useEffect(() => {
    const fetchLifetimeStats = async () => {
      try {
        const response = await fetch('/api/printer/lifetime-stats', { cache: 'no-store' })
        if (response.ok) {
          const lifetimeData = await response.json()
          setLifetimeStats(lifetimeData)
        }
      } catch (error) {
        console.error('Error fetching lifetime stats:', error)
      }
    }

    // Fetch on mount and every 30 seconds (lifetime stats change slowly)
    fetchLifetimeStats()
    const interval = setInterval(fetchLifetimeStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update lastUpdated when printer status changes
  useEffect(() => {
    if (printerStatus) {
      setLastUpdated(new Date())
    }
  }, [printerStatus])

  // Handle offline state - only show if we have no printer data at all
  // If we have initial data but WebSocket isn't connected yet, still show the dashboard
  if (!printerStatus || printerStatus.print.state === 'offline') {
    // Check if this is a configuration error
    const isConfigurationError = printerStatus?.system?.klippyMessage?.includes('PRINTER_HOST environment variable not configured')
    
    return (
      <div className="dark min-h-screen bg-black text-foreground p-4 md:p-6">
        <FaviconManager status="offline" />
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Configuration Error Alert - shown above everything if config is missing */}
          {isConfigurationError && (
            <Card className="bg-amber-600/10 border-amber-600/20">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-amber-200 font-medium">Configuration Required</h4>
                  <p className="text-amber-200/80 text-sm mt-1">
                    The <code className="bg-amber-600/20 px-1.5 py-0.5 rounded text-xs">PRINTER_HOST</code> environment variable is not configured. 
                    Please set your printer's IP address in your environment variables.
                  </p>
                  <div className="mt-2 text-xs text-amber-200/60">
                    <p>Example: <code className="bg-amber-600/20 px-1.5 py-0.5 rounded">PRINTER_HOST=192.168.1.100</code></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Unified Header - Offline State */}
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                <SparklesText 
                  colors={{ first: '#ff6b35', second: '#f7931e' }}
                  sparklesCount={8}
                  className="flex items-center text-6xl"
                >
                  <CupSoda className="h-12 w-12 drop-shadow-lg" />
                </SparklesText>
              </div>
              <div className="flex flex-col">
                <AuroraText 
                  colors={['#ff6b35', '#f7931e', '#ffcc02', '#37b24d']}
                  className="text-2xl md:text-3xl font-bold text-balance leading-tight"
                >
                  {dashboardTitle}
                </AuroraText>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{dashboardSubtitle}</span>
                  <span>•</span>
                  <a href="/" className="hover:text-foreground transition-colors">Home</a>
                  <span>•</span>
                  <a href="/config" className="hover:text-foreground transition-colors">Config</a>
                  <span>•</span>
                  <a 
                    href="https://github.com/carmelosantana/s1pper-dashboard" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => trackEvent('github_link_click', { location: 'offline_header' })}
                  >
                    <AnimatedShinyText className="flex items-center gap-1">
                      <Github className="h-4 w-4" />
                    </AnimatedShinyText>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Status badge - hidden on desktop, shown centered below title on mobile */}
            <div className="flex justify-center md:hidden">
              <Badge className="bg-red-600/10 dark:bg-red-600/20 hover:bg-red-600/10 text-red-500 border-red-600/60 shadow-none rounded-full text-xs px-3 py-1.5">
                <div className="h-1 w-1 rounded-full bg-red-500 mr-1.5" />
                OFFLINE
              </Badge>
            </div>
            
            {/* Status badge and settings - shown on desktop, hidden on mobile */}
            <div className="hidden md:flex items-center gap-4">
              <Badge className="bg-red-600/10 dark:bg-red-600/20 hover:bg-red-600/10 text-red-500 border-red-600/60 shadow-none rounded-full text-xs px-3 py-1.5">
                <div className="h-1 w-1 rounded-full bg-red-500 mr-1.5" />
                OFFLINE
              </Badge>
              
              {/* Settings Control (development only) */}
              <SettingsControl />
            </div>
          </div>
          
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Printer Offline</h3>
                <p className="text-muted-foreground">
                  Unable to connect to the 3D printer. Please check the printer connection and try again.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Last update attempt: {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isPrinting = printerStatus.print.state === 'printing'
  const progress = Math.round(printerStatus.print.progress * 100)

  // Format temperature data for the chart
  const chartData = temperatureHistory ? temperatureHistory.timestamps.map((time, index) => ({
    time,
    extruder: temperatureHistory.extruder.temperatures[index] || 0,
    bed: temperatureHistory.bed.temperatures[index] || 0
  })) : []

  return (
    <div className="dark min-h-screen bg-black text-foreground p-4 md:p-6">
      <FaviconManager status={printerStatus.print.state} />
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Status Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <SparklesText 
                colors={{ first: '#06b6d4', second: '#8b5cf6' }}
                sparklesCount={12}
                className="flex items-center text-6xl"
              >
                <CupSoda className="h-12 w-12 drop-shadow-lg" />
              </SparklesText>
            </div>
            <div className="flex flex-col">
              <AuroraText 
                colors={['#06b6d4', '#8b5cf6', '#ec4899', '#10b981']}
                className="text-2xl md:text-3xl font-bold text-balance leading-tight"
              >
                {dashboardTitle}
              </AuroraText>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{dashboardSubtitle}</span>
                <span>•</span>
                <a href="/" className="hover:text-foreground transition-colors">Home</a>
                <span>•</span>
                <a href="/config" className="hover:text-foreground transition-colors">Config</a>
                <span>•</span>
                <a 
                  href="https://github.com/carmelosantana/s1pper-dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => trackEvent('github_link_click', { location: 'dashboard_header' })}
                >
                  <AnimatedShinyText className="flex items-center gap-1">
                    <Github className="h-4 w-4" />
                  </AnimatedShinyText>
                </a>
              </div>
            </div>
          </div>
          
          {/* Status badge - hidden on desktop, shown centered below title on mobile */}
          <div className="flex justify-center md:hidden">
            <Badge
              className={
                "text-xs px-3 py-1.5 shadow-none rounded-full " +
                (isPrinting 
                  ? "bg-amber-600/10 dark:bg-amber-600/20 hover:bg-amber-600/10 text-amber-500 border-amber-600/60" 
                  : printerStatus.print.state === 'cancelled'
                  ? "bg-gray-600/10 dark:bg-gray-600/20 hover:bg-gray-600/10 text-gray-500 border-gray-600/60"
                  : "bg-emerald-600/10 dark:bg-emerald-600/20 hover:bg-emerald-600/10 text-emerald-500 border-emerald-600/60")
              }
            >
              <div className={
                "h-1 w-1 rounded-full mr-1.5 " +
                (isPrinting 
                  ? "bg-amber-500 animate-pulse" 
                  : printerStatus.print.state === 'cancelled'
                  ? "bg-gray-500"
                  : "bg-emerald-500")
              } />
              {printerStatus.print.state === 'ready' ? "READY" : printerStatus.print.state.toUpperCase()}
            </Badge>
          </div>
          
          {/* Status badge and settings - shown on desktop, hidden on mobile */}
          <div className="hidden md:flex items-center gap-4">
            <Badge
              className={
                "text-xs px-3 py-1.5 shadow-none rounded-full " +
                (isPrinting 
                  ? "bg-amber-600/10 dark:bg-amber-600/20 hover:bg-amber-600/10 text-amber-500 border-amber-600/60" 
                  : printerStatus.print.state === 'cancelled'
                  ? "bg-gray-600/10 dark:bg-gray-600/20 hover:bg-gray-600/10 text-gray-500 border-gray-600/60"
                  : "bg-emerald-600/10 dark:bg-emerald-600/20 hover:bg-emerald-600/10 text-emerald-500 border-emerald-600/60")
              }
            >
              <div className={
                "h-1 w-1 rounded-full mr-1.5 " +
                (isPrinting 
                  ? "bg-amber-500 animate-pulse" 
                  : printerStatus.print.state === 'cancelled'
                  ? "bg-gray-500"
                  : "bg-emerald-500")
              } />
              {printerStatus.print.state === 'ready' ? "READY" : printerStatus.print.state.toUpperCase()}
            </Badge>
            
            {/* Settings Control (development only) */}
            <SettingsControl />
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Print Progress */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Printer className="h-5 w-5 text-cyan-500" />
                      Print Progress
                    </CardTitle>
                    {/* Finish Time Badge */}
                    {printerStatus.print.estimatedTimeLeft && (
                      <Badge className="bg-purple-600/20 text-purple-300 border-purple-600/40 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {formatFinishTime(printerStatus.print.estimatedTimeLeft)}
                      </Badge>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-cyan-400">{progress}%</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress 
                  value={progress} 
                  className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:via-purple-500 [&>div]:via-pink-500 [&>div]:to-green-500 [&>div]:rounded-full [&>div]:shadow-lg [&>div]:shadow-cyan-500/20" 
                />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Row 1: File Name, Layers */}
                  <div>
                    <p className="text-muted-foreground">File Name</p>
                    <p className="font-mono text-xs text-pretty">
                      {printerStatus.print.filename || 'No file loaded'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Layers</p>
                    <p className="font-mono">
                      {printerStatus.print.currentLayer === -1 || printerStatus.print.totalLayers === -1 
                        ? '█ / █' // Redacted in private mode
                        : (printerStatus.print.currentLayer !== null && printerStatus.print.totalLayers !== null)
                        ? `${printerStatus.print.currentLayer} / ${printerStatus.print.totalLayers}`
                        : '-/-' // Not available
                      }
                    </p>
                  </div>
                  
                  {/* Row 2: File (Total estimated time from slicer), Time left */}
                  <div>
                    <p className="text-muted-foreground">File</p>
                    <p className="font-mono">
                      {printerStatus.print.slicerEstimatedTime ? formatTime(printerStatus.print.slicerEstimatedTime) : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time left</p>
                    <p className="font-mono">
                      {printerStatus.print.estimatedTimeLeft ? formatTime(printerStatus.print.estimatedTimeLeft) : '--'}
                    </p>
                  </div>
                  
                  {/* Row 3: Speed, Filament */}
                  <div>
                    <p className="text-muted-foreground">Speed</p>
                    <p className="font-mono">{Math.round(printerStatus.speeds.current)} mm/s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Filament</p>
                    <p className="font-mono">{formatFilamentLength(printerStatus.print.filamentUsed)}</p>
                  </div>
                  
                  {/* Row 4: Slicer, Total (elapsed print time) */}
                  <div>
                    <p className="text-muted-foreground">Slicer</p>
                    <p className="font-mono">
                      {printerStatus.print.slicerEstimatedTime ? formatTime(printerStatus.print.slicerEstimatedTime) : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-mono">{formatTime(printerStatus.print.printTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Webcam Feed - always show, component handles disabled states internally */}
            <CameraComponent 
              className="bg-zinc-950 border-zinc-800" 
              isPrinting={isPrinting}
              onPrintComplete={printerStatus.print.state === 'complete'}
            />



            {/* Console */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <CardTitle className="text-lg font-semibold">Console</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 font-mono text-xs">
                  <p className="text-green-400">
                    [{lastUpdated.toLocaleTimeString()}] {printerStatus.system.klippyMessage}
                  </p>
                  {isPrinting && (
                    <>
                      <p className="text-blue-400">
                        [{lastUpdated.toLocaleTimeString()}] Printing: {printerStatus.print.filename}
                      </p>
                      <p className="text-muted-foreground">
                        [{lastUpdated.toLocaleTimeString()}] Progress: {progress}%{
                          // Only show layer info if available or redacted
                          (printerStatus.print.currentLayer !== null || printerStatus.print.currentLayer === -1) 
                            ? ` - Layer ${
                                printerStatus.print.currentLayer === -1 
                                  ? '█' // Redacted in private mode
                                  : printerStatus.print.currentLayer
                              }`
                            : '' // Hide layer info when not available
                        }
                      </p>
                    </>
                  )}
                  <p className="text-muted-foreground">
                    [{lastUpdated.toLocaleTimeString()}] System: {printerStatus.system.klippyState}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Lifetime Stats */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-500" />
                  Lifetime
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lifetimeStats ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Jobs</p>
                      <p className="font-mono text-cyan-400">{lifetimeStats.totalJobs.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Print Time</p>
                      <p className="font-mono text-purple-400">{formatLifetimeTime(lifetimeStats.totalPrintTime)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Filament</p>
                      <p className="font-mono text-pink-400">{formatFilamentLength(lifetimeStats.totalFilamentUsed)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Longest Print</p>
                      <p className="font-mono text-green-400">{formatLifetimeTime(lifetimeStats.longestPrint)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground text-sm">Lifetime stats unavailable</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Temperature Monitoring */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg font-semibold">Thermals</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Temperature Stats */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Flame className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Extruder</p>
                        <p className="text-lg font-semibold">{printerStatus.temperatures.extruder.actual}°C</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Target</span>
                        <CircularProgress
                          value={0}
                          currentTemp={printerStatus.temperatures.extruder.actual}
                          targetTemp={printerStatus.temperatures.extruder.target}
                          isTemperatureMode={true}
                          size={32}
                          strokeWidth={3}
                          showLabel={false}
                          disabled={!isPrinting}
                        />
                        <Badge className="bg-muted text-muted-foreground font-mono text-xs">{printerStatus.temperatures.extruder.target}°C</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Power</span>
                        <CircularProgress
                          value={Math.round(printerStatus.temperatures.extruder.power * 100)}
                          size={32}
                          strokeWidth={3}
                          showLabel={false}
                          disabled={!isPrinting}
                        />
                        <Badge className="bg-muted text-muted-foreground font-mono text-xs">{Math.round(printerStatus.temperatures.extruder.power * 100)}%</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Grid2X2 className="h-6 w-6 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Heated Bed</p>
                        <p className="text-lg font-semibold">{printerStatus.temperatures.bed.actual}°C</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Target</span>
                        <CircularProgress
                          value={0}
                          currentTemp={printerStatus.temperatures.bed.actual}
                          targetTemp={printerStatus.temperatures.bed.target}
                          isTemperatureMode={true}
                          size={32}
                          strokeWidth={3}
                          showLabel={false}
                          disabled={!isPrinting}
                        />
                        <Badge className="bg-muted text-muted-foreground font-mono text-xs">{printerStatus.temperatures.bed.target}°C</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Power</span>
                        <CircularProgress
                          value={Math.round(printerStatus.temperatures.bed.power * 100)}
                          size={32}
                          strokeWidth={3}
                          showLabel={false}
                          disabled={!isPrinting}
                        />
                        <Badge className="bg-muted text-muted-foreground font-mono text-xs">{Math.round(printerStatus.temperatures.bed.power * 100)}%</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Temperature Chart */}
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9CA3AF" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontFamily: 'var(--font-roboto-mono)' }}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 5', 'dataMax + 5']}
                        tick={{ fontFamily: 'var(--font-roboto-mono)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="extruder"
                        stroke="#E879F9"
                        strokeWidth={2}
                        dot={false}
                        name="Extruder"
                      />
                      <Line
                        type="monotone"
                        dataKey="bed"
                        stroke="#06B6D4"
                        strokeWidth={2}
                        dot={false}
                        name="Bed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tool */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-cyan-500" />
                  Tool
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Position X</p>
                    <p className="font-mono">{printerStatus.position.x.toFixed(2)} mm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position Y</p>
                    <p className="font-mono">{printerStatus.position.y.toFixed(2)} mm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position Z</p>
                    <p className="font-mono">{printerStatus.position.z.toFixed(2)} mm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Homed Axes</p>
                    <p className="font-mono">{printerStatus.system.homedAxes || 'none'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guestbook */}
            <GuestbookCard className="bg-zinc-950 border-zinc-800" />

          </div>
        </div>
        
        {/* Modules */}
        {enabledModules && enabledModules.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Grid2X2 className="h-6 w-6 text-cyan-500" />
              Modules
            </h2>
            <ModuleRenderer moduleSettings={enabledModules} />
          </div>
        )}
        
        {/* Confetti canvas */}
        <Confetti ref={confettiRef} />
      </div>
    </div>
  )
}