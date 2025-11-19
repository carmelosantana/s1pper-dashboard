import { NextResponse } from 'next/server'
import type { TemperatureHistory, KlipperTemperatureStore, ApiError } from '@/lib/types'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null
const CACHE_DURATION = 5000
let lastFetch = 0
let cachedData: TemperatureHistory | null = null

async function fetchTemperatureHistory(): Promise<TemperatureHistory> {
  try {
    const response = await fetch(`${KLIPPER_BASE_URL}/server/temperature_store`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: KlipperTemperatureStore = await response.json()
    
    // The API returns arrays of temperature data points
    const extruderData = data.result.extruder || { temperatures: [], targets: [], powers: [] }
    const bedData = data.result.heater_bed || { temperatures: [], targets: [], powers: [] }
    
    // Generate timestamps for the chart (assuming data points are collected every 1 second)
    // We'll take the last 300 points (5 minutes) to keep the chart manageable
    const maxPoints = 300
    const extruderCount = extruderData.temperatures.length
    const bedCount = bedData.temperatures.length
    const dataCount = Math.min(Math.max(extruderCount, bedCount), maxPoints)
    
    // Generate timestamps for the last N data points
    const now = new Date()
    const timestamps: string[] = []
    
    for (let i = dataCount - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * 1000))
      timestamps.push(`${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`)
    }
    
    // Get the last N data points
    const startIndex = Math.max(0, extruderCount - dataCount)
    const bedStartIndex = Math.max(0, bedCount - dataCount)
    
    const temperatureHistory: TemperatureHistory = {
      extruder: {
        temperatures: extruderData.temperatures.slice(startIndex).map(temp => Math.round(temp * 10) / 10),
        targets: extruderData.targets.slice(startIndex),
        powers: extruderData.powers.slice(startIndex).map(power => Math.round(power * 100) / 100)
      },
      bed: {
        temperatures: bedData.temperatures.slice(bedStartIndex).map(temp => Math.round(temp * 10) / 10),
        targets: bedData.targets.slice(bedStartIndex),
        powers: bedData.powers.slice(bedStartIndex).map(power => Math.round(power * 100) / 100)
      },
      timestamps: timestamps
    }
    
    return temperatureHistory

  } catch (error) {
    console.error('Error fetching temperature history:', error)
    
    // Return empty history when printer is not reachable
    const emptyHistory: TemperatureHistory = {
      extruder: {
        temperatures: [],
        targets: [],
        powers: []
      },
      bed: {
        temperatures: [],
        targets: [],
        powers: []
      },
      timestamps: []
    }
    
    return emptyHistory
  }
}

export async function GET() {
  try {
    // Check if PRINTER_HOST is configured
    if (!KLIPPER_HOST) {
      const emptyHistory: TemperatureHistory = {
        timestamps: [],
        extruder: { temperatures: [], targets: [], powers: [] },
        bed: { temperatures: [], targets: [], powers: [] }
      }
      return NextResponse.json(emptyHistory)
    }

    const now = Date.now()
    
    // Use cached data if it's still fresh
    if (cachedData && (now - lastFetch) < CACHE_DURATION) {
      return NextResponse.json(cachedData)
    }
    
    // Fetch fresh data
    const temperatureHistory = await fetchTemperatureHistory()
    
    // Update cache
    cachedData = temperatureHistory
    lastFetch = now
    
    return NextResponse.json(temperatureHistory)
    
  } catch (error) {
    console.error('API route error:', error)
    
    const errorResponse: ApiError = {
      error: 'Failed to fetch temperature history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}