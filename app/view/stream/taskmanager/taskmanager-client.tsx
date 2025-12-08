"use client"

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Minus, Maximize2, X, ChevronDown, Camera, Plus, Trash2, GripVertical, Download } from 'lucide-react'
import { usePrinterData } from '@/lib/hooks/use-printer-data'
import { usePrintStatus } from '@/lib/contexts/websocket-context'
import { useLocalStorageState } from '@/lib/hooks/use-local-storage'
import { useInterval } from '@/lib/hooks/use-interval'
import { XPTabButton, XP_COLORS, XPDialog, XPButton, getXPColors } from '@/components/ui/xp-components'
import { KlipperTab } from '@/components/taskmanager/klipper-tab'
import { ModelTab } from '@/components/taskmanager/model-tab'
import { ApplicationsTab, ProcessesTab, NetworkingTab, UsersTab } from '@/components/taskmanager/tabs'
import { getDataboxDisplayName } from '@/lib/utils/taskmanager-utils'
import { FloatingCameraManager, DockedCameraManager, type CameraWindowConfig } from '@/components/ui/camera-window-manager'
import type { PrinterStatus, WebcamConfig, LifetimeStats, GcodeMetadata } from '@/lib/types'
import type { SystemStats, SystemInfo } from '@/app/api/printer/system-stats/route'
import type { GrowTentStatus } from '@/lib/grow-tent-types'
import { GrowTentClient } from '@/lib/grow-tent-client'

// Local storage keys
const SNAPSHOT_CAMERAS_KEY = 'taskmanager_snapshot_cameras'
const CHROMA_CAMERAS_KEY = 'taskmanager_chroma_cameras'
const VIDEO_CAMERAS_KEY = 'taskmanager_video_cameras'
const SNAPSHOT_SETTINGS_KEY = 'taskmanager_snapshot_settings'
const CHROMA_SETTINGS_KEY = 'taskmanager_chroma_settings'
const VIDEO_SETTINGS_KEY = 'taskmanager_video_settings'
const DATABOX_ORDER_KEY = 'taskmanager_databox_order'
const MODEL_PREVIEW_DARK_BG_KEY = 'taskmanager_model_preview_dark_bg'
const DOCKED_SNAPSHOT_ORDER_KEY = 'taskmanager_docked_snapshot_order'
const DOCKED_CHROMA_ORDER_KEY = 'taskmanager_docked_chroma_order'
const DOCKED_VIDEO_ORDER_KEY = 'taskmanager_docked_video_order'
const DOCKED_SNAPSHOT_SIZES_KEY = 'taskmanager_docked_snapshot_sizes'
const DOCKED_CHROMA_SIZES_KEY = 'taskmanager_docked_chroma_sizes'
const DOCKED_VIDEO_SIZES_KEY = 'taskmanager_docked_video_sizes'
const FLOATING_SNAPSHOT_POSITIONS_KEY = 'taskmanager_floating_snapshot_positions'
const FLOATING_SNAPSHOT_SIZES_KEY = 'taskmanager_floating_snapshot_sizes'
const FLOATING_CHROMA_POSITIONS_KEY = 'taskmanager_floating_chroma_positions'
const FLOATING_CHROMA_SIZES_KEY = 'taskmanager_floating_chroma_sizes'
const FLOATING_VIDEO_POSITIONS_KEY = 'taskmanager_floating_video_positions'
const FLOATING_VIDEO_SIZES_KEY = 'taskmanager_floating_video_sizes'
const GROW_TENT_ENABLED_KEY = 'taskmanager_grow_tent_enabled'
const GROW_TENT_API_URL_KEY = 'taskmanager_grow_tent_api_url'
const BACKGROUND_IMAGE_KEY = 'taskmanager_background_image'
const BACKGROUND_ROTATION_KEY = 'taskmanager_background_rotation'
const DARK_MODE_KEY = 'taskmanager_dark_mode'
const AUTO_REFRESH_ENABLED_KEY = 'taskmanager_auto_refresh_enabled'
const AUTO_REFRESH_INTERVAL_KEY = 'taskmanager_auto_refresh_interval'

// Type definitions
type DataboxType = 'model-preview' | 'print-job' | 'temperatures' | 'console' | 'system' | 'uptime' | 'lifetime' | 'grow-tent'
type VideoSize = 'responsive' | 'small' | 'medium' | 'large'
type SnapshotPlacement = 'above' | 'below' | 'databoxes' | 'floating' | 'docked-above' | 'docked-below'
type TabType = 'klipper' | 'model' | 'applications' | 'processes' | 'networking' | 'users'
type BackgroundImage = 'win-01' | 'win-02'

const DEFAULT_DATABOX_ORDER: DataboxType[] = ['model-preview', 'print-job', 'temperatures', 'system', 'uptime', 'lifetime', 'grow-tent']

// Helper function to map printer state to favicon suffix
const getFaviconSuffix = (printState: string): string => {
  switch (printState) {
    case 'printing':
      return 'printing'
    case 'cancelled':
      return 'cancelled'
    case 'offline':
    case 'error':
      return 'offline'
    case 'ready':
      return 'ready'
    case 'complete':
    case 'paused':
    default:
      return 'ready'
  }
}

interface SnapshotSettings {
  size: VideoSize
  placement: SnapshotPlacement
}

interface ChromaSettings {
  placement: SnapshotPlacement
}

interface VideoSettings {
  placement: SnapshotPlacement
  size: VideoSize
}

interface ChromaCamera {
  id: string
  title: string
  framerate: 15 | 24 | 30 | 60
  chromaColor: 'green' | 'blue' | 'custom'
  customColor?: string
  size: VideoSize
}

interface TaskManagerClientProps {
  initialStatus: PrinterStatus | null
  initialSystemStats: SystemStats | null
  initialSystemInfo: SystemInfo | null
}

