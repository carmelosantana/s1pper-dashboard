import { Suspense } from "react"
import { notFound } from "next/navigation"
import StreamViewClient from "./stream-view-client"
import VerticalStreamClient from "./vertical-stream-client"
import type { PrinterStatus, TemperatureHistory } from "@/lib/types"

// Server-side function to fetch printer data
async function fetchPrinterData(): Promise<{ status: PrinterStatus | null, temperatureHistory: TemperatureHistory | null }> {
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

// Loading component
function ViewSkeleton() {
  return (
    <div className="dark min-h-screen bg-black text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading stream view...</p>
      </div>
    </div>
  )
}

interface PageProps {
  params: Promise<{ theme: string }>
}

export default async function ViewPage({ params }: PageProps) {
  const { theme } = await params
  
  // Only support 'stream' and 'vertical-stream' themes for now
  if (theme !== 'stream' && theme !== 'vertical-stream') {
    notFound()
  }

  const { status, temperatureHistory } = await fetchPrinterData()

  return (
    <Suspense fallback={<ViewSkeleton />}>
      {theme === 'stream' ? (
        <StreamViewClient 
          initialStatus={status} 
          initialTemperatureHistory={temperatureHistory}
        />
      ) : (
        <VerticalStreamClient 
          initialStatus={status} 
          initialTemperatureHistory={temperatureHistory}
        />
      )}
    </Suspense>
  )
}
