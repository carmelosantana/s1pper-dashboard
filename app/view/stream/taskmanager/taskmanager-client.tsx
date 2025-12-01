"use client"

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Minus, Maximize2, X, ChevronDown, Camera, Plus, Trash2 } from 'lucide-react'
import { usePrinterData } from '@/lib/hooks/use-printer-data'
import type { PrinterStatus, WebcamConfig } from '@/lib/types'
import type { SystemStats, SystemInfo } from '@/app/api/printer/system-stats/route'

// Local storage keys
const SNAPSHOT_CAMERAS_KEY = 'taskmanager_snapshot_cameras'
const CHROMA_CAMERAS_KEY = 'taskmanager_chroma_cameras'

// Chroma camera configuration type
interface ChromaCamera {
  id: string
  title: string
  url: string
  framerate: 15 | 30 | 60
  chromaColor: 'green' | 'blue' | 'custom'
  customColor?: string
}

// Windows XP Task Manager tabs - reordered with Klipper (Performance) first
type TabType = 'klipper' | 'applications' | 'processes' | 'networking' | 'users'

interface TaskManagerClientProps {
  initialStatus: PrinterStatus | null
  initialSystemStats: SystemStats | null
  initialSystemInfo: SystemInfo | null
}

// Windows XP color palette - authentic colors
const XP_COLORS = {
  // Window chrome
  titleBarStart: '#0054E3',
  titleBarEnd: '#0054E3',
  titleBarActive: 'linear-gradient(180deg, #0054E3 0%, #0047CC 50%, #003EB8 100%)',
  windowBg: '#ECE9D8',
  // Tab and content
  tabBg: '#ECE9D8',
  tabActiveBg: '#FFFFFF',
  tabBorder: '#919B9C',
  contentBg: '#FFFFFF',
  // Graphs - authentic XP green
  graphBg: '#000000',
  graphGrid: '#003200',
  graphLine: '#00FF00',
  graphLineAlt: '#FFFF00',
  graphLineRed: '#FF0000',
  // Text
  labelText: '#000000',
  valueText: '#000000',
  // Headers and borders
  headerBg: '#D4D0C8',
  headerText: '#000000',
  border: '#808080',
  borderLight: '#FFFFFF',
  borderDark: '#404040',
  // Status bar
  statusBg: '#ECE9D8',
  // Window buttons
  closeBtn: '#E04343',
  closeBtnHover: '#FF5555',
  minBtn: '#3C6EAF',
  maxBtn: '#3C6EAF',
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format time from seconds
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

// Format filament in meters
function formatFilament(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`
  }
  return `${mm.toFixed(0)} mm`
}

// Get color based on power percentage (for thermometer status)
function getPowerColor(powerPercent: number): string {
  if (powerPercent >= 80) return '#FF0000' // Red - high power
  if (powerPercent >= 50) return '#FFFF00' // Yellow - medium power
  return '#00FF00' // Green - low power
}

// XP-style Graph Component with optional second line - memoized for performance
const XPGraph = memo(function XPGraph({ 
  data, 
  data2,
  maxValue = 100, 
  height = 100,
  title,
  showGrid = true,
  lineColor = XP_COLORS.graphLine,
  line2Color = XP_COLORS.graphLineAlt,
  className = ''
}: { 
  data: number[]
  data2?: number[]
  maxValue?: number
  height?: number
  title?: string
  showGrid?: boolean
  lineColor?: string
  line2Color?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 200, height })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setDimensions({ width: rect.width, height })
        }
      }
    }
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateDimensions)
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height: h } = dimensions
    
    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Fill background - ensure it's always black
    ctx.fillStyle = XP_COLORS.graphBg
    ctx.fillRect(0, 0, width, h)

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = XP_COLORS.graphGrid
      ctx.lineWidth = 1

      const vSpacing = 20
      for (let x = width; x >= 0; x -= vSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      const hSpacing = 20
      for (let y = 0; y <= h; y += hSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    }

    // Draw second data line (if provided) - drawn first so primary line is on top
    if (data2 && data2.length > 1) {
      ctx.strokeStyle = line2Color
      ctx.lineWidth = 1
      ctx.beginPath()

      const pointSpacing = width / (data2.length - 1)
      
      data2.forEach((value, index) => {
        const x = index * pointSpacing
        const y = h - (Math.min(value, maxValue) / maxValue) * h
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
    }

    // Draw primary data line
    if (data.length > 1) {
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.beginPath()

      const pointSpacing = width / (data.length - 1)
      
      data.forEach((value, index) => {
        const x = index * pointSpacing
        const y = h - (Math.min(value, maxValue) / maxValue) * h
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
    }
  }, [data, data2, dimensions, maxValue, showGrid, lineColor, line2Color])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {title && (
        <div className="text-xs text-black mb-1 font-['Tahoma']">{title}</div>
      )}
      <div 
        className="border-2"
        style={{
          borderColor: `${XP_COLORS.borderDark} ${XP_COLORS.borderLight} ${XP_COLORS.borderLight} ${XP_COLORS.borderDark}`,
          backgroundColor: XP_COLORS.graphBg
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: '100%', 
            height: `${height}px`,
            display: 'block',
            backgroundColor: XP_COLORS.graphBg
          }}
        />
      </div>
    </div>
  )
})

// XP-style Vertical Bar Component (like PF Usage) - memoized for performance
const XPVerticalBar = memo(function XPVerticalBar({
  value,
  maxValue = 100,
  height = 90,
  title,
  displayValue,
  color = XP_COLORS.graphLine
}: {
  value: number
  maxValue?: number
  height?: number
  title?: string
  displayValue?: string
  color?: string
}) {
  const percentage = Math.min((value / maxValue) * 100, 100)
  
  return (
    <div className="w-full">
      {title && (
        <div className="text-xs text-black mb-1 font-['Tahoma']">{title}</div>
      )}
      <div 
        className="border-2 relative w-full"
        style={{
          borderColor: `${XP_COLORS.borderDark} ${XP_COLORS.borderLight} ${XP_COLORS.borderLight} ${XP_COLORS.borderDark}`,
          height: `${height}px`,
          backgroundColor: '#000000',
          minWidth: '40px'
        }}
      >
        {/* Bar fill */}
        <div 
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{ height: `${percentage}%`, backgroundColor: color }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-full border-t"
              style={{ top: `${(i + 1) * 20}%`, borderColor: XP_COLORS.graphGrid }}
            />
          ))}
        </div>
        {/* Value text */}
        {displayValue && (
          <div 
            className="absolute bottom-1 left-1 font-['Tahoma'] text-[10px] font-bold"
            style={{ 
              color,
              textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000'
            }}
          >
            {displayValue}
          </div>
        )}
      </div>
    </div>
  )
})

// XP-style Tab Button - smaller text - memoized for performance
const XPTabButton = memo(function XPTabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-0.5 text-xs font-['Tahoma'] border-t border-l border-r text-black
        ${active 
          ? 'bg-white border-[#919B9C] -mb-px z-10 relative' 
          : 'bg-[#ECE9D8] border-[#919B9C] hover:bg-[#F5F4EF]'
        }
      `}
      style={{
        borderTopLeftRadius: '3px',
        borderTopRightRadius: '3px',
        color: '#000000',
      }}
    >
      {children}
    </button>
  )
})