// Chroma dialog form component
const ChromaCameraForm = memo(function ChromaCameraForm({
  camera,
  index,
  onUpdate,
  onRemove
}: {
  camera: ChromaCamera
  index: number
  onUpdate: (id: string, updates: Partial<ChromaCamera>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div 
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
          onClick={() => onRemove(camera.id)}
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
          onChange={(e) => onUpdate(camera.id, { title: e.target.value })}
          className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
          placeholder="Camera name"
        />
      </div>
      
      {/* Framerate, Chroma color and Size row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-black text-[10px] mb-0.5">Framerate</label>
          <select
            value={camera.framerate}
            onChange={(e) => onUpdate(camera.id, { framerate: parseInt(e.target.value) as 15 | 24 | 30 | 60 })}
            className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
          >
            <option value={15}>15 fps</option>
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </div>
        
        <div>
          <label className="block text-black text-[10px] mb-0.5">Chroma Color</label>
          <select
            value={camera.chromaColor}
            onChange={(e) => onUpdate(camera.id, { chromaColor: e.target.value as 'green' | 'blue' | 'custom' })}
            className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
          >
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        <div>
          <label className="block text-black text-[10px] mb-0.5">Size</label>
          <select
            value={camera.size || 'responsive'}
            onChange={(e) => onUpdate(camera.id, { size: e.target.value as VideoSize })}
            className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
          >
            <option value="responsive">Responsive</option>
            <option value="small">Small (1 space)</option>
            <option value="medium">Medium (2 spaces)</option>
            <option value="large">Large (3 spaces)</option>
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
              onChange={(e) => onUpdate(camera.id, { customColor: e.target.value })}
              className="w-8 h-6 border border-[#808080] cursor-pointer"
            />
            <input
              type="text"
              value={camera.customColor || '#00FF00'}
              onChange={(e) => onUpdate(camera.id, { customColor: e.target.value })}
              className="flex-1 px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
              placeholder="#00FF00"
            />
          </div>
        </div>
      )}
    </div>
  )
})

// Main Task Manager Component
export default function TaskManagerClient({
  initialStatus,
  initialSystemStats,
  initialSystemInfo
}: TaskManagerClientProps) {
  const { printerStatus, isConnected } = usePrinterData()
  const { display_status } = usePrintStatus()
  const [activeTab, setActiveTab] = useState<TabType>('klipper')
  const [systemStats, setSystemStats] = useState<SystemStats | null>(initialSystemStats)
  const [systemInfo] = useState<SystemInfo | null>(initialSystemInfo)
  
  // Dialog states
  const [showShutdownDialog, setShowShutdownDialog] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showChromaDialog, setShowChromaDialog] = useState(false)
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [showVideoDialog, setShowVideoDialog] = useState(false)
  const [showReorderDialog, setShowReorderDialog] = useState(false)
  const [showDisplayDialog, setShowDisplayDialog] = useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  
  // Use custom localStorage hooks for persisted state
  const [selectedSnapshotCameras, setSelectedSnapshotCameras] = useLocalStorageState<string[]>(
    SNAPSHOT_CAMERAS_KEY,
    []
  )
  const [chromaCameras, setChromaCameras] = useLocalStorageState<ChromaCamera[]>(
    CHROMA_CAMERAS_KEY,
    [],
    { validate: (v) => Array.isArray(v) }
  )
  const [snapshotSettings, setSnapshotSettings] = useLocalStorageState<SnapshotSettings>(
    SNAPSHOT_SETTINGS_KEY,
    { size: 'responsive', placement: 'above' }
  )
  const [chromaSettings, setChromaSettings] = useLocalStorageState<ChromaSettings>(
    CHROMA_SETTINGS_KEY,
    { placement: 'above' }
  )
  const [selectedVideoCameras, setSelectedVideoCameras] = useLocalStorageState<string[]>(
    VIDEO_CAMERAS_KEY,
    []
  )
  const [videoSettings, setVideoSettings] = useLocalStorageState<VideoSettings>(
    VIDEO_SETTINGS_KEY,
    { placement: 'above', size: 'responsive' }
  )
  const [databoxOrder, setDataboxOrder] = useLocalStorageState<DataboxType[]>(
    DATABOX_ORDER_KEY,
    DEFAULT_DATABOX_ORDER,
    { validate: (v) => Array.isArray(v) && v.length === DEFAULT_DATABOX_ORDER.length }
  )
  const [modelPreviewDarkBg, setModelPreviewDarkBg] = useLocalStorageState<boolean>(
    MODEL_PREVIEW_DARK_BG_KEY,
    false
  )
  
  // Docked camera order states
  const [dockedSnapshotOrder, setDockedSnapshotOrder] = useLocalStorageState<string[]>(
    DOCKED_SNAPSHOT_ORDER_KEY,
    []
  )
  const [dockedChromaOrder, setDockedChromaOrder] = useLocalStorageState<string[]>(
    DOCKED_CHROMA_ORDER_KEY,
    []
  )
  const [dockedVideoOrder, setDockedVideoOrder] = useLocalStorageState<string[]>(
    DOCKED_VIDEO_ORDER_KEY,
    []
  )
  
  // Docked camera window sizes
  const [dockedSnapshotSizes, setDockedSnapshotSizes] = useLocalStorageState<Record<string, { width: number | string; height: number }>>(
    DOCKED_SNAPSHOT_SIZES_KEY,
    {}
  )
  const [dockedChromaSizes, setDockedChromaSizes] = useLocalStorageState<Record<string, { width: number | string; height: number }>>(
    DOCKED_CHROMA_SIZES_KEY,
    {}
  )
  const [dockedVideoSizes, setDockedVideoSizes] = useLocalStorageState<Record<string, { width: number | string; height: number }>>(
    DOCKED_VIDEO_SIZES_KEY,
    {}
  )
  
  // Floating camera window positions and sizes
  const [floatingSnapshotPositions, setFloatingSnapshotPositions] = useLocalStorageState<Record<string, { x: number; y: number }>>(
    FLOATING_SNAPSHOT_POSITIONS_KEY,
    {}
  )
  const [floatingSnapshotSizes, setFloatingSnapshotSizes] = useLocalStorageState<Record<string, { width: number; height: number }>>(
    FLOATING_SNAPSHOT_SIZES_KEY,
    {}
  )
  const [floatingChromaPositions, setFloatingChromaPositions] = useLocalStorageState<Record<string, { x: number; y: number }>>(
    FLOATING_CHROMA_POSITIONS_KEY,
    {}
  )
  const [floatingChromaSizes, setFloatingChromaSizes] = useLocalStorageState<Record<string, { width: number; height: number }>>(
    FLOATING_CHROMA_SIZES_KEY,
    {}
  )
  const [floatingVideoPositions, setFloatingVideoPositions] = useLocalStorageState<Record<string, { x: number; y: number }>>(
    FLOATING_VIDEO_POSITIONS_KEY,
    {}
  )
  const [floatingVideoSizes, setFloatingVideoSizes] = useLocalStorageState<Record<string, { width: number; height: number }>>(
    FLOATING_VIDEO_SIZES_KEY,
    {}
  )
  
  // Other state
  const [availableWebcams, setAvailableWebcams] = useState<WebcamConfig[]>([])
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now())
  const [editingChromaCameras, setEditingChromaCameras] = useState<ChromaCamera[]>([])
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats | null>(null)
  const [modelThumbnail, setModelThumbnail] = useState<string | null>(null)
  const [modelMetadata, setModelMetadata] = useState<GcodeMetadata | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [draggedDatabox, setDraggedDatabox] = useState<DataboxType | null>(null)
  
  // Grow tent state
  const [growTentEnabled, setGrowTentEnabled] = useLocalStorageState<boolean>(
    GROW_TENT_ENABLED_KEY,
    false
  )
  const [growTentApiUrl, setGrowTentApiUrl] = useLocalStorageState<string>(
    GROW_TENT_API_URL_KEY,
    'http://localhost:3000'
  )
  
  // Display settings
  const [backgroundImage, setBackgroundImage] = useLocalStorageState<BackgroundImage>(
    BACKGROUND_IMAGE_KEY,
    'win-01'
  )
  const [backgroundRotation, setBackgroundRotation] = useLocalStorageState<boolean>(
    BACKGROUND_ROTATION_KEY,
    false
  )
  const [darkMode, setDarkMode] = useLocalStorageState<boolean>(
    DARK_MODE_KEY,
    false
  )
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useLocalStorageState<boolean>(
    AUTO_REFRESH_ENABLED_KEY,
    false
  )
  const [autoRefreshInterval, setAutoRefreshInterval] = useLocalStorageState<number>(
    AUTO_REFRESH_INTERVAL_KEY,
    5
  )
  const [growTentStatus, setGrowTentStatus] = useState<GrowTentStatus | null>(null)
  const [growTentClient] = useState(() => new GrowTentClient(growTentApiUrl))
  
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // History for graphs (keep last 60 data points for ~1 minute of history)
  const [extruderHistory, setExtruderHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [extruderTargetHistory, setExtruderTargetHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [bedHistory, setBedHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [bedTargetHistory, setBedTargetHistory] = useState<number[]>(() => new Array(60).fill(0))
  const [networkHistory, setNetworkHistory] = useState<Record<string, number[]>>(() => ({}))
  
  // Use ref to track the latest printer status for the interval
  const statusRef = useRef<PrinterStatus | null>(null)
  
  // Live status (use printerStatus from WebSocket, fallback to initialStatus)
  const liveStatus = printerStatus || initialStatus
  
  // Keep ref in sync with latest status
  useEffect(() => {
    statusRef.current = liveStatus
  }, [liveStatus])
  
  // Memoized printer values to prevent recalculation
  const printerValues = useMemo(() => ({
    extruderActual: liveStatus?.temperatures.extruder.actual || 0,
    extruderTarget: liveStatus?.temperatures.extruder.target || 0,
    extruderPower: liveStatus?.temperatures.extruder.power || 0,
    bedActual: liveStatus?.temperatures.bed.actual || 0,
    bedTarget: liveStatus?.temperatures.bed.target || 0,
    bedPower: liveStatus?.temperatures.bed.power || 0,
    printProgress: (liveStatus?.print.progress || 0) * 100,
    printState: liveStatus?.print.state || 'offline',
    filename: liveStatus?.print.filename || 'No active print',
    printTime: liveStatus?.print.printTime || 0,
    estimatedTimeLeft: liveStatus?.print.estimatedTimeLeft || 0,
    filamentUsed: liveStatus?.print.filamentUsed || 0,
    currentLayer: liveStatus?.print.currentLayer || 0,
    totalLayers: liveStatus?.print.totalLayers || 0,
    currentSpeed: liveStatus?.speeds?.current || 0,
  }), [liveStatus])
  
  // Fetch system stats periodically using custom hook
  useInterval(
    useCallback(async () => {
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
    }, []),
    2000,
    { immediate: true }
  )

  // Update temperature histories on a fixed interval (1 second)
  useInterval(
    useCallback(() => {
      const currentStatus = statusRef.current
      if (!currentStatus) return
      
      setExtruderHistory(prev => [...prev.slice(1), currentStatus.temperatures.extruder.actual])
      setExtruderTargetHistory(prev => [...prev.slice(1), currentStatus.temperatures.extruder.target])
      setBedHistory(prev => [...prev.slice(1), currentStatus.temperatures.bed.actual])
      setBedTargetHistory(prev => [...prev.slice(1), currentStatus.temperatures.bed.target])
    }, []),
    1000,
    { immediate: true }
  )
  
  // Refresh snapshots every 5 seconds
  useInterval(
    useCallback(() => {
      setSnapshotTimestamp(Date.now())
    }, []),
    5000,
    { immediate: true, enabled: selectedSnapshotCameras.length > 0 }
  )
  
  // Fetch lifetime stats periodically
  useInterval(
    useCallback(async () => {
      try {
        const response = await fetch('/api/printer/lifetime-stats')
        if (response.ok) {
          const data = await response.json()
          setLifetimeStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch lifetime stats:', error)
      }
    }, []),
    30000,
    { immediate: true }
  )

  // Fetch grow tent status periodically (if enabled)
  useInterval(
    useCallback(async () => {
      if (!growTentEnabled) return
      
      const status = await growTentClient.getStatus()
      if (status) {
        setGrowTentStatus(status)
      }
    }, [growTentEnabled, growTentClient]),
    10000, // Update every 10 seconds
    { immediate: true, enabled: growTentEnabled }
  )

  // Background rotation (every 5 minutes if enabled)
  useInterval(
    useCallback(() => {
      if (!backgroundRotation) return
      
      setBackgroundImage(prev => prev === "win-01" ? "win-02" : "win-01")
    }, [backgroundRotation, setBackgroundImage]),
    300000, // 5 minutes
    { immediate: false, enabled: backgroundRotation }
  )

  // Auto refresh effect (hard page reload at specified interval)
  useEffect(() => {
    if (!autoRefreshEnabled || autoRefreshInterval < 1) return

    const intervalMs = autoRefreshInterval * 60 * 1000 // Convert minutes to milliseconds
    const timerId = setInterval(() => {
      window.location.reload()
    }, intervalMs)

    return () => clearInterval(timerId)
  }, [autoRefreshEnabled, autoRefreshInterval])

  // Fetch available webcams on mount
  useEffect(() => {
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

  // Fetch model thumbnail and metadata when print is active
  useEffect(() => {
    const fetchModelData = async () => {
      const currentFilename = printerStatus?.print?.filename || initialStatus?.print?.filename
      if (!currentFilename) {
        setModelThumbnail(null)
        setModelMetadata(null)
        return
      }
      
      setIsLoadingMetadata(true)
      try {
        const response = await fetch(`/api/printer/file-metadata?filename=${encodeURIComponent(currentFilename)}`)
        if (response.ok) {
          const data: GcodeMetadata = await response.json()
          setModelMetadata(data)
          
          if (data.thumbnails && data.thumbnails.length > 0) {
            const sortedThumbnails = [...data.thumbnails].sort((a, b) => b.width - a.width)
            const thumbnail = sortedThumbnails[0]
            if (thumbnail.relative_path) {
              setModelThumbnail(`/api/printer/thumbnail?path=${encodeURIComponent(thumbnail.relative_path)}`)
            }
          } else {
            setModelThumbnail(null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch model data:', error)
        setModelThumbnail(null)
        setModelMetadata(null)
      } finally {
        setIsLoadingMetadata(false)
      }
    }
    
    fetchModelData()
  }, [printerStatus?.print?.filename, initialStatus?.print?.filename])

  // Check if there's an active print job (for enabling/disabling Model tab and Download)
  const hasActivePrint = useMemo(() => {
    const state = liveStatus?.print?.state
    return state === 'printing' || state === 'paused' || state === 'complete'
  }, [liveStatus?.print?.state])

  // Handle GCODE download from File menu
  const handleDownloadGcode = useCallback(() => {
    const filename = liveStatus?.print?.filename
    if (!filename) return
    
    const downloadUrl = `/api/printer/file-download?filename=${encodeURIComponent(filename)}`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename.split('/').pop() || filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setShowFileMenu(false)
  }, [liveStatus?.print?.filename])

  // Handlers with useCallback for stability
  const handleCameraSelectionChange = useCallback((cameraUid: string, checked: boolean) => {
    setSelectedSnapshotCameras(prev => {
      return checked 
        ? [...prev, cameraUid]
        : prev.filter(uid => uid !== cameraUid)
    })
  }, [setSelectedSnapshotCameras])

  const openChromaDialog = useCallback(() => {
    setEditingChromaCameras([...chromaCameras])
    setShowChromaDialog(true)
  }, [chromaCameras])

  const addChromaCamera = useCallback(() => {
    const newCamera: ChromaCamera = {
      id: `chroma_${Date.now()}`,
      title: `Camera ${editingChromaCameras.length + 1}`,
      framerate: 30,
      chromaColor: 'green',
      size: 'responsive',
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
    setShowChromaDialog(false)
  }, [editingChromaCameras, setChromaCameras])

  const saveSnapshotSettings = useCallback((newSettings: Partial<SnapshotSettings>) => {
    setSnapshotSettings(prev => ({ ...prev, ...newSettings }))
  }, [setSnapshotSettings])

  const handleVideoCameraSelectionChange = useCallback((cameraUid: string, checked: boolean) => {
    if (checked) {
      setSelectedVideoCameras(prev => [...prev, cameraUid])
    } else {
      setSelectedVideoCameras(prev => prev.filter(uid => uid !== cameraUid))
    }
  }, [setSelectedVideoCameras])

  const saveVideoSettings = useCallback((newSettings: Partial<VideoSettings>) => {
    setVideoSettings(prev => ({ ...prev, ...newSettings }))
  }, [setVideoSettings])

  const handleDragStart = useCallback((databox: DataboxType) => {
    setDraggedDatabox(databox)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((targetDatabox: DataboxType) => {
    if (!draggedDatabox || draggedDatabox === targetDatabox) return
    
    setDataboxOrder(prev => {
      const newOrder = [...prev]
      const draggedIndex = newOrder.indexOf(draggedDatabox)
      const targetIndex = newOrder.indexOf(targetDatabox)
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedDatabox)
      return newOrder
    })
    setDraggedDatabox(null)
  }, [draggedDatabox, setDataboxOrder])

  const resetDataboxOrder = useCallback(() => {
    setDataboxOrder(DEFAULT_DATABOX_ORDER)
  }, [setDataboxOrder])

  const toggleModelPreviewDarkBg = useCallback(() => {
    setModelPreviewDarkBg(prev => !prev)
  }, [setModelPreviewDarkBg])

  const handleEmergencyShutdown = useCallback(async () => {
    if (!isDevelopment) return
    
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
  }, [isDevelopment])

  // Close menus when clicking outside
  const handleCloseMenus = useCallback(() => {
    setShowFileMenu(false)
    setShowViewMenu(false)
    setShowOptionsMenu(false)
  }, [])

  // Handle removing a camera from floating/docked view - change placement to 'above' instead
  const handleRemoveCameraFromWindow = useCallback(() => {
    setSnapshotSettings(prev => ({ ...prev, placement: 'above' }))
  }, [setSnapshotSettings])

  // Handle closing chroma window - change placement to 'above' instead
  const handleCloseChromaWindow = useCallback(() => {
    setChromaSettings(prev => ({ ...prev, placement: 'above' }))
  }, [setChromaSettings])

  // Handle closing video window - change placement to 'above' instead
  const handleCloseVideoWindow = useCallback(() => {
    setVideoSettings(prev => ({ ...prev, placement: 'above' }))
  }, [setVideoSettings])

  // Convert selected snapshot cameras to CameraWindowConfig format
  const snapshotCameraConfigs: CameraWindowConfig[] = useMemo(() => {
    return selectedSnapshotCameras.map(cameraUid => {
      const camera = availableWebcams.find(w => w.uid === cameraUid)
      if (!camera) return null
      return {
        id: camera.uid,
        name: camera.name,
        url: `/api/camera/snapshot?uid=${cameraUid}`,
        type: 'snapshot' as const,
        fps: '5s', // 5 second refresh
        aspectRatio: camera.aspect_ratio || '16:9',
      }
    }).filter(Boolean) as CameraWindowConfig[]
  }, [selectedSnapshotCameras, availableWebcams])

  // Convert chroma cameras to CameraWindowConfig format
  const chromaCameraConfigs: CameraWindowConfig[] = useMemo(() => {
    return chromaCameras.map(camera => ({
      id: camera.id,
      name: camera.title,
      url: '', // Chroma sections are just colored backgrounds, no URL needed
      type: 'video' as const,
      fps: camera.framerate,
      chromaColor: camera.chromaColor === 'custom' ? camera.customColor : 
        camera.chromaColor === 'green' ? '#00b140' : '#0047bb',
    }))
  }, [chromaCameras])

  // Convert selected video cameras to CameraWindowConfig format
  const videoCameraConfigs: CameraWindowConfig[] = useMemo(() => {
    return selectedVideoCameras.map(cameraUid => {
      const camera = availableWebcams.find(w => w.uid === cameraUid)
      if (!camera) return null
      return {
        id: camera.uid,
        name: camera.name,
        // Always use the API proxy for video streams
        url: `/api/camera/stream?uid=${cameraUid}`,
        type: 'video' as const,
        fps: 30, // Live video feed
        aspectRatio: camera.aspect_ratio || '16:9',
      }
    }).filter(Boolean) as CameraWindowConfig[]
  }, [selectedVideoCameras, availableWebcams])

  // Helper function to sort configs by order array
  const sortByOrder = useCallback((configs: CameraWindowConfig[], orderArray: string[]): CameraWindowConfig[] => {
    if (orderArray.length === 0) return configs
    
    // Create a map of id to index in orderArray for efficient lookup
    const orderMap = new Map(orderArray.map((id, index) => [id, index]))
    
    return [...configs].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity
      const bIndex = orderMap.get(b.id) ?? Infinity
      return aIndex - bIndex
    })
  }, [])

  // Create ordered versions of camera configs for docked views
  const orderedSnapshotCameraConfigs = useMemo(() => 
    sortByOrder(snapshotCameraConfigs, dockedSnapshotOrder),
    [snapshotCameraConfigs, dockedSnapshotOrder, sortByOrder]
  )

  const orderedChromaCameraConfigs = useMemo(() => 
    sortByOrder(chromaCameraConfigs, dockedChromaOrder),
    [chromaCameraConfigs, dockedChromaOrder, sortByOrder]
  )

  const orderedVideoCameraConfigs = useMemo(() => 
    sortByOrder(videoCameraConfigs, dockedVideoOrder),
    [videoCameraConfigs, dockedVideoOrder, sortByOrder]
  )

  // Handle docked camera order changes
  const handleDockedSnapshotOrderChange = useCallback((newOrder: string[]) => {
    setDockedSnapshotOrder(newOrder)
  }, [setDockedSnapshotOrder])

  const handleDockedChromaOrderChange = useCallback((newOrder: string[]) => {
    setDockedChromaOrder(newOrder)
  }, [setDockedChromaOrder])

  const handleDockedVideoOrderChange = useCallback((newOrder: string[]) => {
    setDockedVideoOrder(newOrder)
  }, [setDockedVideoOrder])

  // Handle docked camera window size changes
  const handleSnapshotSizeChange = useCallback((cameraId: string, width: number | string, height: number) => {
    setDockedSnapshotSizes(prev => ({ ...prev, [cameraId]: { width, height } }))
  }, [setDockedSnapshotSizes])

  const handleChromaSizeChange = useCallback((cameraId: string, width: number | string, height: number) => {
    setDockedChromaSizes(prev => ({ ...prev, [cameraId]: { width, height } }))
  }, [setDockedChromaSizes])

  const handleVideoSizeChange = useCallback((cameraId: string, width: number | string, height: number) => {
    setDockedVideoSizes(prev => ({ ...prev, [cameraId]: { width, height } }))
  }, [setDockedVideoSizes])

  // Handle floating camera window position changes
  const handleFloatingSnapshotPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setFloatingSnapshotPositions(prev => ({ ...prev, [id]: position }))
  }, [setFloatingSnapshotPositions])

  const handleFloatingChromaPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setFloatingChromaPositions(prev => ({ ...prev, [id]: position }))
  }, [setFloatingChromaPositions])

  const handleFloatingVideoPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setFloatingVideoPositions(prev => ({ ...prev, [id]: position }))
  }, [setFloatingVideoPositions])

  // Handle floating camera window size changes
  const handleFloatingSnapshotSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setFloatingSnapshotSizes(prev => ({ ...prev, [id]: size }))
  }, [setFloatingSnapshotSizes])

  const handleFloatingChromaSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setFloatingChromaSizes(prev => ({ ...prev, [id]: size }))
  }, [setFloatingChromaSizes])

  const handleFloatingVideoSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setFloatingVideoSizes(prev => ({ ...prev, [id]: size }))
  }, [setFloatingVideoSizes])

  const connectionStatus = isConnected ? 'Connected' : 'Reconnecting...'
  
  // Get colors based on dark mode
  const colors = getXPColors(darkMode)

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-2 md:p-4"
      style={{
        backgroundImage: `url(/background/${backgroundImage}.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
      }}
    >
      {/* Display Settings Dialog */}
      <XPDialog
        title="Display Settings"
        isOpen={showDisplayDialog}
        onClose={() => setShowDisplayDialog(false)}
        width="w-96"
      >
        <p className="text-black text-[11px] mb-3" style={{ color: colors.labelText }}>
          Customize the appearance of the application.
        </p>
        
        {/* Background Image Selection */}
        <div className="mb-3">
          <label className="block text-[11px] mb-1" style={{ color: colors.labelText }}>Background Image</label>
          <select
            value={backgroundImage}
            onChange={(e) => setBackgroundImage(e.target.value as BackgroundImage)}
            className="w-full px-2 py-1 text-xs border"
            style={{ 
              borderColor: colors.border,
              backgroundColor: colors.contentBg,
              color: colors.labelText
            }}
          >
            <option value="win-01">Windows XP Default</option>
            <option value="win-02">Windows XP Bliss</option>
          </select>
        </div>
        
        {/* Background Rotation Toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className="text-[11px]" style={{ color: colors.labelText }}>Rotate Background (5 min)</label>
          <button
            onClick={() => setBackgroundRotation(!backgroundRotation)}
            className="px-3 py-1 text-xs border"
            style={{ 
              borderColor: colors.border,
              backgroundColor: colors.windowBg,
              color: colors.labelText
            }}
          >
            {backgroundRotation ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>
        
        {/* Dark Mode Toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className="text-[11px]" style={{ color: colors.labelText }}>Dark Mode</label>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-3 py-1 text-xs border"
            style={{ 
              borderColor: colors.border,
              backgroundColor: colors.windowBg,
              color: colors.labelText
            }}
          >
            {darkMode ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>
        
        {/* Auto Refresh Toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className="text-[11px]" style={{ color: colors.labelText }}>Auto Refresh</label>
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className="px-3 py-1 text-xs border"
            style={{ 
              borderColor: colors.border,
              backgroundColor: colors.windowBg,
              color: colors.labelText
            }}
          >
            {autoRefreshEnabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>
        
        {/* Auto Refresh Interval Slider */}
        {autoRefreshEnabled && (
          <div className="mb-3">
            <label className="block text-[11px] mb-1" style={{ color: colors.labelText }}>
              Refresh Interval: {autoRefreshInterval} minute{autoRefreshInterval !== 1 ? 's' : ''}
            </label>
            <input
              type="range"
              min="1"
              max="60"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="w-full"
              style={{
                accentColor: colors.accentBlue
              }}
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: colors.labelText }}>
              <span>1 min</span>
              <span>60 min</span>
            </div>
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-3">
          <XPButton onClick={() => setShowDisplayDialog(false)}>
            Close
          </XPButton>
        </div>
      </XPDialog>

      {/* Chroma Camera Configuration Dialog */}
      <XPDialog
        title="Chroma Cameras"
        isOpen={showChromaDialog}
        onClose={() => setShowChromaDialog(false)}
        width="w-96"
      >
        <p className="text-black text-[11px] mb-3">
          Add cameras for live video display with chroma key backgrounds.
        </p>
        
        {/* Placement dropdown */}
        <div className="mb-3">
          <label className="block text-black text-[10px] font-bold mb-0.5">Placement</label>
          <select
            value={chromaSettings.placement}
            onChange={(e) => setChromaSettings({ placement: e.target.value as SnapshotPlacement })}
            className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
          >
            <option value="above">Above Charts</option>
            <option value="below">Below Charts</option>
            <option value="floating">Floating Windows</option>
            <option value="docked-above">Docked Above</option>
            <option value="docked-below">Docked Below</option>
          </select>
        </div>
        
        {/* Floating/Docked info */}
        {(chromaSettings.placement === 'floating' || 
          chromaSettings.placement === 'docked-above' || 
          chromaSettings.placement === 'docked-below') && (
          <div className="mb-3 p-2 bg-[#FFFFCC] border border-[#808080] text-[10px] text-black">
            {chromaSettings.placement === 'floating' ? (
              <span>
                📌 Floating windows can be moved and resized freely.
                Click a window to bring it to front.
              </span>
            ) : (
              <span>
                📌 Docked windows appear {chromaSettings.placement === 'docked-above' ? 'above' : 'below'} the main window.
                Up to 3 cameras can be displayed side by side.
              </span>
            )}
          </div>
        )}
        
        <div className="space-y-3">
          {editingChromaCameras.map((camera, index) => (
            <ChromaCameraForm
              key={camera.id}
              camera={camera}
              index={index}
              onUpdate={updateChromaCamera}
              onRemove={removeChromaCamera}
            />
          ))}
        </div>
        
        <button
          onClick={addChromaCamera}
          className="w-full mt-3 px-3 py-1 text-xs border border-[#808080] bg-[#ECE9D8] hover:bg-[#F5F4EF] text-black flex items-center justify-center gap-2"
          style={{ borderRadius: '2px' }}
        >
          <Plus className="w-3 h-3" />
          Add Camera
        </button>
        
        <div className="flex justify-end gap-2 mt-3">
          <XPButton onClick={() => setShowChromaDialog(false)}>Cancel</XPButton>
          <XPButton onClick={saveChromaCameras}>Save</XPButton>
        </div>
      </XPDialog>

      {/* Snapshots Configuration Dialog */}
      <XPDialog
        title="Camera Snapshots"
        isOpen={showSnapshotDialog}
        onClose={() => setShowSnapshotDialog(false)}
      >
        <p className="text-[11px] text-black mb-3">
          Select cameras and display options for the snapshot section.
        </p>
        
        <div className="mb-3">
          <div className="text-black text-[10px] font-bold mb-1">Cameras</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
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
              <div className="text-gray-500 italic text-[11px]">No cameras available</div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-black text-[10px] font-bold mb-0.5">Size</label>
            <select
              value={snapshotSettings.size}
              onChange={(e) => saveSnapshotSettings({ size: e.target.value as VideoSize })}
              className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
            >
              <option value="responsive">Responsive</option>
              {snapshotSettings.placement === 'databoxes' ? (
                <>
                  <option value="small">Small (1 box)</option>
                  <option value="large">Large (full row)</option>
                </>
              ) : (
                <>
                  <option value="small">Small (1 space)</option>
                  <option value="medium">Medium (2 spaces)</option>
                  <option value="large">Large (3 spaces)</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-black text-[10px] font-bold mb-0.5">Placement</label>
            <select
              value={snapshotSettings.placement}
              onChange={(e) => {
                const newPlacement = e.target.value as SnapshotPlacement
                saveSnapshotSettings({ placement: newPlacement, size: 'responsive' })
              }}
              className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
            >
              <option value="above">Above Charts</option>
              <option value="below">Below Charts</option>
              <option value="databoxes">In Data Boxes</option>
              <option value="floating">Floating Windows</option>
              <option value="docked-above">Docked Above</option>
              <option value="docked-below">Docked Below</option>
            </select>
          </div>
        </div>
        
        {/* Floating/Docked info */}
        {(snapshotSettings.placement === 'floating' || 
          snapshotSettings.placement === 'docked-above' || 
          snapshotSettings.placement === 'docked-below') && (
          <div className="mt-2 p-2 bg-[#FFFFCC] border border-[#808080] text-[10px] text-black">
            {snapshotSettings.placement === 'floating' ? (
              <span>
                📌 Floating windows can be moved and resized freely.
                Click a window to bring it to front.
              </span>
            ) : (
              <span>
                📌 Docked windows appear {snapshotSettings.placement === 'docked-above' ? 'above' : 'below'} the main window.
                Up to 3 cameras can be displayed side by side.
              </span>
            )}
          </div>
        )}
        
        <div className="flex justify-end mt-3">
          <XPButton onClick={() => setShowSnapshotDialog(false)}>Close</XPButton>
        </div>
      </XPDialog>

      {/* Video Cameras Configuration Dialog */}
      <XPDialog
        title="Video Feeds"
        isOpen={showVideoDialog}
        onClose={() => setShowVideoDialog(false)}
      >
        <p className="text-[11px] text-black mb-3">
          Select cameras to display as live video feeds from the printer.
        </p>
        
        <div className="mb-3">
          <div className="text-black text-[10px] font-bold mb-1">Cameras</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {availableWebcams.length > 0 ? (
              availableWebcams.map(camera => (
                <label 
                  key={camera.uid}
                  className="flex items-center gap-2 px-2 py-1 text-[11px] text-black hover:bg-[#316AC5] hover:text-white cursor-pointer rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedVideoCameras.includes(camera.uid)}
                    onChange={(e) => handleVideoCameraSelectionChange(camera.uid, e.target.checked)}
                    className="w-3 h-3"
                  />
                  <Camera className="w-3 h-3" />
                  <span className="truncate">{camera.name}</span>
                </label>
              ))
            ) : (
              <div className="text-gray-500 italic text-[11px]">No cameras available</div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-black text-[10px] font-bold mb-0.5">Size</label>
            <select
              value={videoSettings.size}
              onChange={(e) => saveVideoSettings({ size: e.target.value as VideoSize })}
              className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
            >
              <option value="responsive">Responsive</option>
              {videoSettings.placement === 'databoxes' ? (
                <>
                  <option value="small">Small (1 box)</option>
                  <option value="large">Large (full row)</option>
                </>
              ) : (
                <>
                  <option value="small">Small (1 space)</option>
                  <option value="medium">Medium (2 spaces)</option>
                  <option value="large">Large (3 spaces)</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-black text-[10px] font-bold mb-0.5">Placement</label>
            <select
              value={videoSettings.placement}
              onChange={(e) => {
                const newPlacement = e.target.value as SnapshotPlacement
                saveVideoSettings({ placement: newPlacement, size: 'responsive' })
              }}
              className="w-full px-2 py-0.5 text-xs border border-[#808080] bg-white text-black"
            >
              <option value="above">Above Charts</option>
              <option value="below">Below Charts</option>
              <option value="databoxes">In Data Boxes</option>
              <option value="floating">Floating Windows</option>
              <option value="docked-above">Docked Above</option>
              <option value="docked-below">Docked Below</option>
            </select>
          </div>
        </div>
        
        {/* Floating/Docked info */}
        {(videoSettings.placement === 'floating' || 
          videoSettings.placement === 'docked-above' || 
          videoSettings.placement === 'docked-below') && (
          <div className="mt-2 p-2 bg-[#FFFFCC] border border-[#808080] text-[10px] text-black">
            {videoSettings.placement === 'floating' ? (
              <span>
                📌 Floating windows can be moved and resized freely.
                Click a window to bring it to front.
              </span>
            ) : (
              <span>
                📌 Docked windows appear {videoSettings.placement === 'docked-above' ? 'above' : 'below'} the main window.
                Up to 3 cameras can be displayed side by side.
              </span>
            )}
          </div>
        )}
        
        <div className="flex justify-end mt-3">
          <XPButton onClick={() => setShowVideoDialog(false)}>Close</XPButton>
        </div>
      </XPDialog>

      {/* Reorder Databoxes Dialog */}
      <XPDialog
        title="Reorder Databoxes"
        isOpen={showReorderDialog}
        onClose={() => setShowReorderDialog(false)}
      >
        <p className="text-[11px] text-black mb-3">
          Drag and drop to reorder databoxes. Changes are saved automatically.
        </p>
        
        <div className="space-y-1 mb-3">
          {databoxOrder.map((databoxType, index) => (
            <div
              key={databoxType}
              draggable
              onDragStart={() => handleDragStart(databoxType)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(databoxType)}
              className={`
                flex items-center gap-2 px-2 py-1.5 border cursor-move
                ${draggedDatabox === databoxType ? 'bg-[#316AC5] text-white' : 'bg-white text-black hover:bg-[#E5F3FF]'}
              `}
              style={{ borderColor: '#808080', borderRadius: '2px' }}
            >
              <span className="text-[10px] text-gray-500 w-4">{index + 1}.</span>
              <span className="text-[11px] flex-1">{getDataboxDisplayName(databoxType)}</span>
              <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
          ))}
        </div>
        
        <div className="flex justify-between">
          <XPButton onClick={resetDataboxOrder}>Reset to Default</XPButton>
          <XPButton onClick={() => setShowReorderDialog(false)}>Close</XPButton>
        </div>
      </XPDialog>

      {/* Shutdown Confirmation Dialog */}
      <XPDialog
        title="Shut Down Printer"
        isOpen={showShutdownDialog}
        onClose={() => setShowShutdownDialog(false)}
      >
        <p className="text-[11px] text-black mb-3">
          Are you sure you want to emergency stop the printer?
        </p>
        <div className="flex justify-end gap-2">
          <XPButton onClick={() => setShowShutdownDialog(false)}>Cancel</XPButton>
          <XPButton variant="danger" disabled={isShuttingDown} onClick={handleEmergencyShutdown}>
            {isShuttingDown ? 'Stopping...' : 'Shut Down'}
          </XPButton>
        </div>
      </XPDialog>

      {/* Floating Camera Windows - Snapshots */}
      {snapshotSettings.placement === 'floating' && (
        <FloatingCameraManager
          cameras={snapshotCameraConfigs}
          placement={snapshotSettings.placement}
          timestamp={snapshotTimestamp}
          onCameraClose={handleRemoveCameraFromWindow}
          savedPositions={floatingSnapshotPositions}
          savedSizes={floatingSnapshotSizes}
          onPositionChange={handleFloatingSnapshotPositionChange}
          onSizeChange={handleFloatingSnapshotSizeChange}
        />
      )}

      {/* Floating Camera Windows - Chroma */}
      {chromaSettings.placement === 'floating' && (
        <FloatingCameraManager
          cameras={chromaCameraConfigs}
          placement={chromaSettings.placement}
          onCameraClose={handleCloseChromaWindow}
          savedPositions={floatingChromaPositions}
          savedSizes={floatingChromaSizes}
          onPositionChange={handleFloatingChromaPositionChange}
          onSizeChange={handleFloatingChromaSizeChange}
        />
      )}

      {/* Floating Camera Windows - Video */}
      {videoSettings.placement === 'floating' && (
        <FloatingCameraManager
          cameras={videoCameraConfigs}
          placement={videoSettings.placement}
          onCameraClose={handleCloseVideoWindow}
          savedPositions={floatingVideoPositions}
          savedSizes={floatingVideoSizes}
          onPositionChange={handleFloatingVideoPositionChange}
          onSizeChange={handleFloatingVideoSizeChange}
        />
      )}

      {/* Main Layout Container - handles docked windows positioning */}
      <div className="w-full max-w-4xl flex flex-col gap-3">
        {/* Docked Above - Snapshots */}
        {snapshotSettings.placement === 'docked-above' && (
          <DockedCameraManager
            cameras={orderedSnapshotCameraConfigs}
            placement="docked-above"
            timestamp={snapshotTimestamp}
            onCameraClose={handleRemoveCameraFromWindow}
            onOrderChange={handleDockedSnapshotOrderChange}
            onWindowSizeChange={handleSnapshotSizeChange}
            windowSizes={dockedSnapshotSizes}
            maxWindows={3}
          />
        )}

        {/* Docked Above - Chroma */}
        {chromaSettings.placement === 'docked-above' && (
          <DockedCameraManager
            cameras={orderedChromaCameraConfigs}
            placement="docked-above"
            onCameraClose={handleCloseChromaWindow}
            onOrderChange={handleDockedChromaOrderChange}
            onWindowSizeChange={handleChromaSizeChange}
            windowSizes={dockedChromaSizes}
            maxWindows={3}
          />
        )}

        {/* Docked Above - Video */}
        {videoSettings.placement === 'docked-above' && (
          <DockedCameraManager
            cameras={orderedVideoCameraConfigs}
            placement="docked-above"
            onCameraClose={handleCloseVideoWindow}
            onOrderChange={handleDockedVideoOrderChange}
            onWindowSizeChange={handleVideoSizeChange}
            windowSizes={dockedVideoSizes}
            maxWindows={3}
          />
        )}

        {/* Windows XP Window Frame */}
        <div 
          className="w-full flex flex-col shadow-2xl"
          style={{
            height: snapshotSettings.placement === 'docked-above' || snapshotSettings.placement === 'docked-below' ||
                   chromaSettings.placement === 'docked-above' || chromaSettings.placement === 'docked-below' ||
                   videoSettings.placement === 'docked-above' || videoSettings.placement === 'docked-below'
              ? 'calc(100vh - 200px)' 
              : 'calc(100vh - 32px)',
            maxHeight: snapshotSettings.placement === 'docked-above' || snapshotSettings.placement === 'docked-below' ||
                       chromaSettings.placement === 'docked-above' || chromaSettings.placement === 'docked-below' ||
                       videoSettings.placement === 'docked-above' || videoSettings.placement === 'docked-below'
              ? 'calc(100vh - 200px)'
              : 'calc(100vh - 32px)',
            borderRadius: '8px 8px 4px 4px',
            border: '1px solid #0054E3',
          overflow: 'hidden',
        }}
      >
        {/* Title Bar */}
        <div 
          className="flex items-center justify-between px-2 py-1 select-none"
          style={{
            background: darkMode 
              ? 'linear-gradient(180deg, #002550 0%, #001E4D 10%, #001740 50%, #001333 90%, #000D26 100%)'
              : 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 10%, #0047CC 50%, #003EB8 90%, #002B8C 100%)',
            borderTopLeftRadius: '7px',
            borderTopRightRadius: '7px',
            height: '26px',
            minHeight: '26px',
          }}
        >
          <div className="flex items-center gap-2">
            <img 
              src={`/favicon-${getFaviconSuffix(printerValues.printState)}-48x48.png`}
              alt="Printer Status"
              className="w-4 h-4"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/apple-touch-icon.png'
              }}
            />
            <span className="text-white text-xs font-bold drop-shadow-sm" style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.3)' }}>
              s1pper3d Print Manager
            </span>
          </div>
          
          <div className="flex items-center gap-0.5">
            <button 
              className="w-5 h-5 rounded-sm flex items-end justify-center pb-0.5 text-white"
              style={{
                background: darkMode
                  ? 'linear-gradient(180deg, #1C4A8C 0%, #154079 50%, #0F3666 100%)'
                  : 'linear-gradient(180deg, #3C8CF3 0%, #2570D4 50%, #1C5BB8 100%)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <Minus className="w-3 h-3" />
            </button>
            <button 
              className="w-5 h-5 rounded-sm flex items-center justify-center text-white"
              style={{
                background: darkMode
                  ? 'linear-gradient(180deg, #1C4A8C 0%, #154079 50%, #0F3666 100%)'
                  : 'linear-gradient(180deg, #3C8CF3 0%, #2570D4 50%, #1C5BB8 100%)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button 
              className="w-5 h-5 rounded-sm flex items-center justify-center text-white"
              style={{
                background: darkMode
                  ? 'linear-gradient(180deg, #B85C4E 0%, #A8483A 50%, #983428 100%)'
                  : 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
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
          style={{ backgroundColor: colors.windowBg, borderColor: colors.border }}
        >
          <div className="relative">
            <span 
              className={`px-2 py-0.5 cursor-default flex items-center gap-0.5 ${showFileMenu ? 'bg-[#316AC5] text-white' : 'hover:bg-[#316AC5] hover:text-white'}`}
              style={{ color: showFileMenu ? '#FFFFFF' : colors.labelText }}
              onClick={() => { setShowOptionsMenu(false); setShowViewMenu(false); setShowFileMenu(!showFileMenu) }}
            >
              File <ChevronDown className="w-3 h-3" />
            </span>
            {showFileMenu && (
              <div 
                className="absolute top-full left-0 z-50 py-1 min-w-[200px] shadow-md"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #808080' }}
                onMouseLeave={handleCloseMenus}
              >
                <div 
                  className={`px-4 py-1 flex items-center gap-2 ${hasActivePrint ? 'hover:bg-[#316AC5] hover:text-white cursor-pointer' : 'cursor-default'}`}
                  style={{ color: hasActivePrint ? colors.labelText : colors.border }}
                  onClick={hasActivePrint ? handleDownloadGcode : undefined}
                >
                  <Download className="w-3 h-3" />
                  Download GCODE
                </div>
              </div>
            )}
          </div>
          
          <div className="relative">
            <span 
              className={`px-2 py-0.5 cursor-default flex items-center gap-0.5 ${showOptionsMenu ? 'bg-[#316AC5] text-white' : 'hover:bg-[#316AC5] hover:text-white'}`}
              style={{ color: showOptionsMenu ? '#FFFFFF' : colors.labelText }}
              onClick={() => { setShowFileMenu(false); setShowViewMenu(false); setShowOptionsMenu(!showOptionsMenu) }}
            >
              Options <ChevronDown className="w-3 h-3" />
            </span>
            {showOptionsMenu && (
              <div 
                className="absolute top-full left-0 z-50 py-1 min-w-[200px] shadow-md"
                style={{ backgroundColor: colors.contentBg, border: `1px solid ${colors.border}` }}
                onMouseLeave={handleCloseMenus}
              >
                <div className="px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  style={{ color: colors.labelText }}
                  onClick={() => { openChromaDialog(); setShowOptionsMenu(false) }}>
                  Chroma...
                </div>
                <div className="px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  style={{ color: colors.labelText }}
                  onClick={() => { setShowSnapshotDialog(true); setShowOptionsMenu(false) }}>
                  Snapshots...
                </div>
                <div className="px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  style={{ color: colors.labelText }}
                  onClick={() => { setShowVideoDialog(true); setShowOptionsMenu(false) }}>
                  Video...
                </div>
                <div className="border-t my-1" style={{ borderColor: colors.border }} />
                <div className="px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  style={{ color: colors.labelText }}
                  onClick={() => { setShowDisplayDialog(true); setShowOptionsMenu(false) }}>
                  Display...
                </div>
                <div className="border-t my-1" style={{ borderColor: colors.border }} />
                <div 
                  className={`px-4 py-1 flex items-center justify-between cursor-pointer ${
                    growTentEnabled ? 'hover:bg-[#316AC5] hover:text-white' : 'hover:bg-[#316AC5] hover:text-white'
                  }`}
                  style={{ color: colors.labelText }}
                  onClick={() => setGrowTentEnabled(!growTentEnabled)}
                >
                  <span>Show Grow Tent</span>
                  <span className="text-xs">{growTentEnabled ? '✓' : ''}</span>
                </div>
                <div className="border-t my-1" style={{ borderColor: colors.border }} />
                <div className="px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer"
                  style={{ color: colors.labelText }} onClick={() => { setShowReorderDialog(true); setShowOptionsMenu(false) }}>
                  Reorder Databoxes...
                </div>
              </div>
            )}
          </div>
          
          <div className="relative">
            <span 
              className={`px-2 py-0.5 cursor-default flex items-center gap-0.5 ${showViewMenu ? 'bg-[#316AC5] text-white' : 'hover:bg-[#316AC5] hover:text-white'}`}
              style={{ color: showViewMenu ? '#FFFFFF' : colors.labelText }}
              onClick={() => { setShowFileMenu(false); setShowOptionsMenu(false); setShowViewMenu(!showViewMenu) }}
            >
              View <ChevronDown className="w-3 h-3" />
            </span>
            {showViewMenu && (
              <div 
                className="absolute top-full left-0 z-50 py-1 min-w-[180px] shadow-md"
                style={{ backgroundColor: colors.contentBg, border: `1px solid ${colors.border}` }}
                onMouseLeave={handleCloseMenus}
              >
                <a href="/view/stream/horizontal" className="block px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer" style={{ color: colors.labelText }}>
                  Horizontal Stream View
                </a>
                <a href="/view/stream/vertical" className="block px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer" style={{ color: colors.labelText }}>
                  Vertical Stream View
                </a>
                <div className="border-t my-1" style={{ borderColor: colors.border }} />
                <a href="/" className="block px-4 py-1 hover:bg-[#316AC5] hover:text-white cursor-pointer" style={{ color: colors.labelText }}>
                  Dashboard Home
                </a>
              </div>
            )}
          </div>
          
          <span 
            className={`px-2 py-0.5 cursor-default ${isDevelopment ? 'hover:bg-[#316AC5] hover:text-white' : ''}`}
            style={{ color: isDevelopment ? colors.labelText : colors.border }}
            onClick={() => isDevelopment && setShowShutdownDialog(true)}
            title={isDevelopment ? 'Shut down the printer host' : 'Shutdown disabled in production'}
          >
            Shut Down
          </span>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: colors.windowBg }}>
          {/* Tab bar */}
          <div className="flex px-2 pt-1" style={{ backgroundColor: colors.windowBg }}>
            <XPTabButton active={activeTab === 'klipper'} onClick={() => setActiveTab('klipper')}>
              Klipper
            </XPTabButton>
            <XPTabButton 
              active={activeTab === 'model'} 
              onClick={() => hasActivePrint && setActiveTab('model')}
              disabled={!hasActivePrint}
            >
              Model
            </XPTabButton>
            <XPTabButton active={activeTab === 'applications'} onClick={() => setActiveTab('applications')}>
              Applications
            </XPTabButton>
            <XPTabButton active={activeTab === 'processes'} onClick={() => setActiveTab('processes')}>
              Processes
            </XPTabButton>
            <XPTabButton active={activeTab === 'networking'} onClick={() => setActiveTab('networking')}>
              Networking
            </XPTabButton>
            <XPTabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
              Users
            </XPTabButton>
          </div>

          {/* Tab content */}
          <div 
            className="flex-1 mx-2 mb-2 overflow-hidden flex flex-col"
            style={{
              backgroundColor: colors.contentBg,
              border: `1px solid ${colors.tabBorder}`,
              borderTop: 'none',
              borderRadius: '0 0 2px 2px',
              minHeight: 0,
            }}
          >
            <div className="flex-1 overflow-auto">
              {activeTab === 'klipper' && (
                <KlipperTab
                  chromaCameras={chromaCameras}
                  chromaSettings={chromaSettings}
                  selectedSnapshotCameras={selectedSnapshotCameras}
                  availableWebcams={availableWebcams}
                  snapshotSettings={snapshotSettings}
                  snapshotTimestamp={snapshotTimestamp}
                  selectedVideoCameras={selectedVideoCameras}
                  videoSettings={videoSettings}
                  extruderHistory={extruderHistory}
                  extruderTargetHistory={extruderTargetHistory}
                  bedHistory={bedHistory}
                  bedTargetHistory={bedTargetHistory}
                  printerValues={printerValues}
                  systemStats={systemStats}
                  lifetimeStats={lifetimeStats}
                  modelThumbnail={modelThumbnail}
                  modelPreviewDarkBg={modelPreviewDarkBg}
                  onToggleModelPreviewDarkBg={toggleModelPreviewDarkBg}
                  databoxOrder={databoxOrder}
                  displayStatus={display_status}
                  klippyState={liveStatus?.system?.klippyState}
                  filePosition={liveStatus?.file?.position}
                  fileSize={liveStatus?.file?.size}
                  growTentStatus={growTentStatus}
                  growTentEnabled={growTentEnabled}
                />
              )}
              {activeTab === 'model' && (
                <ModelTab
                  metadata={modelMetadata}
                  modelThumbnail={modelThumbnail}
                  filename={liveStatus?.print?.filename || null}
                  isLoading={isLoadingMetadata}
                />
              )}
              {activeTab === 'applications' && (
                <ApplicationsTab
                  printState={printerValues.printState}
                  filename={printerValues.filename}
                  printProgress={printerValues.printProgress}
                  currentLayer={printerValues.currentLayer}
                  totalLayers={printerValues.totalLayers}
                />
              )}
              {activeTab === 'processes' && (
                <ProcessesTab
                  systemStats={systemStats}
                  systemInfo={systemInfo}
                  extruderActual={printerValues.extruderActual}
                  extruderPower={printerValues.extruderPower}
                  bedActual={printerValues.bedActual}
                  bedPower={printerValues.bedPower}
                  printState={printerValues.printState}
                />
              )}
              {activeTab === 'networking' && (
                <NetworkingTab
                  systemStats={systemStats}
                  networkHistory={networkHistory}
                />
              )}
              {activeTab === 'users' && (
                <UsersTab websocketConnections={systemStats?.websocketConnections || 0} />
              )}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div 
          className="flex items-center h-6 text-xs border-t"
          style={{ 
            backgroundColor: colors.statusBg,
            borderColor: colors.border,
            borderBottomLeftRadius: '3px',
            borderBottomRightRadius: '3px',
          }}
        >
          <div 
            className="flex-1 px-2 flex items-center gap-1.5"
            style={{
              color: colors.labelText,
              borderRight: `1px solid ${colors.border}`,
              borderTop: `1px solid ${colors.border}`,
              borderLeft: `1px solid ${colors.borderLight}`,
              borderBottom: `1px solid ${colors.borderLight}`,
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
          <div 
            className="px-2 flex items-center gap-2 text-[10px]"
            style={{
              color: colors.labelText,
              borderRight: `1px solid ${colors.border}`,
              borderTop: `1px solid ${colors.border}`,
              borderLeft: `1px solid ${colors.borderLight}`,
              borderBottom: `1px solid ${colors.borderLight}`,
              margin: '2px',
              padding: '0 8px',
              minWidth: '180px',
            }}
          >
            <span className="truncate">
              {liveStatus?.system?.klippyState || 'unknown'}
            </span>
            <span className="text-gray-500">|</span>
            <span>
              File: {liveStatus?.file?.size && liveStatus.file.size > 0 
                ? ((liveStatus.file.position / liveStatus.file.size) * 100).toFixed(1) 
                : '0.0'}%
            </span>
          </div>
        </div>
      </div>

        {/* Docked Below - Snapshots */}
        {snapshotSettings.placement === 'docked-below' && (
          <DockedCameraManager
            cameras={orderedSnapshotCameraConfigs}
            placement="docked-below"
            timestamp={snapshotTimestamp}
            onCameraClose={handleRemoveCameraFromWindow}
            onOrderChange={handleDockedSnapshotOrderChange}
            onWindowSizeChange={handleSnapshotSizeChange}
            windowSizes={dockedSnapshotSizes}
            maxWindows={3}
          />
        )}

        {/* Docked Below - Chroma */}
        {chromaSettings.placement === 'docked-below' && (
          <DockedCameraManager
            cameras={orderedChromaCameraConfigs}
            placement="docked-below"
            onCameraClose={handleCloseChromaWindow}
            onOrderChange={handleDockedChromaOrderChange}
            onWindowSizeChange={handleChromaSizeChange}
            windowSizes={dockedChromaSizes}
            maxWindows={3}
          />
        )}

        {/* Docked Below - Video */}
        {videoSettings.placement === 'docked-below' && (
          <DockedCameraManager
            cameras={orderedVideoCameraConfigs}
            placement="docked-below"
            onCameraClose={handleCloseVideoWindow}
            onOrderChange={handleDockedVideoOrderChange}
            onWindowSizeChange={handleVideoSizeChange}
            windowSizes={dockedVideoSizes}
            maxWindows={3}
          />
        )}
      </div>
    </div>
  )
}
