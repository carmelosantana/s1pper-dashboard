import { Suspense } from "react"
import type { Metadata } from "next"
import TaskManagerClient from "./taskmanager-client"
import { getDashboardSettings } from "@/lib/database"
import { fetchPrinterData } from "@/lib/fetch-printer-data"
import { getBaseUrl } from "@/lib/utils/environment"
import type { SystemStats, SystemInfo } from "@/app/api/printer/system-stats/route"

// Page metadata
export const metadata: Metadata = {
  title: "s1pper3d Print Manager",
  description: "Windows XP-style Task Manager view for 3D printer monitoring"
}

// Loading component with XP styling
function ViewSkeleton() {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-2"
      style={{
        backgroundImage: 'url(/background/windows-xp-01.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="bg-[#ECE9D8] rounded-lg shadow-xl p-8 border border-[#0054E3]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-[#0054E3] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#000000] font-['Tahoma'] text-sm">Loading s1pper3d Task Manager...</p>
        </div>
      </div>
    </div>
  )
}

async function fetchSystemStats(): Promise<{ stats: SystemStats | null; info: SystemInfo | null }> {
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/printer/system-stats`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    })

    if (!response.ok) {
      return { stats: null, info: null }
    }

    const data = await response.json()
    return { stats: data.stats, info: data.info }
  } catch (error) {
    console.error('Error fetching system stats:', error)
    return { stats: null, info: null }
  }
}

export default async function TaskManagerPage() {
  const [printerData, systemData, dashboardSettings] = await Promise.all([
    fetchPrinterData(),
    fetchSystemStats(),
    getDashboardSettings()
  ])

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <TaskManagerClient
        initialStatus={printerData.status}
        initialSystemStats={systemData.stats}
        initialSystemInfo={systemData.info}
      />
    </Suspense>
  )
}
