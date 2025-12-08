import { NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'
const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

// Cache for rate limiting
const CACHE_DURATION = 1000 // 1 second
let lastFetch = 0
let cachedData: SystemStats | null = null

export interface SystemStats {
  moonraker: {
    time: number
    cpuUsage: number
    memory: number
    memUnits: string
  }
  system: {
    cpuUsage: {
      total: number
      cores: number[]
    }
    memory: {
      total: number
      available: number
      used: number
    }
    cpuTemp: number | null
    uptime: number
  }
  network: {
    [interface_name: string]: {
      rxBytes: number
      txBytes: number
      bandwidth: number
    }
  }
  websocketConnections: number
  throttledState: {
    bits: number
    flags: string[]
  }
}

export interface SystemInfo {
  cpuInfo: {
    cpuCount: number
    bits: string
    processor: string
    cpuDesc: string
    model: string
    totalMemory: number
    memoryUnits: string
  }
  distribution: {
    name: string
    id: string
    version: string
  }
  services: {
    [name: string]: {
      activeState: string
      subState: string
    }
  }
}

async function fetchSystemStats(): Promise<{ stats: SystemStats; info: SystemInfo } | null> {
  if (!KLIPPER_BASE_URL) {
    return null
  }

  try {
    const [statsResponse, infoResponse] = await Promise.all([
      fetch(`${KLIPPER_BASE_URL}/machine/proc_stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      }),
      fetch(`${KLIPPER_BASE_URL}/machine/system_info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      })
    ])

    if (!statsResponse.ok || !infoResponse.ok) {
      console.error('Failed to fetch system data:', statsResponse.status, infoResponse.status)
      return null
    }

    const statsData = await statsResponse.json()
    const infoData = await infoResponse.json()

    const procStats = statsData.result
    const systemInfo = infoData.result.system_info

    // Get the most recent moonraker stats entry
    const moonrakerStats = Array.isArray(procStats.moonraker_stats)
      ? procStats.moonraker_stats[procStats.moonraker_stats.length - 1]
      : procStats.moonraker_stats

    // Calculate Moonraker uptime from the stats array
    // The 'time' field is a Unix timestamp, not uptime
    // We calculate uptime as the difference between the latest and earliest timestamps
    // Note: moonraker_stats only keeps recent samples, so this gives us process running time
    let moonrakerUptime = 0
    if (Array.isArray(procStats.moonraker_stats) && procStats.moonraker_stats.length > 0) {
      const latestTime = procStats.moonraker_stats[procStats.moonraker_stats.length - 1]?.time || 0
      const earliestTime = procStats.moonraker_stats[0]?.time || latestTime
      // The stats array typically spans about 10 seconds of samples
      // For actual Moonraker uptime, we use system_uptime as a proxy since Moonraker
      // starts with the system in most setups, or we could track start time separately
      // For now, use the time since the earliest sample as a minimum running indicator
      moonrakerUptime = latestTime - earliestTime
      
      // If the stats array only gives us a few seconds, fall back to system uptime
      // as Moonraker typically runs since system boot
      if (moonrakerUptime < 60) {
        moonrakerUptime = procStats.system_uptime || 0
      }
    }

    // Transform system CPU usage
    const systemCpuUsage = procStats.system_cpu_usage || {}
    const totalCpuUsage = systemCpuUsage.cpu || 0
    const cores: number[] = []
    
    // Extract per-core CPU usage
    Object.keys(systemCpuUsage).forEach(key => {
      if (key.startsWith('cpu') && key !== 'cpu') {
        const coreIndex = parseInt(key.replace('cpu', ''))
        if (!isNaN(coreIndex)) {
          cores[coreIndex] = systemCpuUsage[key]
        }
      }
    })

    // Transform network data
    const networkData: SystemStats['network'] = {}
    if (procStats.network) {
      Object.entries(procStats.network).forEach(([iface, data]: [string, any]) => {
        networkData[iface] = {
          rxBytes: data.rx_bytes,
          txBytes: data.tx_bytes,
          bandwidth: data.bandwidth
        }
      })
    }

    // Calculate memory usage
    const memoryInfo = systemInfo?.cpu_info
    const totalMemoryKb = memoryInfo?.total_memory || 0
    
    // Memory calculation from Moonraker stats if available
    const memUsed = moonrakerStats?.memory || 0
    
    const stats: SystemStats = {
      moonraker: {
        time: moonrakerUptime,
        cpuUsage: moonrakerStats?.cpu_usage || 0,
        memory: memUsed,
        memUnits: moonrakerStats?.mem_units || 'kB'
      },
      system: {
        cpuUsage: {
          total: totalCpuUsage,
          cores: cores
        },
        memory: {
          total: totalMemoryKb,
          available: procStats.system_memory?.available || 0,
          used: procStats.system_memory?.used || 0
        },
        cpuTemp: procStats.cpu_temp || null,
        uptime: procStats.system_uptime || 0
      },
      network: networkData,
      websocketConnections: procStats.websocket_connections || 0,
      throttledState: {
        bits: procStats.throttled_state?.bits || 0,
        flags: procStats.throttled_state?.flags || []
      }
    }

    // Transform service states
    const services: SystemInfo['services'] = {}
    if (systemInfo?.service_state) {
      Object.entries(systemInfo.service_state).forEach(([name, data]: [string, any]) => {
        services[name] = {
          activeState: data.active_state,
          subState: data.sub_state
        }
      })
    }

    const info: SystemInfo = {
      cpuInfo: {
        cpuCount: systemInfo?.cpu_info?.cpu_count || 0,
        bits: systemInfo?.cpu_info?.bits || '',
        processor: systemInfo?.cpu_info?.processor || '',
        cpuDesc: systemInfo?.cpu_info?.cpu_desc || '',
        model: systemInfo?.cpu_info?.model || '',
        totalMemory: totalMemoryKb,
        memoryUnits: systemInfo?.cpu_info?.memory_units || 'kB'
      },
      distribution: {
        name: systemInfo?.distribution?.name || '',
        id: systemInfo?.distribution?.id || '',
        version: systemInfo?.distribution?.version || ''
      },
      services
    }

    return { stats, info }
  } catch (error) {
    console.error('Error fetching system stats:', error)
    return null
  }
}

export async function GET() {
  const now = Date.now()
  
  // Return cached data if still fresh
  if (cachedData && now - lastFetch < CACHE_DURATION) {
    return NextResponse.json(cachedData)
  }

  const data = await fetchSystemStats()
  
  if (!data) {
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 503 }
    )
  }

  // Update cache
  lastFetch = now
  cachedData = data as any

  return NextResponse.json(data)
}
