'use client'

/**
 * Comprehensive hook for printer data
 * 
 * Provides transformed printer data from WebSocket with automatic updates
 */

import { useState, useEffect } from 'react'
import { useWebSocket } from '../contexts/websocket-context'
import { transformWebSocketToPrinterStatus } from '../websocket-transformer'
import type { PrinterStatus } from '../types'

export function usePrinterData() {
  const { printerStatus: wsStatus, isConnected, isReady, error } = useWebSocket()
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)
  const [temperatureHistory, setTemperatureHistory] = useState<any[]>([])
  
  // Transform WebSocket data to PrinterStatus format
  useEffect(() => {
    if (!wsStatus) {
      setPrinterStatus(null)
      return
    }
    
    const transformed = transformWebSocketToPrinterStatus(wsStatus)
    setPrinterStatus(transformed)
    
    // Update temperature history (keep last 300 points = 5 minutes at ~1Hz)
    setTemperatureHistory(prev => {
      const now = new Date()
      const timestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      const newPoint = {
        timestamp,
        extruder: {
          temperature: Math.round((wsStatus.extruder?.temperature || 0) * 10) / 10,
          target: wsStatus.extruder?.target || 0,
          power: Math.round((wsStatus.extruder?.power || 0) * 100) / 100,
        },
        bed: {
          temperature: Math.round((wsStatus.heater_bed?.temperature || 0) * 10) / 10,
          target: wsStatus.heater_bed?.target || 0,
          power: Math.round((wsStatus.heater_bed?.power || 0) * 100) / 100,
        },
      }
      
      const updated = [...prev, newPoint].slice(-300)
      return updated
    })
  }, [wsStatus])
  
  // Format temperature history for charts
  const formattedTemperatureHistory = {
    extruder: {
      temperatures: temperatureHistory.map(p => p.extruder.temperature),
      targets: temperatureHistory.map(p => p.extruder.target),
      powers: temperatureHistory.map(p => p.extruder.power),
    },
    bed: {
      temperatures: temperatureHistory.map(p => p.bed.temperature),
      targets: temperatureHistory.map(p => p.bed.target),
      powers: temperatureHistory.map(p => p.bed.power),
    },
    timestamps: temperatureHistory.map(p => p.timestamp),
  }
  
  return {
    printerStatus,
    temperatureHistory: formattedTemperatureHistory,
    isConnected,
    isReady,
    error,
  }
}
