import type { PrinterStatus, TemperatureHistory } from "@/lib/types"

/**
 * Server-side function to fetch printer data (status and temperature history)
 * Used by stream view pages to get initial data
 */
export async function fetchPrinterData(): Promise<{ 
  status: PrinterStatus | null
  temperatureHistory: TemperatureHistory | null 
}> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL || 'localhost:3000'}` 
      : 'http://localhost:3000')
    
    const [statusResponse, tempResponse] = await Promise.all([
      fetch(`${baseUrl}/api/printer/status`, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      }),
      fetch(`${baseUrl}/api/printer/temperature-history`, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      })
    ])

    const status = statusResponse.ok ? await statusResponse.json() : null
    const temperatureHistory = tempResponse.ok ? await tempResponse.json() : null

    return { status, temperatureHistory }
  } catch (error) {
    console.error('Error fetching printer data:', error)
    return { status: null, temperatureHistory: null }
  }
}
