import { NextResponse } from 'next/server'
import type { LifetimeStats, MoonrakerTotalsResponse, ApiError } from '@/lib/types'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

// Cache for 30 seconds - lifetime stats don't change frequently
const CACHE_DURATION = 30000
let lastFetch = 0
let cachedData: LifetimeStats | null = null

async function fetchLifetimeStats(): Promise<LifetimeStats> {
  try {
    // Fetch lifetime stats from Moonraker's history totals endpoint
    const url = `${KLIPPER_BASE_URL}/server/history/totals`
    
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: MoonrakerTotalsResponse = await response.json()
    const totals = data.result.job_totals

    const lifetimeStats: LifetimeStats = {
      totalJobs: totals.total_jobs,
      totalTime: totals.total_time, // total time including pauses
      totalPrintTime: totals.total_print_time, // actual printing time
      totalFilamentUsed: totals.total_filament_used, // in mm
      longestJob: totals.longest_job,
      longestPrint: totals.longest_print
    }

    return lifetimeStats

  } catch (error) {
    console.error('Error fetching lifetime stats:', error)
    
    // Return empty stats when printer is not reachable
    const emptyStats: LifetimeStats = {
      totalJobs: 0,
      totalTime: 0,
      totalPrintTime: 0,
      totalFilamentUsed: 0,
      longestJob: 0,
      longestPrint: 0
    }
    
    return emptyStats
  }
}

export async function GET() {
  try {
    // Check if PRINTER_HOST is configured
    if (!KLIPPER_HOST) {
      const emptyStats: LifetimeStats = {
        totalJobs: 0,
        totalTime: 0,
        totalPrintTime: 0,
        totalFilamentUsed: 0,
        longestJob: 0,
        longestPrint: 0
      }
      return NextResponse.json(emptyStats)
    }

    const now = Date.now()
    
    // Use cached data if it's still fresh
    if (cachedData && (now - lastFetch) < CACHE_DURATION) {
      return NextResponse.json(cachedData)
    }
    
    // Fetch fresh data
    const lifetimeStats = await fetchLifetimeStats()
    
    // Update cache
    cachedData = lifetimeStats
    lastFetch = now
    
    return NextResponse.json(lifetimeStats)
    
  } catch (error) {
    console.error('Lifetime stats API route error:', error)
    
    const errorResponse: ApiError = {
      error: 'Failed to fetch lifetime stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}