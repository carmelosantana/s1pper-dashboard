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

  // Extract title/subtitle settings with fallbacks
  const streamingTitleEnabled = dashboardSettings?.streaming_title_enabled ?? true
  const dashboardTitle = dashboardSettings?.dashboard_title ?? "s1pper's Dashboard"
  const dashboardSubtitle = dashboardSettings?.dashboard_subtitle ?? "A dashboard for s1pper, the Ender 3 S1 Pro"

  // Extract horizontal-specific camera settings with fallback to global setting
  const streamCameraDisplayMode = dashboardSettings?.horizontal_stream_camera_display_mode ?? 
                                   dashboardSettings?.stream_camera_display_mode ?? 
                                   'single'
  const rotationInterval = dashboardSettings?.rotation_interval ?? 60
  const transitionEffect = dashboardSettings?.transition_effect ?? 'fade'

  // Fetch camera data and per-view settings
  let enabledCameras: any[] = []
  try {
    const [cameraResponse, viewSettingsResponse] = await Promise.all([
      fetch(`http://localhost:${process.env.PORT || 3000}/api/camera/data`, { cache: 'no-store' }),
      fetch(`http://localhost:${process.env.PORT || 3000}/api/view-camera/settings?view=horizontal`, { cache: 'no-store' })
    ])

    if (cameraResponse.ok) {
      const cameraData = await cameraResponse.json()
      const allCameras = (cameraData.webcams || []).filter((w: any) => w.database_enabled !== false)
      
      // Apply per-view camera settings if available
      if (viewSettingsResponse.ok) {
        const viewSettings = await viewSettingsResponse.json()
        const viewCameraMap = new Map(
          viewSettings.settings.map((s: any) => [s.camera_uid, s.enabled])
        )
        
        // Filter cameras based on view-specific settings
        enabledCameras = allCameras.filter((w: any) => {
          const viewEnabled = viewCameraMap.get(w.uid)
          // If not explicitly set for this view, default to globally enabled
          return viewEnabled !== undefined ? viewEnabled : true
        })
      } else {
        // Fallback to global camera settings
        enabledCameras = allCameras
      }
    }
  } catch (error) {
    console.error('Failed to fetch camera data:', error)
  }

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <StreamViewClient 
        initialStatus={status} 
        initialTemperatureHistory={temperatureHistory}
        streamingTitleEnabled={streamingTitleEnabled}
        dashboardTitle={dashboardTitle}
        dashboardSubtitle={dashboardSubtitle}
        streamCameraDisplayMode={streamCameraDisplayMode}
        enabledCameras={enabledCameras}
        rotationInterval={rotationInterval}
        transitionEffect={transitionEffect}
      />
    </Suspense>
  )
}
