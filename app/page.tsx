import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"
import PrinterDashboardClient from "./printer-dashboard-client"
import type { PrinterStatus, TemperatureHistory, LifetimeStats } from "@/lib/types"
import { isDatabaseConfigured, getDashboardSettings } from "@/lib/database"
import { getBaseUrl } from "@/lib/utils/environment"

// Server-side function to fetch printer data
async function fetchPrinterData(): Promise<{ status: PrinterStatus | null, temperatureHistory: TemperatureHistory | null, lifetimeStats: LifetimeStats | null }> {
  try {
    const baseUrl = getBaseUrl()
    
    const [statusResponse, tempResponse, lifetimeResponse] = await Promise.all([
      fetch(`${baseUrl}/api/printer/status`, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      }),
      fetch(`${baseUrl}/api/printer/temperature-history`, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      }),
      fetch(`${baseUrl}/api/printer/lifetime-stats`, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      })
    ])

    const status = statusResponse.ok ? await statusResponse.json() : null
    const temperatureHistory = tempResponse.ok ? await tempResponse.json() : null
    const lifetimeStats = lifetimeResponse.ok ? await lifetimeResponse.json() : null

    return { status, temperatureHistory, lifetimeStats }
  } catch (error) {
    console.error('Error fetching printer data:', error)
    return { status: null, temperatureHistory: null, lifetimeStats: null }
  }
}

// Loading component
function DashboardSkeleton() {
  return (
    <div className="dark min-h-screen bg-black text-foreground p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          {/* <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-cyan-500" />
            <h1 className="text-2xl md:text-3xl font-bold">3D Printer Monitor</h1>
          </div> */}
          <div className="w-20 h-8 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-zinc-950 border-zinc-800">
                <CardHeader>
                  <div className="w-32 h-6 bg-zinc-800 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="w-full h-4 bg-zinc-800 rounded animate-pulse" />
                    <div className="w-3/4 h-4 bg-zinc-800 rounded animate-pulse" />
                    <div className="w-1/2 h-4 bg-zinc-800 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2].map(i => (
              <Card key={i} className="bg-zinc-950 border-zinc-800">
                <CardHeader>
                  <div className="w-32 h-6 bg-zinc-800 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="w-full h-4 bg-zinc-800 rounded animate-pulse" />
                    <div className="w-full h-40 bg-zinc-800 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function PrinterDashboard() {
  const { status, temperatureHistory, lifetimeStats } = await fetchPrinterData()
  const dbConfigured = isDatabaseConfigured()
  
  // Fetch dashboard settings
  let dashboardTitle = "s1pper's Dashboard"
  let dashboardSubtitle = "A dashboard for s1pper, the Ender 3 S1 Pro"
  
  if (dbConfigured) {
    try {
      const settings = await getDashboardSettings()
      if (settings) {
        dashboardTitle = settings.dashboard_title
        dashboardSubtitle = settings.dashboard_subtitle
      }
    } catch (error) {
      console.error('Error fetching dashboard settings:', error)
    }
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PrinterDashboardClient 
        initialStatus={status} 
        initialTemperatureHistory={temperatureHistory}
        initialLifetimeStats={lifetimeStats}
        isDatabaseConfigured={dbConfigured}
        dashboardTitle={dashboardTitle}
        dashboardSubtitle={dashboardSubtitle}
      />
    </Suspense>
  )
}
