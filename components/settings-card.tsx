"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertCircle, Settings as SettingsIcon, Cpu, Layout, Radio, Upload, Trash2, Loader2, CheckCircle2, XCircle, Save, RotateCcw, Volume2, Camera } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { isDevelopment } from '@/lib/utils/environment'
import { toast } from 'sonner'
import { trackEvent } from '@/components/umami-analytics'
import ViewCameraControl from '@/components/view-camera-control'
import { useWebSocket } from '@/lib/contexts/websocket-context'

interface DashboardSettings {
  visibility_mode: 'offline' | 'private' | 'public'
  video_feed_enabled: boolean
  dashboard_title: string
  dashboard_subtitle: string
  dashboard_icon_url: string | null
  config_page_enabled: boolean
  guestbook_enabled: boolean
  streaming_music_file: string | null
  streaming_music_enabled: boolean
  streaming_music_loop: boolean
  streaming_music_volume: number
  streaming_music_playlist: string[]
  streaming_music_crossfade_enabled: boolean
  streaming_music_crossfade_duration: number
  streaming_title_enabled: boolean
  selected_camera_uid: string | null
  stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  horizontal_stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  vertical_stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  stream_pip_main_camera_uid: string | null
  horizontal_pip_main_camera_uid: string | null
  vertical_pip_main_camera_uid: string | null
}

interface WebcamConfig {
  uid: string
  name: string
  enabled: boolean
  database_enabled: boolean
}

interface ViewCameraSettings {
  [cameraUid: string]: boolean // camera_uid -> enabled
}

interface MusicFile {
  name: string
  url: string
}

