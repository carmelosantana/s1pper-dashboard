/**
 * AC Infinity Grow Tent Types
 * 
 * Type definitions for grow tent devices and controls
 */

export interface GrowTentDevice {
  deviceId: string
  deviceName: string
  deviceType: string
  macAddress: string
  online: boolean
  temperature: {
    celsius: number
    fahrenheit: number
    trend: string
  }
  humidity: {
    value: number
    trend: string
  }
  vpdLeaf: number
  surplus: number
  ports: GrowTentPort[]
}

export interface GrowTentPort {
  port: number
  name: string
  online: boolean
  mode: number
  speed: number
  trend: number
  automation: boolean
  loadType: number
  loadState: number
  resistance: number
}

export interface GrowTentStatus {
  success: boolean
  data: GrowTentDevice[]
  timestamp: number
}

export interface GrowTentControlRequest {
  deviceId: string
  action: 'setSpeed' | 'setMode' | 'toggleAutomation' | 'updatePort'
  port?: number
  value?: number
  params?: Record<string, any>
}

export interface GrowTentControlResponse {
  success: boolean
  message?: string
  error?: string
  timestamp?: number
}
