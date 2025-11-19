import { Suspense } from "react"
import StreamViewClient from "../app/view/stream/stream-view-client"
import { getDashboardSettings } from "@/lib/database"
import { fetchPrinterData } from "@/lib/fetch-printer-data"

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

export default async function StreamPage() {
  const { status, temperatureHistory } = await fetchPrinterData()
  const dashboardSettings = await getDashboardSettings()

  // Extract music settings with fallbacks
  const musicEnabled = dashboardSettings?.streaming_music_enabled ?? false
  const musicVolume = dashboardSettings?.streaming_music_volume ?? 50
  const musicPlaylist = dashboardSettings?.streaming_music_playlist ?? []
  const musicLoop = dashboardSettings?.streaming_music_loop ?? false
  const musicCrossfadeEnabled = dashboardSettings?.streaming_music_crossfade_enabled ?? false
  const musicCrossfadeDuration = dashboardSettings?.streaming_music_crossfade_duration ?? 3.0

  // Extract title/subtitle settings with fallbacks
  const streamingTitleEnabled = dashboardSettings?.streaming_title_enabled ?? true
  const dashboardTitle = dashboardSettings?.dashboard_title ?? "s1pper's Dashboard"
  const dashboardSubtitle = dashboardSettings?.dashboard_subtitle ?? "A dashboard for s1pper, the Ender 3 S1 Pro"

  // Extract camera settings with fallbacks
  const streamCameraDisplayMode = dashboardSettings?.stream_camera_display_mode ?? 'single'

  // Fetch camera data
  let enabledCameras: any[] = []
  try {
    const cameraResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/camera/data`, {
      cache: 'no-store'
    })
    if (cameraResponse.ok) {
      const cameraData = await cameraResponse.json()
      enabledCameras = (cameraData.webcams || []).filter((w: any) => w.database_enabled !== false)
    }
  } catch (error) {
    console.error('Failed to fetch camera data:', error)
  }

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
        streamingTitleEnabled={streamingTitleEnabled}
        dashboardTitle={dashboardTitle}
        dashboardSubtitle={dashboardSubtitle}
        streamCameraDisplayMode={streamCameraDisplayMode}
        enabledCameras={enabledCameras}
      />
    </Suspense>
  )
}
