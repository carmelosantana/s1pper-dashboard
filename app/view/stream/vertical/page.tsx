import { Suspense } from "react"
import VerticalStreamClient from "./vertical-stream-client"
import { getDashboardSettings } from "@/lib/database"
import { fetchPrinterData } from "@/lib/fetch-printer-data"

// Loading component
function ViewSkeleton() {
  return (
    <div className="dark min-h-screen bg-black text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading vertical stream view...</p>
      </div>
    </div>
  )
}

export default async function VerticalStreamPage() {
  const { status, temperatureHistory } = await fetchPrinterData()
  const dashboardSettings = await getDashboardSettings()

  // Extract music settings with fallbacks
  const musicEnabled = dashboardSettings?.streaming_music_enabled ?? false
  const musicVolume = dashboardSettings?.streaming_music_volume ?? 50
  const musicPlaylist = dashboardSettings?.streaming_music_playlist ?? []
  const musicLoop = dashboardSettings?.streaming_music_loop ?? false

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <VerticalStreamClient 
        initialStatus={status} 
        initialTemperatureHistory={temperatureHistory}
        musicEnabled={musicEnabled}
        musicVolume={musicVolume}
        musicPlaylist={musicPlaylist}
        musicLoop={musicLoop}
      />
    </Suspense>
  )
}