// Main Task Manager Component
export default function TaskManagerClient({
  initialStatus,
  initialSystemStats,
  initialSystemInfo
}: TaskManagerClientProps) {
  const { printerStatus, isConnected } = usePrinterData()
  const [activeTab, setActiveTab] = useState<TabType>('klipper')
  const [systemStats, setSystemStats] = useState<SystemStats | null>(initialSystemStats)
  const [systemInfo] = useState<SystemInfo | null>(initialSystemInfo)
  const [showShutdownDialog, setShowShutdownDialog] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  
  // Snapshot camera state
  const [availableWebcams, setAvailableWebcams] = useState<WebcamConfig[]>([])
  const [selectedSnapshotCameras, setSelectedSnapshotCameras] = useState<string[]>([])
  const [snapshotUrls, setSnapshotUrls] = useState<Record<string, string>>({})
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now())
  
  // Chroma/Live Video camera state
  const [chromaCameras, setChromaCameras] = useState<ChromaCamera[]>([])
  const [showChromaDialog, setShowChromaDialog] = useState(false)
  const [editingChromaCameras, setEditingChromaCameras] = useState<ChromaCamera[]>([])
  
  // Snapshot dialog state
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // History for graphs (keep last 60 data points for ~1 minute of history)
  const [extruderHistory, setExtruderHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [extruderTargetHistory, setExtruderTargetHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [bedHistory, setBedHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [bedTargetHistory, setBedTargetHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [progressHistory, setProgressHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [networkHistory, setNetworkHistory] = useState<Record<string, number[]>>(() => ({}))
  
  // Use ref to track the latest printer status for the interval
  const statusRef = useRef<PrinterStatus | null>(null)
  
  // Keep ref in sync with latest status
  const status = printerStatus || initialStatus
  useEffect(() => {
    statusRef.current = status
  }, [status])
  
  // Fetch system stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/printer/system-stats')
        if (response.ok) {
          const data = await response.json()
          setSystemStats(data.stats)
          
          // Update network history
          if (data.stats?.network) {
            setNetworkHistory(prev => {
              const newHistory = { ...prev }
              Object.entries(data.stats.network).forEach(([iface, netData]) => {
                const typedData = netData as { bandwidth: number }
                if (!newHistory[iface]) {
                  newHistory[iface] = new Array(60).fill(0)
                }
                newHistory[iface] = [...newHistory[iface].slice(1), Math.min(typedData.bandwidth / 1000, 100)]
              })
              return newHistory
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch system stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 2000) // Reduced frequency for performance
    return () => clearInterval(interval)
  }, [])

  // Update temperature histories on a fixed interval (1 second)
  // This ensures smooth graph updates regardless of WebSocket timing
  useEffect(() => {
    const updateHistories = () => {
      const currentStatus = statusRef.current
      if (!currentStatus) return
      
      // Update extruder history
      setExtruderHistory(prev => [...prev.slice(1), currentStatus.temperatures.extruder.actual])
      setExtruderTargetHistory(prev => [...prev.slice(1), currentStatus.temperatures.extruder.target])
      
      // Update bed history
      setBedHistory(prev => [...prev.slice(1), currentStatus.temperatures.bed.actual])
      setBedTargetHistory(prev => [...prev.slice(1), currentStatus.temperatures.bed.target])
      
      // Update progress history
      setProgressHistory(prev => [...prev.slice(1), currentStatus.print.progress * 100])
    }
    
    // Update immediately with current data
    updateHistories()
    
    // Then update every second
    const interval = setInterval(updateHistories, 1000)
    return () => clearInterval(interval)
  }, [])

  // Load selected cameras from localStorage and fetch available webcams
  useEffect(() => {
    // Load saved selection from localStorage
    const savedCameras = localStorage.getItem(SNAPSHOT_CAMERAS_KEY)
    if (savedCameras) {
      try {
        setSelectedSnapshotCameras(JSON.parse(savedCameras))
      } catch (e) {
        console.error('Failed to parse saved camera selection:', e)
      }
    }
    
    // Load saved chroma cameras from localStorage
    const savedChromaCameras = localStorage.getItem(CHROMA_CAMERAS_KEY)
    if (savedChromaCameras) {
      try {
        setChromaCameras(JSON.parse(savedChromaCameras))
      } catch (e) {
        console.error('Failed to parse saved chroma cameras:', e)
      }
    }
    
    // Fetch available webcams
    const fetchWebcams = async () => {
      try {
        const response = await fetch('/api/camera/data')
        if (response.ok) {
          const data = await response.json()
          if (data.webcams) {
            setAvailableWebcams(data.webcams)
          }
        }
      } catch (error) {
        console.error('Failed to fetch webcams:', error)
      }
    }
    fetchWebcams()
  }, [])

  // Refresh snapshots every 5 seconds for selected cameras
  useEffect(() => {
    if (selectedSnapshotCameras.length === 0) return
    
    const refreshSnapshots = () => {
      setSnapshotTimestamp(Date.now())
    }
    
    // Initial load
    refreshSnapshots()
    
    // Refresh every 5 seconds
    const interval = setInterval(refreshSnapshots, 5000)
    return () => clearInterval(interval)
  }, [selectedSnapshotCameras])

  // Handle camera selection change
  const handleCameraSelectionChange = useCallback((cameraUid: string, checked: boolean) => {
    setSelectedSnapshotCameras(prev => {
      const newSelection = checked 
        ? [...prev, cameraUid]
        : prev.filter(uid => uid !== cameraUid)
      
      // Save to localStorage
      localStorage.setItem(SNAPSHOT_CAMERAS_KEY, JSON.stringify(newSelection))
      return newSelection
    })
  }, [])

  // Chroma dialog handlers
  const openChromaDialog = useCallback(() => {
    setEditingChromaCameras([...chromaCameras])
    setShowChromaDialog(true)
  }, [chromaCameras])

  const addChromaCamera = useCallback(() => {
    const newCamera: ChromaCamera = {
      id: `chroma_${Date.now()}`,
      title: `Camera ${editingChromaCameras.length + 1}`,
      url: '',
      framerate: 30,
      chromaColor: 'green',
    }
    setEditingChromaCameras(prev => [...prev, newCamera])
  }, [editingChromaCameras.length])

  const updateChromaCamera = useCallback((id: string, updates: Partial<ChromaCamera>) => {
    setEditingChromaCameras(prev => 
      prev.map(cam => cam.id === id ? { ...cam, ...updates } : cam)
    )
  }, [])

  const removeChromaCamera = useCallback((id: string) => {
    setEditingChromaCameras(prev => prev.filter(cam => cam.id !== id))
  }, [])

  const saveChromaCameras = useCallback(() => {
    setChromaCameras(editingChromaCameras)
    localStorage.setItem(CHROMA_CAMERAS_KEY, JSON.stringify(editingChromaCameras))
    setShowChromaDialog(false)
  }, [editingChromaCameras])

  // Get chroma color CSS value
  const getChromaColorValue = useCallback((camera: ChromaCamera) => {
    switch (camera.chromaColor) {
      case 'green': return '#00FF00'
      case 'blue': return '#0000FF'
      case 'custom': return camera.customColor || '#00FF00'
      default: return '#00FF00'
    }
  }, [])

  const stats = systemStats
  const services = systemInfo?.services || {}
  const serviceEntries = Object.entries(services)

  // Use printerStatus directly for real-time updates, fallback to initialStatus
  const liveStatus = printerStatus || initialStatus
  
  // Printer values - computed from live status for real-time updates
  const extruderActual = liveStatus?.temperatures.extruder.actual || 0
  const extruderTarget = liveStatus?.temperatures.extruder.target || 0
  const extruderPower = liveStatus?.temperatures.extruder.power || 0
  const bedActual = liveStatus?.temperatures.bed.actual || 0
  const bedTarget = liveStatus?.temperatures.bed.target || 0
  const bedPower = liveStatus?.temperatures.bed.power || 0
  const printProgress = (liveStatus?.print.progress || 0) * 100
  const printState = liveStatus?.print.state || 'offline'
  const filename = liveStatus?.print.filename || 'No active print'
  const printTime = liveStatus?.print.printTime || 0
  const estimatedTimeLeft = liveStatus?.print.estimatedTimeLeft || 0
  const filamentUsed = liveStatus?.print.filamentUsed || 0
  const currentLayer = liveStatus?.print.currentLayer || 0
  const totalLayers = liveStatus?.print.totalLayers || 0
  const currentSpeed = liveStatus?.speeds?.current || 0

  // Render Applications Tab - Shows running print jobs (like Windows apps)
  const renderApplicationsTab = () => {
    // Map print state to display status
    const getStatusText = () => {
      switch (printState) {
        case 'printing': return 'Running'
        case 'paused': return 'Paused'
        case 'complete': return 'Completed'
        case 'cancelled': return 'Stopped'
        case 'error': return 'Error'
        default: return 'Idle'
      }
    }
    
    return (
      <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-2 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
          <div className="px-2 py-1 border-r border-[#FFFFFF]">Task</div>
          <div className="px-2 py-1">Status</div>
        </div>
        
        {/* Task list */}
        <div className="flex-1 overflow-y-auto bg-white">
          {printState === 'printing' || printState === 'paused' || printState === 'complete' ? (
            <div className={`grid grid-cols-2 text-black ${printState === 'printing' ? 'bg-[#316AC5] text-white' : 'bg-white'}`}>
              <div className="px-2 py-1 truncate flex items-center gap-2">
                <span>📄</span> {filename || 'Unknown Job'}
              </div>
              <div className="px-2 py-1">{getStatusText()}</div>
            </div>
          ) : (
            <div className="text-black text-center py-8">
              No tasks running.
            </div>
          )}
        </div>
        
        {/* Status bar at bottom instead of buttons */}
        <div className="p-2 border-t border-[#919B9C] text-black text-[10px]">
          {printState === 'printing' || printState === 'paused' ? (
            <span>Progress: {printProgress.toFixed(0)}% • Layer: {currentLayer}/{totalLayers || '?'}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </div>
    )
  }

  // Render Processes Tab - Shows printer components like Windows processes
  const renderProcessesTab = () => (
    <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-4 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
        <div className="px-2 py-1 border-r border-[#FFFFFF]">Image Name</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF]">PID</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF] text-right">CPU</div>
        <div className="px-2 py-1 text-right">Mem Usage</div>
      </div>
      
      {/* Process list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Klipper */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">klippy.py</div>
          <div className="px-2 py-0.5">{stats?.system?.cpuUsage?.cores?.length || '1'}</div>
          <div className="px-2 py-0.5 text-right">{((stats?.system?.cpuUsage?.total || 0) * 0.6).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{formatBytes((stats?.system?.memory?.used || 0) * 0.4)}</div>
        </div>
        
        {/* Moonraker */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">moonraker.py</div>
          <div className="px-2 py-0.5">2</div>
          <div className="px-2 py-0.5 text-right">{((stats?.system?.cpuUsage?.total || 0) * 0.2).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{formatBytes((stats?.system?.memory?.used || 0) * 0.2)}</div>
        </div>
        
        {/* Hotend Heater */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">heater_extruder</div>
          <div className="px-2 py-0.5">3</div>
          <div className="px-2 py-0.5 text-right">{(extruderPower * 100).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{extruderActual.toFixed(0)}°C</div>
        </div>
        
        {/* Bed Heater */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">heater_bed</div>
          <div className="px-2 py-0.5">4</div>
          <div className="px-2 py-0.5 text-right">{(bedPower * 100).toFixed(0)}%</div>
          <div className="px-2 py-0.5 text-right">{bedActual.toFixed(0)}°C</div>
        </div>
        
        {/* Stepper Motors */}
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_x</div>
          <div className="px-2 py-0.5">5</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '12%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_y</div>
          <div className="px-2 py-0.5">6</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '12%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        <div className="grid grid-cols-4 text-black bg-white hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">stepper_z</div>
          <div className="px-2 py-0.5">7</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '5%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>
        
        {/* Part Fan */}
        <div className="grid grid-cols-4 text-black bg-[#F5F5F5] hover:bg-[#316AC5] hover:text-white">
          <div className="px-2 py-0.5 truncate">fan</div>
          <div className="px-2 py-0.5">8</div>
          <div className="px-2 py-0.5 text-right">{printState === 'printing' ? '100%' : '0%'}</div>
          <div className="px-2 py-0.5 text-right">N/A</div>
        </div>

        {/* Services from system info */}
        {serviceEntries.map(([name, data], idx) => (
          <div 
            key={name}
            className={`grid grid-cols-4 text-black ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F5]'} hover:bg-[#316AC5] hover:text-white`}
          >
            <div className="px-2 py-0.5 truncate">{name}</div>
            <div className="px-2 py-0.5">{10 + idx}</div>
            <div className="px-2 py-0.5 text-right">{data.activeState === 'active' ? '1%' : '0%'}</div>
            <div className="px-2 py-0.5 text-right">{data.activeState}</div>
          </div>
        ))}
      </div>
      
      {/* Checkbox and button */}
      <div className="flex justify-between items-center p-2 border-t border-[#919B9C]">
        <label className="flex items-center gap-1 text-black">
          <input type="checkbox" defaultChecked className="w-3 h-3" />
          Show processes from all users
        </label>
        <button 
          className="px-4 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black"
          style={{ borderRadius: '2px' }}
        >
          End Process
        </button>
      </div>
    </div>
  )

  // Render Klipper Tab (formerly Performance) - matching Windows XP layout
  const renderKlipperTab = () => (
    <div className="p-3 font-['Tahoma'] text-xs">
      {/* Live Video Section - Shows chroma key camera feeds */}
      {chromaCameras.length > 0 && (
        <div className="mb-3">
          <div className="text-black font-bold mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Live Video
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {chromaCameras.map(camera => (
              <div 
                key={camera.id}
                style={{ 
                  border: '1px solid #919B9C',
                  boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
                }}
              >
                {/* Camera name header */}
                <div 
                  className="px-2 py-1 text-black font-bold flex items-center justify-between"
                  style={{
                    backgroundColor: '#D4D0C8',
                    borderBottom: '1px solid #808080',
                    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
                  }}
                >
                  <span className="truncate">{camera.title}</span>
                  <div className="flex items-center gap-1">
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getChromaColorValue(camera) }}
                    />
                    <span 
                      className="text-[8px] bg-[#316AC5] text-white px-1.5 py-0.5 rounded"
                      style={{ fontSize: '8px' }}
                    >
                      {camera.framerate}fps
                    </span>
                  </div>
                </div>
                {/* Video feed with chroma background */}
                <div 
                  className="relative"
                  style={{ 
                    backgroundColor: getChromaColorValue(camera),
                    aspectRatio: '16/9'
                  }}
                >
                  {camera.url && (
                    <img
                      src={camera.url}
                      alt={`${camera.title} feed`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Snapshots Section - Only show when cameras are selected */}
      {selectedSnapshotCameras.length > 0 && (
        <div className="mb-3">
          <div className="text-black font-bold mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Camera Snapshots
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedSnapshotCameras.map(cameraUid => {
              const camera = availableWebcams.find(w => w.uid === cameraUid)
              if (!camera) return null
              
              return (
                <div 
                  key={cameraUid}
                  style={{ 
                    border: '1px solid #919B9C',
                    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
                  }}
                >
                  {/* Camera name header */}
                  <div 
                    className="px-2 py-1 text-black font-bold flex items-center justify-between"
                    style={{
                      backgroundColor: '#D4D0C8',
                      borderBottom: '1px solid #808080',
                      boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
                    }}
                  >
                    <span className="truncate">{camera.name}</span>
                    <span 
                      className="text-[8px] bg-[#316AC5] text-white px-1.5 py-0.5 rounded"
                      style={{ fontSize: '8px' }}
                    >
                      5s
                    </span>
                  </div>
                  {/* Snapshot image */}
                  <div 
                    className="relative"
                    style={{ 
                      backgroundColor: '#000000',
                      aspectRatio: camera.aspect_ratio === '16:9' ? '16/9' : '4/3'
                    }}
                  >
                    <img
                      src={`/api/camera/snapshot?uid=${cameraUid}&t=${snapshotTimestamp}`}
                      alt={`${camera.name} snapshot`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top row: Small gauge + History graph (like CPU Usage + CPU Usage History) */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {/* Hotend Usage - small vertical gauge */}
        <div>
          <div className="text-black font-bold mb-1">Hotend Usage</div>
          <XPVerticalBar
            value={extruderPower * 100}
            maxValue={100}
            height={80}
            displayValue={`${(extruderPower * 100).toFixed(0)} %`}
            color={getPowerColor(extruderPower * 100)}
          />
        </div>
        
        {/* Hotend Usage History */}
        <div className="col-span-3">
          <div className="text-black font-bold mb-1">Hotend Usage History</div>
          <XPGraph 
            data={extruderHistory}
            data2={extruderTargetHistory}
            maxValue={300}
            height={80}
            lineColor={XP_COLORS.graphLine}
            line2Color={XP_COLORS.graphLineRed}
          />
        </div>
      </div>

      {/* Second row: PF Usage equivalent + Page File History (Bed) */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {/* Bed Usage - small vertical gauge */}
        <div>
          <div className="text-black font-bold mb-1">Bed Usage</div>
          <XPVerticalBar
            value={bedPower * 100}
            maxValue={100}
            height={80}
            displayValue={`${(bedPower * 100).toFixed(0)} %`}
            color={getPowerColor(bedPower * 100)}
          />
        </div>
        
        {/* Bed Usage History */}
        <div className="col-span-3">
          <div className="text-black font-bold mb-1">Bed Usage History</div>
          <XPGraph 
            data={bedHistory}
            data2={bedTargetHistory}
            maxValue={120}
            height={80}
            lineColor={XP_COLORS.graphLine}
            line2Color={XP_COLORS.graphLineRed}
          />
        </div>
      </div>

      {/* Bottom stats boxes - 3 columns like XP */}
      <div className="grid grid-cols-3 gap-3">
        {/* Totals (like Handles, Threads, Processes) */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">Totals</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>Layers</span>
            <span className="text-right">{currentLayer}</span>
            <span>Total</span>
            <span className="text-right">{totalLayers || '?'}</span>
            <span>Progress</span>
            <span className="text-right">{printProgress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Physical Memory equivalent - Temperatures */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">Temperatures (°C)</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>Hotend</span>
            <span className="text-right">{extruderActual.toFixed(0)}</span>
            <span>Target</span>
            <span className="text-right">{extruderTarget.toFixed(0)}</span>
            <span>Bed</span>
            <span className="text-right">{bedActual.toFixed(0)}</span>
          </div>
        </div>

        {/* Commit Charge equivalent - Print Job */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">Print Job</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>Elapsed</span>
            <span className="text-right">{formatTime(printTime)}</span>
            <span>Remaining</span>
            <span className="text-right">{formatTime(estimatedTimeLeft)}</span>
            <span>Filament</span>
            <span className="text-right">{formatFilament(filamentUsed)}</span>
          </div>
        </div>
      </div>

      {/* Second row of stats */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        {/* Kernel Memory equivalent - System */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">System (K)</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>CPU</span>
            <span className="text-right">{((stats?.system?.cpuUsage?.total || 0)).toFixed(0)}%</span>
            <span>Memory</span>
            <span className="text-right">{formatBytes(stats?.system?.memory?.used || 0)}</span>
            <span>Available</span>
            <span className="text-right">{formatBytes(stats?.system?.memory?.available || 0)}</span>
          </div>
        </div>

        {/* Speed info */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">Kinematics</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>Speed</span>
            <span className="text-right">{currentSpeed.toFixed(0)} mm/s</span>
            <span>State</span>
            <span className="text-right">{printState}</span>
            <span>WebSockets</span>
            <span className="text-right">{stats?.websocketConnections || 0}</span>
          </div>
        </div>

        {/* Uptime */}
        <div 
          className="border p-2"
          style={{ 
            borderColor: '#919B9C',
            boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
          }}
        >
          <div className="font-bold text-black mb-1">Uptime</div>
          <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
            <span>System</span>
            <span className="text-right">{formatTime(stats?.system?.uptime || 0)}</span>
            <span>Moonraker</span>
            <span className="text-right">{formatTime(stats?.moonraker?.time || 0)}</span>
            <span>CPU Temp</span>
            <span className="text-right">{stats?.system?.cpuTemp?.toFixed(0) || 'N/A'}°C</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Networking Tab
  const renderNetworkingTab = () => {
    const networks = stats?.network || {}
    const networkEntries = Object.entries(networks)

    return (
      <div className="p-3 h-full font-['Tahoma'] text-xs overflow-auto">
        <div className="grid grid-cols-1 gap-4">
          {networkEntries.length > 0 ? (
            networkEntries.map(([iface, data]) => (
              <div key={iface}>
                <XPGraph 
                  data={networkHistory[iface] || new Array(60).fill(0)}
                  maxValue={100}
                  height={70}
                  title={`${iface} - Network Utilization`}
                />
                <div className="mt-2 text-black">
                  <div className="grid grid-cols-2 gap-x-4">
                    <span>Bytes Received:</span>
                    <span className="text-right">{formatBytes(data.rxBytes)}</span>
                    <span>Bytes Sent:</span>
                    <span className="text-right">{formatBytes(data.txBytes)}</span>
                    <span>Bandwidth:</span>
                    <span className="text-right">{data.bandwidth.toFixed(2)} bytes/s</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-black text-center py-8">
              No network interfaces available
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render Users Tab
  const renderUsersTab = () => (
    <div className="p-1 h-full font-['Tahoma'] text-xs flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-3 bg-[#D4D0C8] border-b border-[#808080] text-black font-bold">
        <div className="px-2 py-1 border-r border-[#FFFFFF]">User</div>
        <div className="px-2 py-1 border-r border-[#FFFFFF]">Session</div>
        <div className="px-2 py-1">Status</div>
      </div>
      
      {/* User list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="grid grid-cols-3 text-black bg-white">
          <div className="px-2 py-0.5 truncate">pi</div>
          <div className="px-2 py-0.5">Console</div>
          <div className="px-2 py-0.5">Active</div>
        </div>
        {(stats?.websocketConnections || 0) > 0 && (
          <div className="grid grid-cols-3 text-black bg-[#F5F5F5]">
            <div className="px-2 py-0.5 truncate">WebSocket ({stats?.websocketConnections})</div>
            <div className="px-2 py-0.5">Remote</div>
            <div className="px-2 py-0.5">Active</div>
          </div>
        )}
      </div>
    </div>
  )

  // Emergency shutdown handler
  const handleEmergencyShutdown = async () => {
    if (!isDevelopment) return
    
    setIsShuttingDown(true)
    try {
      const response = await fetch('/api/printer/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        console.error('Emergency shutdown failed')
      }
    } catch (error) {
      console.error('Emergency shutdown error:', error)
    } finally {
      setIsShuttingDown(false)
      setShowShutdownDialog(false)
    }
  }

  // Get favicon suffix based on print state
  const getFaviconSuffix = () => {
    switch (printState) {
      case 'printing': return 'printing'
      case 'cancelled': return 'cancelled'
      case 'offline':
      case 'error': return 'offline'
      default: return 'ready'
    }
  }

  const faviconSuffix = getFaviconSuffix()
  
  // Connection status for status bar (like other views)
  const connectionStatus = isConnected ? 'Connected' : 'Reconnecting...'

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-2 md:p-4"
      style={{
        backgroundImage: 'url(/background/windows-xp-01.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
      }}
    >
      {/* Chroma Camera Configuration Dialog */}
      {showChromaDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="w-96 shadow-lg"
            style={{
              backgroundColor: XP_COLORS.windowBg,
              border: '2px outset #FFFFFF',
              borderRadius: '8px',
            }}
          >
            {/* Dialog Title Bar */}
            <div 
              className="flex items-center justify-between px-2 py-1"
              style={{
                background: 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 50%, #003EB8 100%)',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
              }}
            >
              <span className="text-white text-xs font-bold">Chroma Cameras</span>
              <button 
                className="w-4 h-4 rounded-sm flex items-center justify-center text-white"
                style={{
                  background: 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
                onClick={() => setShowChromaDialog(false)}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
            
            {/* Dialog Content */}
            <div className="p-3 overflow-y-auto" style={{ maxHeight: '50vh' }}>
              <p className="text-black text-[11px] mb-3">
                Add cameras for live video display with chroma key backgrounds. These feeds will appear in the Live Video section.
              </p>
              
              {/* Camera list */}
              <div className="space-y-3">
                {editingChromaCameras.map((camera, index) => (
                  <div 
                    key={camera.id}
                    className="p-2 border-2"
                    style={{ 
                      borderColor: '#808080',
                      boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.2), inset -1px -1px 0 #FFFFFF',
                      backgroundColor: '#F5F5F5',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-black font-bold text-xs">Camera {index + 1}</span>
                      <button
                        onClick={() => removeChromaCamera(camera.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove camera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Title */}
                    <div className="mb-2">
                      <label className="block text-black text-[10px] mb-0.5">Title</label>
                      <input
                        type="text"
                        value={camera.title}
                        onChange={(e) => updateChromaCamera(camera.id, { title: e.target.value })}
                        className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
                        placeholder="Camera name"
                      />
                    </div>
                    
                    {/* URL */}
                    <div className="mb-2">
                      <label className="block text-black text-[10px] mb-0.5">Stream URL</label>
                      <input
                        type="text"
                        value={camera.url}
                        onChange={(e) => updateChromaCamera(camera.id, { url: e.target.value })}
                        className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
                        placeholder="http://..."
                      />
                    </div>
                    
                    {/* Framerate and Chroma color row */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Framerate */}
                      <div>
                        <label className="block text-black text-[10px] mb-0.5">Framerate</label>
                        <select
                          value={camera.framerate}
                          onChange={(e) => updateChromaCamera(camera.id, { framerate: parseInt(e.target.value) as 15 | 30 | 60 })}
                          className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
                        >
                          <option value={15}>15 fps</option>
                          <option value={30}>30 fps</option>
                          <option value={60}>60 fps</option>
                        </select>
                      </div>
                      
                      {/* Chroma Color */}
                      <div>
                        <label className="block text-black text-[10px] mb-0.5">Chroma Color</label>
                        <select
                          value={camera.chromaColor}
                          onChange={(e) => updateChromaCamera(camera.id, { chromaColor: e.target.value as 'green' | 'blue' | 'custom' })}
                          className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
                        >
                          <option value="green">Green</option>
                          <option value="blue">Blue</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Custom color picker */}
                    {camera.chromaColor === 'custom' && (
                      <div className="mt-2">
                        <label className="block text-black text-[10px] mb-0.5">Custom Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={camera.customColor || '#00FF00'}
                            onChange={(e) => updateChromaCamera(camera.id, { customColor: e.target.value })}
                            className="w-8 h-6 border border-[#808080] cursor-pointer"
                          />
                          <input
                            type="text"
                            value={camera.customColor || '#00FF00'}
                            onChange={(e) => updateChromaCamera(camera.id, { customColor: e.target.value })}
                            className="flex-1 px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
                            placeholder="#00FF00"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Add camera button */}
              <button
                onClick={addChromaCamera}
                className="w-full mt-3 px-3 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black flex items-center justify-center gap-2"
                style={{ borderRadius: '2px' }}
              >
                <Plus className="w-3 h-3" />
                Add Camera
              </button>
            </div>
            
            {/* Dialog buttons */}
            <div className="flex justify-end gap-2 p-3 border-t border-[#808080]">
              <button
                onClick={() => setShowChromaDialog(false)}
                className="px-4 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black"
                style={{ borderRadius: '2px' }}
              >
                Cancel
              </button>
              <button
                onClick={saveChromaCameras}
                className="px-4 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black"
                style={{ borderRadius: '2px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots Configuration Dialog */}
      {showSnapshotDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div 
            className="w-80 shadow-lg"
            style={{
              backgroundColor: XP_COLORS.windowBg,
              border: '2px outset #FFFFFF',
              borderRadius: '8px',
            }}
          >
            {/* Dialog title bar */}
            <div 
              className="flex items-center justify-between px-2 py-1"
              style={{
                background: 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 50%, #003EB8 100%)',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
              }}
            >
              <span className="text-white text-xs font-bold">Camera Snapshots</span>
              <button 
                className="w-4 h-4 rounded-sm flex items-center justify-center text-white"
                style={{
                  background: 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
                onClick={() => setShowSnapshotDialog(false)}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
            {/* Dialog content */}
            <div className="p-3">
              <p className="text-[11px] text-black mb-3">
                Select cameras to display in the snapshot section.
              </p>
              <div className="space-y-1">
                {availableWebcams.length > 0 ? (
                  availableWebcams.map(camera => (
                    <label 
                      key={camera.uid}
                      className="flex items-center gap-2 px-2 py-1 text-[11px] text-black hover:bg-[#316AC5] hover:text-white cursor-pointer rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSnapshotCameras.includes(camera.uid)}
                        onChange={(e) => handleCameraSelectionChange(camera.uid, e.target.checked)}
                        className="w-3 h-3"
                      />
                      <Camera className="w-3 h-3" />
                      <span className="truncate">{camera.name}</span>
                    </label>
                  ))
                ) : (
                  <div className="text-gray-500 italic text-[11px]">
                    No cameras available
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  className="px-3 py-0.5 text-[10px] text-black"
                  style={{
                    backgroundColor: XP_COLORS.windowBg,
                    border: '2px outset #FFFFFF',
                    borderRadius: '3px',
                  }}
                  onClick={() => setShowSnapshotDialog(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Windows XP Window Frame */}
      <div 
        className="w-full max-w-4xl flex flex-col shadow-2xl"
        style={{
          height: 'calc(100vh - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          borderRadius: '8px 8px 4px 4px',
          border: '1px solid #0054E3',
          overflow: 'hidden',
        }}
      >
        {/* Title Bar - XP Blue Gradient */}
        <div 
          className="flex items-center justify-between px-2 py-1 select-none"
          style={{
            background: 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 10%, #0047CC 50%, #003EB8 90%, #002B8C 100%)',
            borderTopLeftRadius: '7px',
            borderTopRightRadius: '7px',
            height: '26px',
            minHeight: '26px',
          }}
        >
          {/* Title with favicon */}
          <div className="flex items-center gap-2">
            {/* Status-based favicon */}
            <img 
              src={`/favicon-${printState}-48x48.png`}
              alt="Printer Status"
              className="w-4 h-4"
              onError={(e) => {
                // Fallback to default if status favicon doesn't exist
                (e.target as HTMLImageElement).src = '/apple-touch-icon.png'
              }}
            />
            <span className="text-white text-xs font-bold drop-shadow-sm" style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.3)' }}>
              s1pper3d Print Manager
            </span>
          </div>
          
          {/* Window Buttons - XP style with white borders */}
          <div className="flex items-center gap-0.5">
            {/* Minimize */}
            <button 
              className="w-5 h-5 rounded-sm flex items-end justify-center pb-0.5 text-white"
              style={{
                background: 'linear-gradient(180deg, #3C8CF3 0%, #2570D4 50%, #1C5BB8 100%)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <Minus className="w-3 h-3" />
            </button>
            {/* Maximize */}
            <button 
              className="w-5 h-5 rounded-sm flex items-center justify-center text-white"
              style={{
                background: 'linear-gradient(180deg, #3C8CF3 0%, #2570D4 50%, #1C5BB8 100%)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            {/* Close */}
            <button 
              className="w-5 h-5 rounded-sm flex items-center justify-center text-white"
              style={{
                background: 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Menu Bar */}
        <div 
          className="flex items-center px-2 py-0.5 text-xs border-b relative"
          style={{
            backgroundColor: XP_COLORS.windowBg,
            borderColor: '#ACA899',
          }}
        >
          <span className="px-2 py-0.5 hover:bg-[#316AC5] hover:text-white cursor-default text-black">File</span>
          {/* Options dropdown */}
          <div className="relative">
            <span 
              className={`px-2 py-0.5 cursor-default text-black flex items-center gap-0.5 ${showOptionsMenu ? 'bg-[#316AC5] text-white' : 'hover:bg-[#316AC5] hover:text-white'}`}
              onClick={() => {
                setShowViewMenu(false)
                setShowOptionsMenu(!showOptionsMenu)
              }}
            >
              Options
              <ChevronDown className="w-3 h-3" />
            </span>
            {showOptionsMenu && (
              <div 
                className="absolute top-full left-0 z-50 py-1 min-w-[200px] shadow-md"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #808080',
                }}
                onMouseLeave={() => setShowOptionsMenu(false)}
              >
                {/* Chroma option */}
                <div 
                  className="px-4 py-1 text-black hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  onClick={() => {
                    openChromaDialog()
                    setShowOptionsMenu(false)
                  }}
                >
                  Chroma...
                </div>
                {/* Snapshots option */}
                <div 
                  className="px-4 py-1 text-black hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  onClick={() => {
                    setShowSnapshotDialog(true)
                    setShowOptionsMenu(false)
                  }}
                >
                  Snapshots...
                </div>
              </div>
            )}
          </div>
          {/* View dropdown */}
          <div className="relative">
            <span 
              className={`px-2 py-0.5 cursor-default text-black flex items-center gap-0.5 ${showViewMenu ? 'bg-[#316AC5] text-white' : 'hover:bg-[#316AC5] hover:text-white'}`}
              onClick={() => {
                setShowOptionsMenu(false)
                setShowViewMenu(!showViewMenu)
              }}
            >
              View
              <ChevronDown className="w-3 h-3" />
            </span>
            {showViewMenu && (
              <div 
                className="absolute top-full left-0 z-50 py-1 min-w-[180px] shadow-md"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #808080',
                }}
                onMouseLeave={() => setShowViewMenu(false)}
              >
                <a 
                  href="/view/stream/horizontal"
                  className="block px-4 py-1 text-black hover:bg-[#316AC5] hover:text-white cursor-pointer"
                >
                  Horizontal Stream View
                </a>
                <a 
                  href="/view/stream/vertical"
                  className="block px-4 py-1 text-black hover:bg-[#316AC5] hover:text-white cursor-pointer"
                >
                  Vertical Stream View
                </a>
                <div className="border-t border-[#808080] my-1" />
                <a 
                  href="/"
                  className="block px-4 py-1 text-black hover:bg-[#316AC5] hover:text-white cursor-pointer"
                >
                  Dashboard Home
                </a>
              </div>
            )}
          </div>
          {/* Shut Down - only active in development mode */}
          <span 
            className={`px-2 py-0.5 cursor-default ${isDevelopment ? 'text-black hover:bg-[#316AC5] hover:text-white' : 'text-gray-400'}`}
            onClick={() => isDevelopment && setShowShutdownDialog(true)}
            title={isDevelopment ? 'Shut down the printer host' : 'Shutdown disabled in production'}
          >
            Shut Down
          </span>
        </div>

        {/* Shutdown confirmation dialog */}
        {showShutdownDialog && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div 
              className="w-80 shadow-lg"
              style={{
                backgroundColor: XP_COLORS.windowBg,
                border: '2px outset #FFFFFF',
                borderRadius: '8px',
              }}
            >
              {/* Dialog title bar */}
              <div 
                className="flex items-center justify-between px-2 py-1"
                style={{
                  background: 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 50%, #003EB8 100%)',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                }}
              >
                <span className="text-white text-xs font-bold">Shut Down Printer</span>
                <button 
                  className="w-4 h-4 rounded-sm flex items-center justify-center text-white"
                  style={{
                    background: 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
                    border: '1px solid rgba(255,255,255,0.5)',
                  }}
                  onClick={() => setShowShutdownDialog(false)}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
              {/* Dialog content */}
              <div className="p-3">
                <p className="text-[11px] text-black mb-3">
                  Are you sure you want to emergency stop the printer?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    className="px-3 py-0.5 text-[10px] text-black"
                    style={{
                      backgroundColor: XP_COLORS.windowBg,
                      border: '2px outset #FFFFFF',
                      borderRadius: '3px',
                    }}
                    onClick={() => setShowShutdownDialog(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-0.5 text-[10px] text-white"
                    style={{
                      backgroundColor: '#CC0000',
                      border: '2px outset #FF6666',
                      borderRadius: '3px',
                    }}
                    disabled={isShuttingDown}
                    onClick={async () => {
                      setIsShuttingDown(true)
                      try {
                        const response = await fetch('/api/printer/emergency-stop', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'shutdown' })
                        })
                        if (!response.ok) throw new Error('Shutdown failed')
                        setShowShutdownDialog(false)
                      } catch (error) {
                        console.error('Shutdown error:', error)
                        alert('Failed to emergency stop printer')
                      } finally {
                        setIsShuttingDown(false)
                      }
                    }}
                  >
                    {isShuttingDown ? 'Stopping...' : 'Shut Down'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content area with window background */}
        <div 
          className="flex-1 flex flex-col overflow-hidden"
          style={{ backgroundColor: XP_COLORS.windowBg }}
        >
          {/* Tab bar - Klipper first, smaller text */}
          <div className="flex px-2 pt-1" style={{ backgroundColor: XP_COLORS.windowBg }}>
            <XPTabButton 
              active={activeTab === 'klipper'} 
              onClick={() => setActiveTab('klipper')}
            >
              Klipper
            </XPTabButton>
            <XPTabButton 
              active={activeTab === 'applications'} 
              onClick={() => setActiveTab('applications')}
            >
              Applications
            </XPTabButton>
            <XPTabButton 
              active={activeTab === 'processes'} 
              onClick={() => setActiveTab('processes')}
            >
              Processes
            </XPTabButton>
            <XPTabButton 
              active={activeTab === 'networking'} 
              onClick={() => setActiveTab('networking')}
            >
              Networking
            </XPTabButton>
            <XPTabButton 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
            >
              Users
            </XPTabButton>
          </div>

          {/* Tab content with white background and XP-style border */}
          <div 
            className="flex-1 mx-2 mb-2 overflow-hidden flex flex-col"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #919B9C',
              borderTop: 'none',
              borderRadius: '0 0 2px 2px',
              minHeight: 0, // Important for flex children to scroll properly
            }}
          >
            <div className="flex-1 overflow-auto">
              {activeTab === 'klipper' && renderKlipperTab()}
              {activeTab === 'applications' && renderApplicationsTab()}
              {activeTab === 'processes' && renderProcessesTab()}
              {activeTab === 'networking' && renderNetworkingTab()}
              {activeTab === 'users' && renderUsersTab()}
            </div>
          </div>
        </div>

        {/* Status bar - XP style with sunken section - just connection status */}
        <div 
          className="flex items-center h-6 text-xs border-t"
          style={{ 
            backgroundColor: XP_COLORS.windowBg,
            borderColor: '#ACA899',
            borderBottomLeftRadius: '3px',
            borderBottomRightRadius: '3px',
          }}
        >
          <div 
            className="flex-1 px-2 flex items-center gap-1.5 text-black"
            style={{
              borderRight: '1px solid #808080',
              borderTop: '1px solid #808080',
              borderLeft: '1px solid #FFFFFF',
              borderBottom: '1px solid #FFFFFF',
              margin: '2px',
              padding: '0 8px',
            }}
          >
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isConnected ? '#00AA00' : '#FF0000' }}
            />
            {connectionStatus}
          </div>
        </div>
      </div>
    </div>
  )
}
