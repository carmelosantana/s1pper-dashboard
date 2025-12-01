'use client'

import { memo, useMemo } from 'react'
import { Camera, Video, Image, Clock, Terminal, ToggleLeft, ToggleRight } from 'lucide-react'
import { XPGraph, XPVerticalBar, XP_COLORS } from '@/components/ui/xp-components'
import { 
  formatTime, 
  formatFilament, 
  getPowerColor, 
  getTemperatureRateOfChange,
  getChartsSizeSpan,
  getDataboxSizeSpan,
  truncateFilename
} from '@/lib/utils/taskmanager-utils'
import type { WebcamConfig, LifetimeStats } from '@/lib/types'
import type { SystemStats } from '@/app/api/printer/system-stats/route'

// Types
type DataboxType = 'model-preview' | 'print-job' | 'temperatures' | 'console' | 'system' | 'uptime' | 'lifetime'
type VideoSize = 'responsive' | 'small' | 'medium' | 'large'
type SnapshotPlacement = 'above' | 'below' | 'databoxes'

interface ChromaCamera {
  id: string
  title: string
  url: string
  framerate: 15 | 30 | 60
  chromaColor: 'green' | 'blue' | 'custom'
  customColor?: string
  size: VideoSize
}

interface SnapshotSettings {
  size: VideoSize
  placement: SnapshotPlacement
}

interface PrinterValues {
  extruderActual: number
  extruderTarget: number
  extruderPower: number
  bedActual: number
  bedTarget: number
  bedPower: number
  printProgress: number
  printState: string
  filename: string
  printTime: number
  estimatedTimeLeft: number
  filamentUsed: number
  currentLayer: number
  totalLayers: number
  currentSpeed: number
}

interface KlipperTabProps {
  // Camera data
  chromaCameras: ChromaCamera[]
  selectedSnapshotCameras: string[]
  availableWebcams: WebcamConfig[]
  snapshotSettings: SnapshotSettings
  snapshotTimestamp: number
  
  // Chart history data
  extruderHistory: number[]
  extruderTargetHistory: number[]
  bedHistory: number[]
  bedTargetHistory: number[]
  
  // Printer values
  printerValues: PrinterValues
  
  // System stats
  systemStats: SystemStats | null
  
  // Lifetime stats
  lifetimeStats: LifetimeStats | null
  
  // Model thumbnail
  modelThumbnail: string | null
  modelPreviewDarkBg: boolean
  onToggleModelPreviewDarkBg: () => void
  
  // Databox ordering
  databoxOrder: DataboxType[]
  
  // Display status
  displayStatus?: { message?: string }
  klippyState?: string
  filePosition?: number
  fileSize?: number
}

// Chroma color helper
const getChromaColorValue = (camera: ChromaCamera): string => {
  switch (camera.chromaColor) {
    case 'green': return '#00FF00'
    case 'blue': return '#0000FF'
    case 'custom': return camera.customColor || '#00FF00'
    default: return '#00FF00'
  }
}

// Size span helper for chroma cameras
const getSizeSpan = (size: VideoSize): string => {
  switch (size) {
    case 'responsive': return ''
    case 'small': return ''
    case 'medium': return 'sm:col-span-2'
    case 'large': return 'sm:col-span-3'
    default: return ''
  }
}