export default function SettingsCard() {
  const { isConnected } = useWebSocket()
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [originalSettings, setOriginalSettings] = useState<DashboardSettings | null>(null)
  const [musicFiles, setMusicFiles] = useState<MusicFile[]>([])
  const [webcams, setWebcams] = useState<WebcamConfig[]>([])
  const [streamViewCameras, setStreamViewCameras] = useState<ViewCameraSettings>({})
  const [horizontalViewCameras, setHorizontalViewCameras] = useState<ViewCameraSettings>({})
  const [verticalViewCameras, setVerticalViewCameras] = useState<ViewCameraSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [printerStatus, setPrinterStatus] = useState<'online' | 'offline'>('offline')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load settings and music files
  useEffect(() => {
    loadSettings()
    loadMusicFiles()
    loadWebcams()
    checkPrinterStatus()
  }, [])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Check for changes
  useEffect(() => {
    if (!settings || !originalSettings) {
      setHasUnsavedChanges(false)
      return
    }

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasUnsavedChanges(hasChanges)
  }, [settings, originalSettings])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        const settingsWithDefaults = {
          ...data,
          streaming_music_playlist: data.streaming_music_playlist || [],
          streaming_music_crossfade_enabled: data.streaming_music_crossfade_enabled ?? false,
          streaming_music_crossfade_duration: data.streaming_music_crossfade_duration ?? 3.0,
          streaming_title_enabled: data.streaming_title_enabled ?? true,
          stream_camera_display_mode: data.stream_camera_display_mode || 'single',
          horizontal_stream_camera_display_mode: data.horizontal_stream_camera_display_mode || 'single',
          vertical_stream_camera_display_mode: data.vertical_stream_camera_display_mode || 'single',
          stream_pip_main_camera_uid: data.stream_pip_main_camera_uid || null,
          horizontal_pip_main_camera_uid: data.horizontal_pip_main_camera_uid || null,
          vertical_pip_main_camera_uid: data.vertical_pip_main_camera_uid || null
        }
        setSettings(settingsWithDefaults)
        setOriginalSettings(settingsWithDefaults)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const loadMusicFiles = async () => {
    try {
      const response = await fetch('/api/settings/music')
      if (response.ok) {
        const data = await response.json()
        setMusicFiles(data.files || [])
      }
    } catch (error) {
      console.error('Error loading music files:', error)
    }
  }

  const loadWebcams = async () => {
    try {
      const response = await fetch('/api/camera/webcams')
      if (response.ok) {
        const data = await response.json()
        setWebcams(data.webcams || [])
        
        // Load per-view camera settings after webcams are loaded
        await loadViewCameraSettings()
      }
    } catch (error) {
      console.error('Error loading webcams:', error)
    }
  }

  const loadViewCameraSettings = async () => {
    try {
      // Load settings for each view
      const [streamRes, horizontalRes, verticalRes] = await Promise.all([
        fetch('/api/view-camera/settings?view=stream'),
        fetch('/api/view-camera/settings?view=horizontal'),
        fetch('/api/view-camera/settings?view=vertical')
      ])

      if (streamRes.ok) {
        const data = await streamRes.json()
        const cameraMap: ViewCameraSettings = {}
        data.settings.forEach((s: any) => {
          cameraMap[s.camera_uid] = s.enabled
        })
        setStreamViewCameras(cameraMap)
      }

      if (horizontalRes.ok) {
        const data = await horizontalRes.json()
        const cameraMap: ViewCameraSettings = {}
        data.settings.forEach((s: any) => {
          cameraMap[s.camera_uid] = s.enabled
        })
        setHorizontalViewCameras(cameraMap)
      }

      if (verticalRes.ok) {
        const data = await verticalRes.json()
        const cameraMap: ViewCameraSettings = {}
        data.settings.forEach((s: any) => {
          cameraMap[s.camera_uid] = s.enabled
        })
        setVerticalViewCameras(cameraMap)
      }
    } catch (error) {
      console.error('Error loading view camera settings:', error)
    }
  }

  const updateViewCameraEnabled = async (view: 'stream' | 'horizontal' | 'vertical', cameraUid: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/view-camera/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view, camera_uid: cameraUid, enabled })
      })

      if (response.ok) {
        // Update local state
        if (view === 'stream') {
          setStreamViewCameras(prev => ({ ...prev, [cameraUid]: enabled }))
        } else if (view === 'horizontal') {
          setHorizontalViewCameras(prev => ({ ...prev, [cameraUid]: enabled }))
        } else {
          setVerticalViewCameras(prev => ({ ...prev, [cameraUid]: enabled }))
        }
        toast.success(`Camera ${enabled ? 'enabled' : 'disabled'} for ${view} view`)
      } else {
        toast.error('Failed to update camera')
      }
    } catch (error) {
      console.error('Error updating view camera:', error)
      toast.error('Failed to update camera')
    }
  }

  const getViewCameraEnabled = (view: 'stream' | 'horizontal' | 'vertical', cameraUid: string): boolean => {
    const viewMap = view === 'stream' ? streamViewCameras :
                    view === 'horizontal' ? horizontalViewCameras :
                    verticalViewCameras
    
    // If not explicitly set, default to global camera enabled state
    if (viewMap[cameraUid] === undefined) {
      const webcam = webcams.find(w => w.uid === cameraUid)
      return webcam?.database_enabled ?? false
    }
    
    return viewMap[cameraUid]
  }

  const checkPrinterStatus = async () => {
    try {
      const response = await fetch('/api/printer/status')
      if (response.ok) {
        const data = await response.json()
        setPrinterStatus(data.print.state !== 'offline' ? 'online' : 'offline')
      } else {
        setPrinterStatus('offline')
      }
    } catch (error) {
      setPrinterStatus('offline')
    }
  }

  const updateSettings = (updates: Partial<DashboardSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...updates })
  }

  const saveSettings = async () => {
    if (!settings) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        const data = await response.json()
        const settingsWithPlaylist = {
          ...data,
          streaming_music_playlist: data.streaming_music_playlist || []
        }
        setSettings(settingsWithPlaylist)
        setOriginalSettings(settingsWithPlaylist)
        setHasUnsavedChanges(false)
        toast.success('Settings saved successfully')
        
        // Track settings save event
        trackEvent('settings_saved', {
          video_feed_enabled: settings.video_feed_enabled,
          visibility_mode: settings.visibility_mode,
          guestbook_enabled: settings.guestbook_enabled,
          streaming_music_enabled: settings.streaming_music_enabled
        })
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const discardChanges = () => {
    if (originalSettings) {
      setSettings(originalSettings)
      setHasUnsavedChanges(false)
      toast.info('Changes discarded')
    }
  }

  const handlePrinterRestart = async (type: 'firmware' | 'klipper' | 'moonraker') => {
    const endpoint = type === 'firmware' ? '/api/printer/restart' :
                     type === 'klipper' ? '/api/printer/restart-klipper' :
                     '/api/printer/restart-moonraker'
    
    const name = type === 'firmware' ? 'Firmware' :
                 type === 'klipper' ? 'Klipper' :
                 'Moonraker'

    try {
      toast.info(`Restarting ${name}...`)
      const response = await fetch(endpoint, { method: 'POST' })
      
      if (response.ok) {
        toast.success(`${name} restart initiated`)
        setTimeout(() => checkPrinterStatus(), 5000)
      } else {
        const data = await response.json()
        toast.error(data.error || `Failed to restart ${name}`)
      }
    } catch (error) {
      console.error(`Error restarting ${name}:`, error)
      toast.error(`Failed to restart ${name}`)
    }
  }

  const handleCameraToggle = async (uid: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/camera/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, enabled })
      })
      
      if (response.ok) {
        toast.success(`Camera ${enabled ? 'enabled' : 'disabled'}`)
        // Update local state
        setWebcams(prev => prev.map(cam => 
          cam.uid === uid ? { ...cam, database_enabled: enabled } : cam
        ))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update camera')
      }
    } catch (error) {
      console.error('Error updating camera:', error)
      toast.error('Failed to update camera')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const response = await fetch('/api/settings/music', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Music file uploaded successfully')
        loadMusicFiles()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteMusic = async (filename: string) => {
    try {
      const response = await fetch(`/api/settings/music?file=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Music file deleted')
        loadMusicFiles()
        if (settings?.streaming_music_file === filename) {
          updateSettings({ streaming_music_file: null })
        }
        if (settings?.streaming_music_playlist?.includes(filename)) {
          updateSettings({
            streaming_music_playlist: settings.streaming_music_playlist.filter(f => f !== filename)
          })
        }
      } else {
        toast.error('Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file')
    }
  }

  const toggleMusicInPlaylist = (filename: string) => {
    if (!settings) return
    
    const currentPlaylist = settings.streaming_music_playlist || []
    const isInPlaylist = currentPlaylist.includes(filename)
    
    const newPlaylist = isInPlaylist
      ? currentPlaylist.filter(f => f !== filename)
      : [...currentPlaylist, filename]
    
    updateSettings({ streaming_music_playlist: newPlaylist })
  }

  if (loading) {
    return (
      <Card className="bg-zinc-950 border-zinc-800" id="settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card className="bg-zinc-950 border-zinc-800" id="settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Settings are not available. Please configure the database to enable settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-950 border-zinc-800" id="settings-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-cyan-500" />
              Settings
            </CardTitle>
            <CardDescription>
              Manage your printer, dashboard, and streaming settings
            </CardDescription>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Button
                onClick={discardChanges}
                variant="outline"
                size="sm"
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={saveSettings}
                size="sm"
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="printer" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="printer">
              <Cpu className="h-4 w-4 mr-2" />
              Printer
            </TabsTrigger>
            <TabsTrigger value="cameras">
              <Camera className="h-4 w-4 mr-2" />
              Cameras
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <Layout className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="streaming">
              <Radio className="h-4 w-4 mr-2" />
              Streaming
            </TabsTrigger>
          </TabsList>

          {/* Printer Tab */}
          <TabsContent value="printer" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Printer Status</h3>
                <div className="flex items-center gap-2 text-sm">
                  {isConnected && printerStatus === 'online' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-green-500">Online</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-500">Offline</span>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold mb-3">Printer Controls</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Restart Firmware</p>
                      <p className="text-xs text-muted-foreground">Performs a full firmware restart</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={printerStatus === 'offline'}
                        >
                          Restart
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restart Firmware?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will perform a full firmware restart. Your printer will be unavailable for a few moments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handlePrinterRestart('firmware')}>
                            Restart
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Restart Klipper</p>
                      <p className="text-xs text-muted-foreground">Restarts the Klipper service</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={printerStatus === 'offline'}
                        >
                          Restart
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restart Klipper?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restart the Klipper service. Your printer will be unavailable for a few moments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handlePrinterRestart('klipper')}>
                            Restart
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Restart Moonraker</p>
                      <p className="text-xs text-muted-foreground">Restarts the Moonraker API service</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={printerStatus === 'offline'}
                        >
                          Restart
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restart Moonraker?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restart the Moonraker API service. Your printer will be unavailable for a few moments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handlePrinterRestart('moonraker')}>
                            Restart
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Cameras Tab */}
          <TabsContent value="cameras" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Camera Management</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Enable or disable cameras. Disabled cameras will not appear in the camera selector.
                </p>
                {webcams.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No cameras detected</p>
                    <p className="text-xs mt-1">Connect cameras to your printer to see them here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webcams.map((webcam) => (
                      <div 
                        key={webcam.uid}
                        className="flex items-center justify-between p-3 rounded-md border border-zinc-800 bg-zinc-900/50"
                      >
                        <div className="flex items-center gap-3">
                          <Camera className="h-5 w-5 text-cyan-500" />
                          <div>
                            <p className="text-sm font-medium">{webcam.name}</p>
                            <p className="text-xs text-muted-foreground">UID: {webcam.uid}</p>
                          </div>
                        </div>
                        <Switch
                          checked={webcam.database_enabled}
                          onCheckedChange={(enabled) => handleCameraToggle(webcam.uid, enabled)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dashboard-title">Dashboard Title</Label>
                <Input
                  id="dashboard-title"
                  value={settings.dashboard_title || ''}
                  onChange={(e) => updateSettings({ dashboard_title: e.target.value })}
                  placeholder="s1pper's Dashboard"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dashboard-subtitle">Dashboard Subtitle</Label>
                <Input
                  id="dashboard-subtitle"
                  value={settings.dashboard_subtitle || ''}
                  onChange={(e) => updateSettings({ dashboard_subtitle: e.target.value })}
                  placeholder="A dashboard for s1pper, the Ender 3 S1 Pro"
                />
              </div>

              {isDevelopment() && (
                <>
                  <div className="border-t border-zinc-800 pt-4">
                    <h3 className="text-sm font-semibold mb-3">Visibility Settings</h3>
                    <div className="space-y-2">
                      <Label htmlFor="visibility-mode">Visibility Mode</Label>
                      <Select
                        value={settings.visibility_mode}
                        onValueChange={(value) => updateSettings({ visibility_mode: value as 'offline' | 'private' | 'public' })}
                      >
                        <SelectTrigger id="visibility-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offline">Offline - Dashboard shows offline message</SelectItem>
                          <SelectItem value="private">Private - Redact filenames and disable video</SelectItem>
                          <SelectItem value="public">Public - Show all information</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Controls what information is displayed on the dashboard
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="video-feed">Video Feed</Label>
                        <p className="text-xs text-muted-foreground">Enable/disable camera video feed</p>
                      </div>
                      <Switch
                        id="video-feed"
                        checked={settings.video_feed_enabled}
                        onCheckedChange={(checked) => updateSettings({ video_feed_enabled: checked })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold mb-3">Page Features</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="config-page">Configuration Page</Label>
                      <p className="text-xs text-muted-foreground">Show/hide the /config page</p>
                    </div>
                    <Switch
                      id="config-page"
                      checked={settings.config_page_enabled}
                      onCheckedChange={(checked) => updateSettings({ config_page_enabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="guestbook">Guestbook</Label>
                      <p className="text-xs text-muted-foreground">Enable/disable guestbook display and API</p>
                    </div>
                    <Switch
                      id="guestbook"
                      checked={settings.guestbook_enabled}
                      onCheckedChange={(checked) => updateSettings({ guestbook_enabled: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Streaming Tab */}
          <TabsContent value="streaming" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Stream Display Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="stream-title-enabled">
                        {settings.streaming_title_enabled ? 'Hide Stream Title' : 'Show Stream Title'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {settings.streaming_title_enabled 
                          ? 'Title and subtitle are visible on stream views' 
                          : 'Title and subtitle are hidden on stream views'}
                      </p>
                    </div>
                    <Switch
                      id="stream-title-enabled"
                      checked={settings.streaming_title_enabled}
                      onCheckedChange={(checked) => updateSettings({ streaming_title_enabled: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold mb-3">Music Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="music-enabled">Enable Music</Label>
                      <p className="text-xs text-muted-foreground">Play music during streams</p>
                    </div>
                    <Switch
                      id="music-enabled"
                      checked={settings.streaming_music_enabled}
                      onCheckedChange={(checked) => updateSettings({ streaming_music_enabled: checked })}
                    />
                  </div>

                  {settings.streaming_music_enabled && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="music-loop">Loop Music</Label>
                          <p className="text-xs text-muted-foreground">Play music continuously</p>
                        </div>
                        <Switch
                          id="music-loop"
                          checked={settings.streaming_music_loop}
                          onCheckedChange={(checked) => updateSettings({ streaming_music_loop: checked })}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="music-volume" className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            Volume
                          </Label>
                          <span className="text-sm text-muted-foreground">{settings.streaming_music_volume}%</span>
                        </div>
                        <Slider
                          id="music-volume"
                          min={0}
                          max={100}
                          step={1}
                          value={[settings.streaming_music_volume]}
                          onValueChange={(value: number[]) => updateSettings({ streaming_music_volume: value[0] })}
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="crossfade-enabled">Enable Crossfade</Label>
                          <p className="text-xs text-muted-foreground">Smooth transitions between songs</p>
                        </div>
                        <Switch
                          id="crossfade-enabled"
                          checked={settings.streaming_music_crossfade_enabled}
                          onCheckedChange={(checked) => updateSettings({ streaming_music_crossfade_enabled: checked })}
                        />
                      </div>

                      {settings.streaming_music_crossfade_enabled && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="crossfade-duration">
                              Crossfade Duration
                            </Label>
                            <span className="text-sm text-muted-foreground">{Number(settings.streaming_music_crossfade_duration).toFixed(1)}s</span>
                          </div>
                          <Slider
                            id="crossfade-duration"
                            min={0}
                            max={10}
                            step={0.1}
                            value={[Number(settings.streaming_music_crossfade_duration)]}
                            onValueChange={(value: number[]) => updateSettings({ streaming_music_crossfade_duration: value[0] })}
                            className="w-full"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold mb-3">Upload Music</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      variant="outline"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: MP3, WAV, OGG, AAC, FLAC, M4A (max 50MB)
                  </p>
                </div>
              </div>

              {musicFiles.length > 0 && (
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-sm font-semibold mb-3">Stream Playlist</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select which songs to play in stream views
                  </p>
                  <div className="space-y-2">
                    {musicFiles.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-2 rounded bg-zinc-900 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={settings.streaming_music_playlist?.includes(file.name)}
                            onCheckedChange={() => toggleMusicInPlaylist(file.name)}
                          />
                          <span className="text-sm truncate flex-1">{file.name}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Music File?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{file.name}&quot;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMusic(file.name)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Management Section */}
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Camera Management
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Control which cameras are displayed in each stream view independently
                </p>
                
                {webcams.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 bg-zinc-900 rounded-lg">
                    No cameras detected. Please check your Moonraker configuration.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Global Camera Enable/Disable */}
                    <div className="space-y-2 p-4 border border-zinc-800 rounded-lg bg-zinc-950">
                      <Label>Global Camera Availability</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Enable/disable cameras globally. Disabled cameras won't appear in any view.
                      </p>
                      <div className="space-y-2">
                        {webcams.map((webcam) => (
                          <div
                            key={webcam.uid}
                            className="flex items-center justify-between p-3 rounded bg-zinc-900 hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <Camera className="h-4 w-4 text-cyan-500" />
                              <span className="text-sm">{webcam.name}</span>
                            </div>
                            <Switch
                              checked={webcam.database_enabled}
                              onCheckedChange={async (checked) => {
                                try {
                                  const response = await fetch('/api/camera/settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ uid: webcam.uid, enabled: checked })
                                  })
                                  if (response.ok) {
                                    await loadWebcams()
                                    toast.success(`${webcam.name} ${checked ? 'enabled' : 'disabled'} globally`)
                                  } else {
                                    toast.error('Failed to update camera')
                                  }
                                } catch (error) {
                                  toast.error('Failed to update camera')
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-View Camera Settings */}
                    {webcams.filter(w => w.database_enabled).length > 0 && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Per-View Settings</h4>
                          <p className="text-xs text-muted-foreground">
                            Configure display mode and cameras for each stream view independently
                          </p>
                        </div>

                        {/* Stream View (default /view/stream) */}
                        <ViewCameraControl
                          view="stream"
                          viewLabel="Default Stream View"
                          viewPath="/view/stream"
                          displayMode={settings.stream_camera_display_mode}
                          pipMainCameraUid={settings.stream_pip_main_camera_uid}
                          webcams={webcams}
                          onDisplayModeChange={(mode) => updateSettings({ stream_camera_display_mode: mode })}
                          onPipMainCameraChange={(uid) => updateSettings({ stream_pip_main_camera_uid: uid })}
                          getViewCameraEnabled={(uid) => getViewCameraEnabled('stream', uid)}
                          onViewCameraEnabledChange={(uid, enabled) => updateViewCameraEnabled('stream', uid, enabled)}
                        />

                        {/* Horizontal Stream View */}
                        <ViewCameraControl
                          view="horizontal"
                          viewLabel="Horizontal Stream View"
                          viewPath="/view/stream/horizontal"
                          displayMode={settings.horizontal_stream_camera_display_mode}
                          pipMainCameraUid={settings.horizontal_pip_main_camera_uid}
                          webcams={webcams}
                          onDisplayModeChange={(mode) => updateSettings({ horizontal_stream_camera_display_mode: mode })}
                          onPipMainCameraChange={(uid) => updateSettings({ horizontal_pip_main_camera_uid: uid })}
                          getViewCameraEnabled={(uid) => getViewCameraEnabled('horizontal', uid)}
                          onViewCameraEnabledChange={(uid, enabled) => updateViewCameraEnabled('horizontal', uid, enabled)}
                        />

                        {/* Vertical Stream View */}
                        <ViewCameraControl
                          view="vertical"
                          viewLabel="Vertical Stream View"
                          viewPath="/view/stream/vertical"
                          displayMode={settings.vertical_stream_camera_display_mode}
                          pipMainCameraUid={settings.vertical_pip_main_camera_uid}
                          webcams={webcams}
                          onDisplayModeChange={(mode) => updateSettings({ vertical_stream_camera_display_mode: mode })}
                          onPipMainCameraChange={(uid) => updateSettings({ vertical_pip_main_camera_uid: uid })}
                          getViewCameraEnabled={(uid) => getViewCameraEnabled('vertical', uid)}
                          onViewCameraEnabledChange={(uid, enabled) => updateViewCameraEnabled('vertical', uid, enabled)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
