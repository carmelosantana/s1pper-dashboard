"use client"

import { Camera } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface WebcamConfig {
  uid: string
  name: string
  enabled: boolean
  database_enabled: boolean
}

interface ViewCameraControlProps {
  view: 'stream' | 'horizontal' | 'vertical'
  viewLabel: string
  viewPath: string
  displayMode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  pipMainCameraUid: string | null
  webcams: WebcamConfig[]
  onDisplayModeChange: (mode: 'single' | 'grid' | 'pip' | 'offline_video_swap') => void
  onPipMainCameraChange: (cameraUid: string | null) => void
  getViewCameraEnabled: (cameraUid: string) => boolean
  onViewCameraEnabledChange: (cameraUid: string, enabled: boolean) => Promise<void>
}

export default function ViewCameraControl({
  view,
  viewLabel,
  viewPath,
  displayMode,
  pipMainCameraUid,
  webcams,
  onDisplayModeChange,
  onPipMainCameraChange,
  getViewCameraEnabled,
  onViewCameraEnabledChange
}: ViewCameraControlProps) {
  // Filter webcams to show only those enabled globally
  const availableWebcams = webcams.filter(w => w.database_enabled)
  const enabledViewCameras = availableWebcams.filter(w => getViewCameraEnabled(w.uid))

  return (
    <div className="space-y-4 p-4 border border-zinc-800 rounded-lg bg-zinc-950">
      {/* View Header */}
      <div>
        <h4 className="font-semibold text-cyan-500 mb-1">{viewLabel}</h4>
        <p className="text-xs text-muted-foreground">
          Configure cameras for {viewPath}
        </p>
      </div>

      {/* Display Mode Selector */}
      <div className="space-y-2">
        <Label htmlFor={`${view}-display-mode`}>Display Mode</Label>
        <Select
          value={displayMode}
          onValueChange={(value: 'single' | 'grid' | 'pip' | 'offline_video_swap') => onDisplayModeChange(value)}
        >
          <SelectTrigger id={`${view}-display-mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">
              <div className="flex flex-col items-start">
                <span className="font-medium">Single View</span>
                <span className="text-xs text-muted-foreground">
                  Show one camera at a time with switcher
                </span>
              </div>
            </SelectItem>
            <SelectItem value="grid">
              <div className="flex flex-col items-start">
                <span className="font-medium">Grid View</span>
                <span className="text-xs text-muted-foreground">
                  Display all cameras in a grid layout
                </span>
              </div>
            </SelectItem>
            <SelectItem value="pip">
              <div className="flex flex-col items-start">
                <span className="font-medium">Picture-in-Picture</span>
                <span className="text-xs text-muted-foreground">
                  Main camera with smaller thumbnails
                </span>
              </div>
            </SelectItem>
            <SelectItem value="offline_video_swap">
              <div className="flex flex-col items-start">
                <span className="font-medium">Offline Video Swap</span>
                <span className="text-xs text-muted-foreground">
                  Auto-switch to next camera when feed goes offline
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Camera Enable/Disable per View */}
      {availableWebcams.length > 0 && (
        <div className="space-y-2">
          <Label>Cameras for this view</Label>
          <div className="space-y-2">
            {availableWebcams.map((webcam) => (
              <div
                key={webcam.uid}
                className="flex items-center justify-between p-2 rounded bg-zinc-900 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Camera className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="text-sm">{webcam.name}</span>
                </div>
                <Switch
                  checked={getViewCameraEnabled(webcam.uid)}
                  onCheckedChange={async (checked) => {
                    await onViewCameraEnabledChange(webcam.uid, checked)
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {enabledViewCameras.length} of {availableWebcams.length} cameras enabled for this view
          </p>
        </div>
      )}

      {/* PIP Main Camera Selector */}
      {displayMode === 'pip' && enabledViewCameras.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <Label htmlFor={`${view}-pip-main`}>Main Camera (PIP)</Label>
          <Select
            value={pipMainCameraUid || 'auto'}
            onValueChange={(value) => onPipMainCameraChange(value === 'auto' ? null : value)}
          >
            <SelectTrigger id={`${view}-pip-main`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Auto (First Camera)</span>
                  <span className="text-xs text-muted-foreground">
                    Use first enabled camera
                  </span>
                </div>
              </SelectItem>
              {enabledViewCameras.map((webcam) => (
                <SelectItem key={webcam.uid} value={webcam.uid}>
                  {webcam.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select which camera appears as the main view in picture-in-picture mode
          </p>
        </div>
      )}
    </div>
  )
}
