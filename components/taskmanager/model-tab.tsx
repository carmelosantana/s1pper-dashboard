'use client'

import { memo, useState, useCallback } from 'react'
import { Download, Box, Layers, Clock, Ruler, Thermometer, FileCode } from 'lucide-react'
import { XPButton } from '@/components/ui/xp-components'
import { 
  formatTime, 
  formatFilamentWeight, 
  formatDimension, 
  formatLayerHeight,
  formatNozzleDiameter,
  formatTemperature,
  formatFileSize,
  formatSlicerInfo
} from '@/lib/utils/taskmanager-utils'
import type { GcodeMetadata } from '@/lib/types'

interface ModelTabProps {
  metadata: GcodeMetadata | null
  modelThumbnail: string | null
  filename: string | null
  isLoading?: boolean
}

// Data row component for consistent styling
const DataRow = memo(function DataRow({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex items-center justify-between py-1 px-2 hover:bg-[#E5F3FF]">
      <div className="flex items-center gap-2 text-black text-[11px]">
        {Icon && <Icon className="w-3 h-3 text-[#316AC5]" />}
        <span className="font-semibold">{label}:</span>
      </div>
      <span className="text-black text-[11px]">{value}</span>
    </div>
  )
})

// Section header component
const SectionHeader = memo(function SectionHeader({ 
  title, 
  icon: Icon 
}: { 
  title: string
  icon: React.ElementType
}) {
  return (
    <div 
      className="flex items-center gap-2 px-2 py-1 mb-1"
      style={{
        backgroundColor: '#316AC5',
        color: 'white',
      }}
    >
      <Icon className="w-4 h-4" />
      <span className="font-bold text-xs">{title}</span>
    </div>
  )
})

// Model Tab Component - Shows detailed model information
export const ModelTab = memo(function ModelTab({
  metadata,
  modelThumbnail,
  filename,
  isLoading = false
}: ModelTabProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!filename) return
    
    setIsDownloading(true)
    try {
      // Create a link to trigger the download
      const downloadUrl = `/api/printer/file-download?filename=${encodeURIComponent(filename)}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename.split('/').pop() || filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download file:', error)
    } finally {
      setIsDownloading(false)
    }
  }, [filename])

  // No active print
  if (!filename) {
    return (
      <div className="p-4 h-full font-['Tahoma'] text-xs flex flex-col items-center justify-center">
        <Box className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-black text-center">No model currently loaded.</p>
        <p className="text-gray-500 text-center text-[10px] mt-1">
          Start a print job to view model information.
        </p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 h-full font-['Tahoma'] text-xs flex flex-col items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#316AC5] border-t-transparent rounded-full mb-4" />
        <p className="text-black">Loading model information...</p>
      </div>
    )
  }

  const databoxStyle = {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  }

  return (
    <div className="p-3 h-full font-['Tahoma'] text-xs flex flex-col overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left Column - Model Preview */}
        <div className="space-y-3">
          {/* Model Preview */}
          <div className="border p-0" style={databoxStyle}>
            <SectionHeader title="Model Preview" icon={Box} />
            <div className="p-2">
              {modelThumbnail ? (
                <div className="bg-[#F5F5F5] rounded border border-[#D4D0C8] p-2 flex items-center justify-center">
                  <img 
                    src={modelThumbnail} 
                    alt="Model Preview"
                    className="max-w-full max-h-48 object-contain"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              ) : (
                <div className="bg-[#F5F5F5] rounded border border-[#D4D0C8] p-4 flex flex-col items-center justify-center h-32">
                  <Box className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-gray-500 text-[10px]">No preview available</span>
                </div>
              )}
            </div>
          </div>

          {/* File Information */}
          <div className="border" style={databoxStyle}>
            <SectionHeader title="File Information" icon={FileCode} />
            <div className="divide-y divide-[#D4D0C8]">
              <DataRow 
                label="Filename" 
                value={filename?.split('/').pop() || 'Unknown'} 
              />
              <DataRow 
                label="File Size" 
                value={formatFileSize(metadata?.size)} 
              />
              <DataRow 
                label="Slicer" 
                value={formatSlicerInfo(metadata?.slicer, metadata?.slicer_version)} 
              />
              {metadata?.filament_name && (
                <DataRow 
                  label="Filament" 
                  value={`${metadata.filament_name} (${metadata.filament_type || 'Unknown'})`} 
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Model Details */}
        <div className="space-y-3">
          {/* Dimensions */}
          <div className="border" style={databoxStyle}>
            <SectionHeader title="Dimensions" icon={Ruler} />
            <div className="divide-y divide-[#D4D0C8]">
              <DataRow 
                icon={Ruler}
                label="Object Height" 
                value={formatDimension(metadata?.object_height)} 
              />
              <DataRow 
                icon={Layers}
                label="Layer Height" 
                value={formatLayerHeight(metadata?.layer_height)} 
              />
              <DataRow 
                icon={Layers}
                label="First Layer" 
                value={formatLayerHeight(metadata?.first_layer_height)} 
              />
              <DataRow 
                label="Nozzle Diameter" 
                value={formatNozzleDiameter(metadata?.nozzle_diameter)} 
              />
            </div>
          </div>

          {/* Print Settings */}
          <div className="border" style={databoxStyle}>
            <SectionHeader title="Print Settings" icon={Thermometer} />
            <div className="divide-y divide-[#D4D0C8]">
              <DataRow 
                icon={Thermometer}
                label="Extruder Temp" 
                value={formatTemperature(metadata?.first_layer_extr_temp)} 
              />
              <DataRow 
                icon={Thermometer}
                label="Bed Temp" 
                value={formatTemperature(metadata?.first_layer_bed_temp)} 
              />
              {metadata?.chamber_temp !== undefined && metadata.chamber_temp > 0 && (
                <DataRow 
                  icon={Thermometer}
                  label="Chamber Temp" 
                  value={formatTemperature(metadata.chamber_temp)} 
                />
              )}
            </div>
          </div>

          {/* Estimates */}
          <div className="border" style={databoxStyle}>
            <SectionHeader title="Estimates" icon={Clock} />
            <div className="divide-y divide-[#D4D0C8]">
              <DataRow 
                icon={Clock}
                label="Estimated Time" 
                value={metadata?.estimated_time ? formatTime(metadata.estimated_time) : 'N/A'} 
              />
              <DataRow 
                label="Filament Length" 
                value={metadata?.filament_total ? `${(metadata.filament_total / 1000).toFixed(2)} m` : 'N/A'} 
              />
              <DataRow 
                label="Filament Weight" 
                value={formatFilamentWeight(metadata?.filament_weight_total)} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="mt-4 flex justify-center">
        <XPButton 
          onClick={handleDownload}
          disabled={!filename || isDownloading}
        >
          <Download className="w-3 h-3" />
          {isDownloading ? 'Downloading...' : 'Download GCODE'}
        </XPButton>
      </div>
    </div>
  )
})

export default ModelTab
