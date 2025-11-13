import { NextResponse } from 'next/server'
import type { PrinterStatus, KlipperResponse, KlipperInfoResponse, ApiError } from '@/lib/types'
import { getDashboardSettings } from '@/lib/database'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

// Cache for 2 seconds to avoid overwhelming the printer
const CACHE_DURATION = 2000
let lastFetch = 0
let cachedData: PrinterStatus | null = null

async function fetchKlipperData(): Promise<PrinterStatus> {
  try {
    // Fetch all required printer objects in one request
    const objectsUrl = `${KLIPPER_BASE_URL}/printer/objects/query?extruder&heater_bed&print_stats&virtual_sdcard&webhooks&toolhead&gcode_move`
    const infoUrl = `${KLIPPER_BASE_URL}/printer/info`
    
    const [objectsResponse, infoResponse] = await Promise.all([
      fetch(objectsUrl, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      }),
      fetch(infoUrl, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      })
    ])

    if (!objectsResponse.ok || !infoResponse.ok) {
      throw new Error(`HTTP error! status: ${objectsResponse.status} / ${infoResponse.status}`)
    }

    const objectsData: KlipperResponse = await objectsResponse.json()
    const infoData: KlipperInfoResponse = await infoResponse.json()
    
    const status = objectsData.result.status
    const info = infoData.result

    // Calculate estimated time left using file metadata when available
    let estimatedTimeLeft: number | null = null
    let slicerEstimatedTime: number | null = null
    
    if (status.print_stats.state === 'printing' && status.virtual_sdcard.progress > 0) {
      const elapsed = status.print_stats.print_duration
      const progress = status.virtual_sdcard.progress
      
      // Try to get file metadata for more accurate time estimation
      if (status.virtual_sdcard.file_path) {
        try {
          const filename = status.virtual_sdcard.file_path.split('/').pop()
          if (filename) {
            const metadataUrl = `${KLIPPER_BASE_URL}/server/files/metadata?filename=${encodeURIComponent(filename)}`
            const metadataResponse = await fetch(metadataUrl, { 
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store'
            })
            
            if (metadataResponse.ok) {
              const metadataData = await metadataResponse.json()
              const metadata = metadataData.result
              
              if (metadata.estimated_time) {
                slicerEstimatedTime = metadata.estimated_time
                // Use method 1 from Moonraker docs: metadata.estimated_time - print_duration
                estimatedTimeLeft = Math.max(0, metadata.estimated_time - elapsed)
              } else {
                // Fallback method 3: calculate based on progress when no metadata
                const totalEstimated = elapsed / progress
                estimatedTimeLeft = Math.max(0, totalEstimated - elapsed)
              }
            } else {
              // Fallback method 3: calculate based on progress when metadata fetch fails
              const totalEstimated = elapsed / progress
              estimatedTimeLeft = Math.max(0, totalEstimated - elapsed)
            }
          }
        } catch (metadataError) {
          console.warn('Failed to fetch file metadata, using fallback calculation:', metadataError)
          // Fallback method 3: calculate based on progress
          const totalEstimated = elapsed / progress
          estimatedTimeLeft = Math.max(0, totalEstimated - elapsed)
        }
      } else {
        // Fallback method 3: calculate based on progress when no file path
        const totalEstimated = elapsed / progress
        estimatedTimeLeft = Math.max(0, totalEstimated - elapsed)
      }
    }

    // Format state for our frontend
    let printState: PrinterStatus['print']['state'] = 'offline'
    switch (status.print_stats.state.toLowerCase()) {
      case 'printing':
        printState = 'printing'
        break
      case 'paused':
        printState = 'paused'
        break
      case 'cancelled':
        printState = 'cancelled'
        break
      case 'complete':
        printState = 'complete'
        break
      case 'error':
        printState = 'error'
        break
      case 'standby':
      case '':
        printState = info.state === 'ready' ? 'ready' : 'offline'
        break
      default:
        printState = info.state === 'ready' ? 'ready' : 'offline'
    }

    // Extract filename from path
    const filename = status.virtual_sdcard.file_path 
      ? status.virtual_sdcard.file_path.split('/').pop() || null
      : null

    const printerStatus: PrinterStatus = {
      print: {
        filename: filename,
        state: printState,
        progress: status.virtual_sdcard.progress,
        currentLayer: status.print_stats.info.current_layer,
        totalLayers: status.print_stats.info.total_layer,
        printTime: status.print_stats.print_duration,
        estimatedTimeLeft: estimatedTimeLeft,
        slicerEstimatedTime: slicerEstimatedTime,
        filamentUsed: status.print_stats.filament_used
      },
      temperatures: {
        extruder: {
          actual: Math.round(status.extruder.temperature * 10) / 10,
          target: status.extruder.target,
          power: Math.round(status.extruder.power * 100) / 100
        },
        bed: {
          actual: Math.round(status.heater_bed.temperature * 10) / 10,
          target: status.heater_bed.target,
          power: Math.round(status.heater_bed.power * 100) / 100
        }
      },
      position: {
        x: status.toolhead?.position[0] || 0,
        y: status.toolhead?.position[1] || 0,
        z: status.toolhead?.position[2] || 0,
        e: status.toolhead?.position[3] || 0
      },
      speeds: {
        current: status.gcode_move?.speed || 0,
        factor: status.gcode_move?.speed_factor || 1
      },
      system: {
        klippyState: info.state,
        klippyMessage: info.state_message,
        homedAxes: status.toolhead?.homed_axes || ''
      },
      file: {
        name: filename,
        size: status.virtual_sdcard.file_size,
        position: status.virtual_sdcard.file_position
      }
    }

    return printerStatus

  } catch (error) {
    console.error('Error fetching Klipper data:', error)
    
    // Return offline status when printer is not reachable
    const offlineStatus: PrinterStatus = {
      print: {
        filename: null,
        state: 'offline',
        progress: 0,
        currentLayer: null,
        totalLayers: null,
        printTime: 0,
        estimatedTimeLeft: null,
        slicerEstimatedTime: null,
        filamentUsed: 0
      },
      temperatures: {
        extruder: { actual: 0, target: 0, power: 0 },
        bed: { actual: 0, target: 0, power: 0 }
      },
      position: { x: 0, y: 0, z: 0, e: 0 },
      speeds: { current: 0, factor: 1 },
      system: {
        klippyState: 'offline',
        klippyMessage: 'Printer offline or unreachable',
        homedAxes: ''
      },
      file: { name: null, size: 0, position: 0 }
    }
    
    return offlineStatus
  }
}

