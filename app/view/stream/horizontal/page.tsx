import { Suspense } from "react"
import StreamViewClient from "./stream-view-client"
import { getDashboardSettings } from "@/lib/database"
import { fetchPrinterData } from "@/lib/fetch-printer-data"

// Loading component
function ViewSkeleton() {
  return (
    <div className="dark min-h-screen bg-black text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading horizontal stream view...</p>
      </div>
    </div>
  )
}

export default async function HorizontalStreamPage() {
  const { status, temperatureHistory } = await fetchPrinterData()
  const dashboardSettings = await getDashboardSettings()

  // Extract music settings with fallbacks
  const musicEnabled = dashboardSettings?.streaming_music_enabled ?? false
  const musicVolume = dashboardSettings?.streaming_music_volume ?? 50
  const musicPlaylist = dashboardSettings?.streaming_music_playlist ?? []
  const musicLoop = dashboardSettings?.streaming_music_loop ?? false
  const musicCrossfadeEnabled = dashboardSettings?.streaming_music_crossfade_enabled ?? false
  const musicCrossfadeDuration = dashboardSettings?.streaming_music_crossfade_duration ?? 3.0

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <StreamViewClient 
        initialStatus={status} 
        initialTemperatureHistory={temperatureHistory}
        musicEnabled={musicEnabled}
        musicVolume={musicVolume}
        musicPlaylist={musicPlaylist}
        musicLoop={musicLoop}
        musicCrossfadeEnabled={musicCrossfadeEnabled}
        musicCrossfadeDuration={musicCrossfadeDuration}
      />
    </Suspense>
  )
}
