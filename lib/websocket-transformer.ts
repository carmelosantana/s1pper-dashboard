/**
 * Transform Moonraker WebSocket data to application types
 * 
 * Maps raw Klipper/Moonraker WebSocket status updates to the 
 * PrinterStatus type used throughout the application.
 */

import type { PrinterStatus } from './types'

/**
 * Transform WebSocket status data to PrinterStatus
 */
export function transformWebSocketToPrinterStatus(wsData: any): PrinterStatus {
  const printStats = wsData.print_stats || {}
  const virtualSdcard = wsData.virtual_sdcard || {}
  const extruder = wsData.extruder || {}
  const heaterBed = wsData.heater_bed || {}
  const toolhead = wsData.toolhead || {}
  const gcodeMove = wsData.gcode_move || {}
  const webhooks = wsData.webhooks || {}
  const displayStatus = wsData.display_status || {}
  
  // Extract filename from path
  const filePath = virtualSdcard.file_path || null
  const filename = filePath ? filePath.split('/').pop() : null
  
  // Map Klipper print state to our state
  let printState: PrinterStatus['print']['state'] = 'offline'
  const klippyState = printStats.state?.toLowerCase() || 'offline'
  
  switch (klippyState) {
    case 'printing':
      printState = 'printing'
      break
    case 'paused':
      printState = 'paused'
      break
    case 'complete':
      printState = 'complete'
      break
    case 'cancelled':
      printState = 'cancelled'
      break
    case 'error':
      printState = 'error'
      break
    case 'standby':
      printState = 'ready'
      break
    default:
      printState = webhooks.state === 'ready' ? 'ready' : 'offline'
  }
  
  // Calculate estimated time left
  let estimatedTimeLeft: number | null = null
  const progress = virtualSdcard.progress || 0
  
  if (printState === 'printing' && progress > 0) {
    const printDuration = printStats.print_duration || 0
    if (printDuration > 0 && progress < 1) {
      // Calculate based on current progress
      const totalEstimatedTime = printDuration / progress
      estimatedTimeLeft = totalEstimatedTime - printDuration
    }
  }
  
  return {
    print: {
      filename,
      state: printState,
      progress: progress,
      currentLayer: printStats.info?.current_layer || null,
      totalLayers: printStats.info?.total_layer || null,
      printTime: printStats.print_duration || 0,
      estimatedTimeLeft,
      slicerEstimatedTime: null, // This would come from file metadata
      filamentUsed: printStats.filament_used || 0,
    },
    temperatures: {
      extruder: {
        actual: Math.round((extruder.temperature || 0) * 10) / 10,
        target: extruder.target || 0,
        power: Math.round((extruder.power || 0) * 100) / 100,
      },
      bed: {
        actual: Math.round((heaterBed.temperature || 0) * 10) / 10,
        target: heaterBed.target || 0,
        power: Math.round((heaterBed.power || 0) * 100) / 100,
      },
    },
    position: {
      x: toolhead.position?.[0] || 0,
      y: toolhead.position?.[1] || 0,
      z: toolhead.position?.[2] || 0,
      e: toolhead.position?.[3] || 0,
    },
    speeds: {
      current: gcodeMove.speed || 0,
      factor: gcodeMove.speed_factor || 1,
    },
    system: {
      klippyState: webhooks.state || 'offline',
      klippyMessage: webhooks.state_message || '',
      homedAxes: toolhead.homed_axes || '',
    },
    file: {
      name: filename,
      size: virtualSdcard.file_size || 0,
      position: virtualSdcard.file_position || 0,
    },
  }
}

/**
 * Extract temperature history data from WebSocket status
 * This provides recent temperature points for charting
 */
export function extractTemperatureHistory(wsData: any, maxPoints = 60) {
  const extruder = wsData.extruder || {}
  const heaterBed = wsData.heater_bed || {}
  
  // For real-time updates, we'd maintain a rolling buffer
  // For now, return current values
  const now = new Date()
  const timestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
  
  return {
    extruder: {
      temperatures: [Math.round((extruder.temperature || 0) * 10) / 10],
      targets: [extruder.target || 0],
      powers: [Math.round((extruder.power || 0) * 100) / 100],
    },
    bed: {
      temperatures: [Math.round((heaterBed.temperature || 0) * 10) / 10],
      targets: [heaterBed.target || 0],
      powers: [Math.round((heaterBed.power || 0) * 100) / 100],
    },
    timestamps: [timestamp],
  }
}