// Helper function to create redacted filename
function createRedactedFilename(originalFilename: string | null): string | null {
  if (!originalFilename) return null
  
  // Create a string of same length with redacted characters
  const length = originalFilename.length
  const extension = originalFilename.split('.').pop()
  const nameLength = originalFilename.lastIndexOf('.') > 0 ? originalFilename.lastIndexOf('.') : length
  
  // Create redacted name with same length as original (excluding extension)
  const redactedName = '█'.repeat(nameLength)
  
  return extension && originalFilename.includes('.') ? `${redactedName}.${extension}` : redactedName
}

// Helper function to apply privacy settings to printer status
function applyPrivacySettings(status: PrinterStatus, visibilityMode: string): PrinterStatus {
  const modifiedStatus = { ...status }
  
  if (visibilityMode === 'private') {
    // Redact filename but keep all other data
    modifiedStatus.print = {
      ...modifiedStatus.print,
      filename: createRedactedFilename(status.print.filename),
      // Also redact layer information in private mode
      currentLayer: status.print.currentLayer ? -1 : null, // Use -1 to indicate redacted
      totalLayers: status.print.totalLayers ? -1 : null // Use -1 to indicate redacted
    }
    modifiedStatus.file = {
      ...modifiedStatus.file,
      name: createRedactedFilename(status.file.name)
    }
  }
  
  return modifiedStatus
}

export async function GET() {
  try {
    // Check if PRINTER_HOST is configured
    if (!KLIPPER_HOST) {
      const configErrorStatus: PrinterStatus = {
        print: {
          filename: null,
          state: 'offline',
          progress: 0,
          currentLayer: null,
          totalLayers: null,
          printTime: 0,
          estimatedTimeLeft: null,
          slicerEstimatedTime: null,
          filamentUsed: 0
        },
        temperatures: {
          extruder: { actual: 0, target: 0, power: 0 },
          bed: { actual: 0, target: 0, power: 0 }
        },
        position: { x: 0, y: 0, z: 0, e: 0 },
        speeds: { current: 0, factor: 1 },
        system: {
          klippyState: 'offline',
          klippyMessage: 'PRINTER_HOST environment variable not configured',
          homedAxes: ''
        },
        file: { name: null, size: 0, position: 0 }
      }
      
      return NextResponse.json(configErrorStatus)
    }

    // Get dashboard settings first
    const settings = await getDashboardSettings()
    const visibilityMode = settings?.visibility_mode || 'public'
    
    // If set to offline, return offline status immediately
    if (visibilityMode === 'offline') {
      const offlineStatus: PrinterStatus = {
        print: {
          filename: null,
          state: 'offline',
          progress: 0,
          currentLayer: null,
          totalLayers: null,
          printTime: 0,
          estimatedTimeLeft: null,
          slicerEstimatedTime: null,
          filamentUsed: 0
        },
        temperatures: {
          extruder: { actual: 0, target: 0, power: 0 },
          bed: { actual: 0, target: 0, power: 0 }
        },
        position: { x: 0, y: 0, z: 0, e: 0 },
        speeds: { current: 0, factor: 1 },
        system: {
          klippyState: 'offline',
          klippyMessage: 'Dashboard set to offline mode',
          homedAxes: ''
        },
        file: { name: null, size: 0, position: 0 }
      }
      
      return NextResponse.json(offlineStatus)
    }
    
    const now = Date.now()
    
    // Use cached data if it's still fresh
    if (cachedData && (now - lastFetch) < CACHE_DURATION) {
      const responseData = applyPrivacySettings(cachedData, visibilityMode)
      return NextResponse.json(responseData)
    }
    
    // Fetch fresh data
    const printerStatus = await fetchKlipperData()
    
    // Update cache
    cachedData = printerStatus
    lastFetch = now
    
    // Apply privacy settings before returning
    const responseData = applyPrivacySettings(printerStatus, visibilityMode)
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('API route error:', error)
    
    const errorResponse: ApiError = {
      error: 'Failed to fetch printer status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}