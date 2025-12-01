/**
 * Formatting utilities for the task manager and other views
 */

/**
 * Format bytes to human readable string (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Format time from seconds to human readable string (Xh Xm Xs)
 */
export function formatTime(seconds: number): string {
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

/**
 * Format filament length in mm to human readable string (mm or m)
 */
export function formatFilament(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`
  }
  return `${mm.toFixed(0)} mm`
}

/**
 * Get color based on power percentage (for thermometer status)
 * Red for high power, yellow for medium, green for low
 */
export function getPowerColor(powerPercent: number): string {
  if (powerPercent >= 80) return '#FF0000' // Red - high power
  if (powerPercent >= 50) return '#FFFF00' // Yellow - medium power
  return '#00FF00' // Green - low power
}

/**
 * Calculate temperature rate of change (°C/s) over a period
 * This shows how fast the temperature is changing per second
 */
export function getTemperatureRateOfChange(
  history: number[],
  secondsAgo: number = 30
): { value: number; formatted: string; color: string } {
  if (history.length < 2) {
    return { value: 0, formatted: '+0.0', color: '#808080' }
  }
  
  const currentTemp = history[history.length - 1]
  // History is updated every 1 second, so index for N seconds ago
  const historicalIndex = Math.max(0, history.length - 1 - secondsAgo)
  const historicalTemp = history[historicalIndex]
  
  // Calculate actual time span (in case we don't have full history yet)
  const actualSeconds = history.length - 1 - historicalIndex
  if (actualSeconds === 0) {
    return { value: 0, formatted: '+0.0', color: '#808080' }
  }
  
  // Rate of change per second
  const ratePerSecond = (currentTemp - historicalTemp) / actualSeconds
  
  // Format with sign and color
  let formatted: string
  let color: string
  
  if (Math.abs(ratePerSecond) < 0.05) {
    // No significant change
    formatted = '+0.0'
    color = '#808080' // Gray
  } else if (ratePerSecond > 0) {
    // Heating up
    formatted = `+${ratePerSecond.toFixed(1)}`
    color = '#FF4444' // Red for heating
  } else {
    // Cooling down
    formatted = `${ratePerSecond.toFixed(1)}`
    color = '#4488FF' // Blue for cooling
  }
  
  return { value: ratePerSecond, formatted, color }
}

/**
 * Truncate filename with ellipsis if too long
 */
export function truncateFilename(filename: string, maxLength: number = 10): string {
  if (filename.length <= maxLength) return filename
  return filename.substring(0, maxLength) + '...'
}

/**
 * Get print state display status text
 */
export function getPrintStateText(printState: string): string {
  switch (printState) {
    case 'printing': return 'Running'
    case 'paused': return 'Paused'
    case 'complete': return 'Completed'
    case 'cancelled': return 'Stopped'
    case 'error': return 'Error'
    default: return 'Idle'
  }
}

/**
 * Get favicon suffix based on print state
 */
export function getFaviconSuffix(printState: string): string {
  switch (printState) {
    case 'printing': return 'printing'
    case 'cancelled': return 'cancelled'
    case 'offline':
    case 'error': return 'offline'
    default: return 'ready'
  }
}

/**
 * Parse grid column span based on video size for charts placement
 */
export function getChartsSizeSpan(size: string): string {
  switch (size) {
    case 'responsive': return '' // Default responsive behavior
    case 'small': return '' // 1 space
    case 'medium': return 'sm:col-span-2' // 2 spaces
    case 'large': return 'sm:col-span-3' // 3 spaces (full row)
    default: return ''
  }
}

/**
 * Parse grid column span based on video size for databox placement
 */
export function getDataboxSizeSpan(size: string): string {
  switch (size) {
    case 'responsive': return '' // Default responsive behavior (1 databox width)
    case 'small': return '' // 1 databox width
    case 'large': return 'col-span-3' // Full row width (3 columns)
    default: return ''
  }
}

/**
 * Get display name for databox type
 */
export function getDataboxDisplayName(type: string): string {
  const names: Record<string, string> = {
    'model-preview': 'Model Preview',
    'print-job': 'Print Job',
    'temperatures': 'Temperatures',
    'console': 'Console',
    'system': 'System',
    'uptime': 'Uptime',
    'lifetime': 'Lifetime',
  }
  return names[type] || type
}
