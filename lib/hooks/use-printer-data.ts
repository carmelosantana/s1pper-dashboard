'use client'

/**
 * Comprehensive hook for printer data
 * 
 * Provides transformed printer data from WebSocket with automatic updates
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useWebSocket } from '../contexts/websocket-context'
import { transformWebSocketToPrinterStatus } from '../websocket-transformer'
import type { PrinterStatus } from '../types'

export function usePrinterData() {
  const { printerStatus: wsStatus, isConnected, isReady, error } = useWebSocket()
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null)
  const [temperatureHistory, setTemperatureHistory] = useState<any[]>([])
  const lastUpdateRef = useRef<number>(0)
  const lastTempRef = useRef<{ extruder: number; bed: number }>({ extruder: 0, bed: 0 })
  
  // Transform WebSocket data to PrinterStatus format
  useEffect(() => {
    if (!wsStatus) {
      setPrinterStatus(null)
      return
    }
    
    const transformed = transformWebSocketToPrinterStatus(wsStatus)
    setPrinterStatus(transformed)
    
    // Only update temperature history every 1 second and if temperature changed significantly
    const now = Date.now()
    const extruderTemp = Math.round((wsStatus.extruder?.temperature || 0) * 10) / 10
    const bedTemp = Math.round((wsStatus.heater_bed?.temperature || 0) * 10) / 10
    
    // Check if enough time has passed (1 second) and temperature changed by at least 0.1°C
    const timeDiff = now - lastUpdateRef.current
    const extruderDiff = Math.abs(extruderTemp - lastTempRef.current.extruder)
    const bedDiff = Math.abs(bedTemp - lastTempRef.current.bed)
    
    if (timeDiff < 1000 && extruderDiff < 0.1 && bedDiff < 0.1) {
      return
    }
    
    lastUpdateRef.current = now
    lastTempRef.current = { extruder: extruderTemp, bed: bedTemp }
    
    // Update temperature history (keep last 300 points = 5 minutes at ~1Hz)
    setTemperatureHistory(prev => {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
      
      const newPoint = {
        timestamp,
        extruder: {
          temperature: extruderTemp,
          target: wsStatus.extruder?.target || 0,
          power: Math.round((wsStatus.extruder?.power || 0) * 100) / 100,
        },
        bed: {
          temperature: bedTemp,
          target: wsStatus.heater_bed?.target || 0,
          power: Math.round((wsStatus.heater_bed?.power || 0) * 100) / 100,
        },
      }
      
      const updated = [...prev, newPoint].slice(-300)
      return updated
    })
  }, [wsStatus])
  
  // Format temperature history for charts - memoized to prevent recreation on every render
  const formattedTemperatureHistory = useMemo(() => {
    if (temperatureHistory.length === 0) {
      return {
        extruder: { temperatures: [], targets: [], powers: [] },
        bed: { temperatures: [], targets: [], powers: [] },
        timestamps: [],
      }
    }
    
    return {
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
  }, [temperatureHistory])
  
  return {
    printerStatus,
    temperatureHistory: formattedTemperatureHistory,
    isConnected,
    isReady,
    error,
  }
}