// Snapshot Section Component - memoized
const SnapshotSection = memo(function SnapshotSection({
  selectedSnapshotCameras,
  availableWebcams,
  snapshotSettings,
  snapshotTimestamp,
  isDataboxStyle = false
}: {
  selectedSnapshotCameras: string[]
  availableWebcams: WebcamConfig[]
  snapshotSettings: SnapshotSettings
  snapshotTimestamp: number
  isDataboxStyle?: boolean
}) {
  if (selectedSnapshotCameras.length === 0) return null
  
  // Databox style: render as individual databox cards in the stats grid
  if (isDataboxStyle) {
    const databoxSizeClass = getDataboxSizeSpan(snapshotSettings.size)
    
    return (
      <>
        {selectedSnapshotCameras.map(cameraUid => {
          const camera = availableWebcams.find(w => w.uid === cameraUid)
          if (!camera) return null
          
          return (
            <div 
              key={cameraUid}
              className={`border p-0 overflow-hidden ${databoxSizeClass}`}
              style={{ 
                borderColor: '#919B9C',
                boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
              }}
            >
              <div className="font-bold text-black px-2 py-1 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  <span className="truncate text-[11px]">{camera.name}</span>
                </div>
                <span 
                  className="text-[8px] bg-[#316AC5] text-white px-1 py-0.5 rounded"
                  style={{ fontSize: '8px' }}
                >
                  5s
                </span>
              </div>
              <div 
                className="relative w-full"
                style={{ 
                  backgroundColor: '#000000',
                  aspectRatio: camera.aspect_ratio === '16:9' ? '16/9' : '4/3'
                }}
              >
                <img
                  src={`/api/camera/snapshot?uid=${cameraUid}&t=${snapshotTimestamp}`}
                  alt={`${camera.name} snapshot`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            </div>
          )
        })}
      </>
    )
  }
  
  // Standard style (above/below)
  const chartsSizeClass = getChartsSizeSpan(snapshotSettings.size)
  
  return (
    <div className="mb-3">
      <div className="text-black font-bold mb-2 flex items-center gap-2">
        <Camera className="w-4 h-4" />
        Camera Snapshots
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {selectedSnapshotCameras.map(cameraUid => {
          const camera = availableWebcams.find(w => w.uid === cameraUid)
          if (!camera) return null
          
          return (
            <div 
              key={cameraUid}
              className={chartsSizeClass}
              style={{ 
                border: '1px solid #919B9C',
                boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
              }}
            >
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
                  loading="lazy"
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
  )
})

// Live Video Section Component - memoized
const LiveVideoSection = memo(function LiveVideoSection({
  chromaCameras
}: {
  chromaCameras: ChromaCamera[]
}) {
  if (chromaCameras.length === 0) return null
  
  return (
    <div className="mb-3">
      <div className="text-black font-bold mb-2 flex items-center gap-2">
        <Video className="w-4 h-4" />
        Live Video
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {chromaCameras.map(camera => (
          <div 
            key={camera.id}
            className={getSizeSpan(camera.size || 'small')}
            style={{ 
              border: '1px solid #919B9C',
              boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF',
            }}
          >
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
                  loading="lazy"
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
  )
})

// Chart Rows Component - memoized
const ChartRows = memo(function ChartRows({
  extruderHistory,
  extruderTargetHistory,
  bedHistory,
  bedTargetHistory,
  extruderPower,
  bedPower
}: {
  extruderHistory: number[]
  extruderTargetHistory: number[]
  bedHistory: number[]
  bedTargetHistory: number[]
  extruderPower: number
  bedPower: number
}) {
  return (
    <>
      {/* Top row: Hotend */}
      <div className="grid grid-cols-4 gap-3 mb-3">
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

      {/* Second row: Bed */}
      <div className="grid grid-cols-4 gap-3 mb-3">
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
    </>
  )
})

// Individual Databox Components - memoized
const ModelPreviewDatabox = memo(function ModelPreviewDatabox({
  modelThumbnail,
  modelPreviewDarkBg,
  onToggle,
  filename
}: {
  modelThumbnail: string | null
  modelPreviewDarkBg: boolean
  onToggle: () => void
  filename: string
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  return (
    <div className="border p-0 overflow-hidden" style={databoxStyle}>
      <div className="font-bold text-black px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Image className="w-3 h-3" />
          <span>Model Preview</span>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center"
          title={modelPreviewDarkBg ? 'Disable dark background' : 'Enable dark background'}
        >
          {modelPreviewDarkBg ? (
            <ToggleRight className="w-4 h-4 text-[#316AC5]" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
      <div 
        className="relative w-full"
        style={{ 
          backgroundColor: modelPreviewDarkBg ? '#000000' : 'transparent',
          minHeight: '80px',
          aspectRatio: '1/1',
          maxHeight: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {modelThumbnail ? (
          <img
            src={modelThumbnail}
            alt="Model preview"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain',
              display: 'block'
            }}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="text-gray-500 text-[10px] text-center p-2">
            {filename !== 'No active print' ? 'No preview' : 'No print active'}
          </div>
        )}
      </div>
    </div>
  )
})

const PrintJobDatabox = memo(function PrintJobDatabox({
  filename,
  printProgress,
  currentLayer,
  totalLayers,
  printTime,
  estimatedTimeLeft,
  filamentUsed,
  currentSpeed
}: {
  filename: string
  printProgress: number
  currentLayer: number
  totalLayers: number
  printTime: number
  estimatedTimeLeft: number
  filamentUsed: number
  currentSpeed: number
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1">Print Job</div>
      <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
        <span>File</span>
        <span className="text-right truncate" title={filename}>
          {truncateFilename(filename, 10)}
        </span>
        <span>Progress</span>
        <span className="text-right">{printProgress.toFixed(0)}%</span>
        {totalLayers > 0 && (
          <>
            <span>Layer</span>
            <span className="text-right">{currentLayer} / {totalLayers}</span>
          </>
        )}
        <span>Elapsed</span>
        <span className="text-right">{formatTime(printTime)}</span>
        <span>Remaining</span>
        <span className="text-right">{formatTime(estimatedTimeLeft)}</span>
        <span>Filament</span>
        <span className="text-right">{formatFilament(filamentUsed)}</span>
        <span>Speed</span>
        <span className="text-right">{currentSpeed} mm/s</span>
      </div>
    </div>
  )
})

const TemperaturesDatabox = memo(function TemperaturesDatabox({
  extruderActual,
  extruderTarget,
  bedActual,
  bedTarget,
  extruderHistory,
  bedHistory,
  cpuTemp
}: {
  extruderActual: number
  extruderTarget: number
  bedActual: number
  bedTarget: number
  extruderHistory: number[]
  bedHistory: number[]
  cpuTemp?: number | null
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  const hotendRate = useMemo(() => getTemperatureRateOfChange(extruderHistory, 10), [extruderHistory])
  const bedRate = useMemo(() => getTemperatureRateOfChange(bedHistory, 10), [bedHistory])
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1">Temperatures (°C)</div>
      <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
        <span>Hotend</span>
        <span className="text-right">{extruderActual.toFixed(0)} / {extruderTarget.toFixed(0)}</span>
        <span className="text-[9px] text-gray-600">Rate</span>
        <span 
          className="text-right font-bold text-[9px]"
          style={{ color: hotendRate.color }}
          title="Temperature rate of change (°C/s)"
        >
          {hotendRate.formatted}°C/s
        </span>
        <span>Bed</span>
        <span className="text-right">{bedActual.toFixed(0)} / {bedTarget.toFixed(0)}</span>
        <span className="text-[9px] text-gray-600">Rate</span>
        <span 
          className="text-right font-bold text-[9px]"
          style={{ color: bedRate.color }}
          title="Temperature rate of change (°C/s)"
        >
          {bedRate.formatted}°C/s
        </span>
        <span>CPU</span>
        <span className="text-right">{cpuTemp?.toFixed(0) || 'N/A'}°C</span>
      </div>
    </div>
  )
})

const ConsoleDatabox = memo(function ConsoleDatabox({
  displayMessage,
  klippyState,
  filePosition,
  fileSize
}: {
  displayMessage: string
  klippyState: string
  filePosition: number
  fileSize: number
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  const fileProgress = fileSize > 0 ? ((filePosition / fileSize) * 100).toFixed(1) : '0.0'
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1 flex items-center gap-1">
        <Terminal className="w-3 h-3" />
        <span>Console</span>
      </div>
      <div 
        className="bg-black text-green-400 font-mono text-[9px] p-1.5 overflow-hidden"
        style={{ 
          minHeight: '48px',
          maxHeight: '60px',
          borderRadius: '2px'
        }}
      >
        <div className="truncate" title={displayMessage || 'Ready'}>
          &gt; {displayMessage || 'Ready'}
        </div>
        <div className="text-green-600 text-[8px] mt-1">
          State: {klippyState} | File: {fileProgress}%
        </div>
      </div>
    </div>
  )
})

const SystemDatabox = memo(function SystemDatabox({
  cpuUsage,
  memoryUsed,
  memoryAvailable
}: {
  cpuUsage: number
  memoryUsed: number
  memoryAvailable: number
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1">System</div>
      <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
        <span>CPU</span>
        <span className="text-right">{cpuUsage.toFixed(0)}%</span>
        <span>Memory</span>
        <span className="text-right">{(memoryUsed / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
        <span>Available</span>
        <span className="text-right">{(memoryAvailable / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
      </div>
    </div>
  )
})

const UptimeDatabox = memo(function UptimeDatabox({
  systemUptime,
  moonrakerTime,
  websocketConnections
}: {
  systemUptime: number
  moonrakerTime: number
  websocketConnections: number
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1">Uptime</div>
      <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
        <span>System</span>
        <span className="text-right">{formatTime(systemUptime)}</span>
        <span>Moonraker</span>
        <span className="text-right">{formatTime(moonrakerTime)}</span>
        <span>WebSockets</span>
        <span className="text-right">{websocketConnections}</span>
      </div>
    </div>
  )
})

const LifetimeDatabox = memo(function LifetimeDatabox({
  lifetimeStats
}: {
  lifetimeStats: LifetimeStats | null
}) {
  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }
  
  return (
    <div className="border p-2" style={databoxStyle}>
      <div className="font-bold text-black mb-1 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>Lifetime</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 text-black text-[10px]">
        <span>Print Time</span>
        <span className="text-right">{lifetimeStats ? formatTime(lifetimeStats.totalPrintTime) : 'N/A'}</span>
        <span>Total Jobs</span>
        <span className="text-right">{lifetimeStats?.totalJobs || 0}</span>
        <span>Filament</span>
        <span className="text-right">{lifetimeStats ? formatFilament(lifetimeStats.totalFilamentUsed) : 'N/A'}</span>
      </div>
    </div>
  )
})

// Main Klipper Tab Component
export const KlipperTab = memo(function KlipperTab({
  chromaCameras,
  selectedSnapshotCameras,
  availableWebcams,
  snapshotSettings,
  snapshotTimestamp,
  extruderHistory,
  extruderTargetHistory,
  bedHistory,
  bedTargetHistory,
  printerValues,
  systemStats,
  lifetimeStats,
  modelThumbnail,
  modelPreviewDarkBg,
  onToggleModelPreviewDarkBg,
  databoxOrder,
  displayStatus,
  klippyState,
  filePosition,
  fileSize
}: KlipperTabProps) {
  // Render databox based on type
  const renderDatabox = (databoxType: DataboxType) => {
    switch (databoxType) {
      case 'model-preview':
        return (
          <ModelPreviewDatabox
            key={databoxType}
            modelThumbnail={modelThumbnail}
            modelPreviewDarkBg={modelPreviewDarkBg}
            onToggle={onToggleModelPreviewDarkBg}
            filename={printerValues.filename}
          />
        )
      
      case 'print-job':
        return (
          <PrintJobDatabox
            key={databoxType}
            filename={printerValues.filename}
            printProgress={printerValues.printProgress}
            currentLayer={printerValues.currentLayer}
            totalLayers={printerValues.totalLayers}
            printTime={printerValues.printTime}
            estimatedTimeLeft={printerValues.estimatedTimeLeft}
            filamentUsed={printerValues.filamentUsed}
            currentSpeed={printerValues.currentSpeed}
          />
        )
      
      case 'temperatures':
        return (
          <TemperaturesDatabox
            key={databoxType}
            extruderActual={printerValues.extruderActual}
            extruderTarget={printerValues.extruderTarget}
            bedActual={printerValues.bedActual}
            bedTarget={printerValues.bedTarget}
            extruderHistory={extruderHistory}
            bedHistory={bedHistory}
            cpuTemp={systemStats?.system?.cpuTemp}
          />
        )
      
      case 'console':
        return (
          <ConsoleDatabox
            key={databoxType}
            displayMessage={displayStatus?.message || ''}
            klippyState={klippyState || 'unknown'}
            filePosition={filePosition || 0}
            fileSize={fileSize || 0}
          />
        )
      
      case 'system':
        return (
          <SystemDatabox
            key={databoxType}
            cpuUsage={systemStats?.system?.cpuUsage?.total || 0}
            memoryUsed={systemStats?.system?.memory?.used || 0}
            memoryAvailable={systemStats?.system?.memory?.available || 0}
          />
        )
      
      case 'uptime':
        return (
          <UptimeDatabox
            key={databoxType}
            systemUptime={systemStats?.system?.uptime || 0}
            moonrakerTime={systemStats?.moonraker?.time || 0}
            websocketConnections={systemStats?.websocketConnections || 0}
          />
        )
      
      case 'lifetime':
        return (
          <LifetimeDatabox
            key={databoxType}
            lifetimeStats={lifetimeStats}
          />
        )
      
      default:
        return null
    }
  }
  
  return (
    <div className="p-3 font-['Tahoma'] text-xs">
      {/* Live Video Section */}
      <LiveVideoSection chromaCameras={chromaCameras} />

      {/* Snapshot placement: above */}
      {snapshotSettings.placement === 'above' && (
        <SnapshotSection
          selectedSnapshotCameras={selectedSnapshotCameras}
          availableWebcams={availableWebcams}
          snapshotSettings={snapshotSettings}
          snapshotTimestamp={snapshotTimestamp}
        />
      )}

      {/* Chart rows */}
      <ChartRows
        extruderHistory={extruderHistory}
        extruderTargetHistory={extruderTargetHistory}
        bedHistory={bedHistory}
        bedTargetHistory={bedTargetHistory}
        extruderPower={printerValues.extruderPower}
        bedPower={printerValues.bedPower}
      />

      {/* Snapshot placement: below */}
      {snapshotSettings.placement === 'below' && (
        <SnapshotSection
          selectedSnapshotCameras={selectedSnapshotCameras}
          availableWebcams={availableWebcams}
          snapshotSettings={snapshotSettings}
          snapshotTimestamp={snapshotTimestamp}
        />
      )}

      {/* Databoxes - ordered according to user preference */}
      <div className="grid grid-cols-3 gap-3">
        {databoxOrder.map(renderDatabox)}
        
        {/* Snapshot cameras as databoxes (when placement is 'databoxes') */}
        {snapshotSettings.placement === 'databoxes' && (
          <SnapshotSection
            selectedSnapshotCameras={selectedSnapshotCameras}
            availableWebcams={availableWebcams}
            snapshotSettings={snapshotSettings}
            snapshotTimestamp={snapshotTimestamp}
            isDataboxStyle
          />
        )}
      </div>
    </div>
  )
})

export default KlipperTab
