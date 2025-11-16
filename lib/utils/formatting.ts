/**
 * Formatting utility functions
 * Centralized functions for formatting time, measurements, and other data
 */

/**
 * Format seconds to human-readable time string
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "2h 30m 15s", "45m 20s", "30s")
 */
export function formatTime(seconds: number): string {
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

/**
 * Format filament length from mm to appropriate unit
 * @param mm - Length in millimeters
 * @returns Formatted length string (e.g., "2.50 m" or "500 mm")
 */
export function formatFilamentLength(mm: number): string {
  if (mm > 1000) {
    return `${(mm / 1000).toFixed(2)} m`
  }
  return `${mm.toFixed(0)} mm`
}

/**
 * Format seconds to lifetime time display (days, hours, minutes)
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "2d 5h 30m", "5h 30m", "30m")
 */
export function formatLifetimeTime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 3600))
  const hours = Math.floor((seconds % (24 * 3600)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Format estimated finish time with relative date context
 * @param estimatedTimeLeft - Time remaining in seconds
 * @returns Formatted finish time string (e.g., "3:45 PM" or "Tomorrow, 2:30 PM")
 */
export function formatFinishTime(estimatedTimeLeft: number): string {
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

/**
 * Format file size in bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB", "500 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format percentage to fixed decimal places
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string (e.g., "75%", "75.5%")
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format temperature value
 * @param temp - Temperature value
 * @param unit - Temperature unit (default: '°C')
 * @returns Formatted temperature string (e.g., "210°C")
 */
export function formatTemperature(temp: number, unit: string = '°C'): string {
  return `${Math.round(temp)}${unit}`
}
