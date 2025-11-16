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
import { AlertCircle, Settings as SettingsIcon, Cpu, Layout, Radio, Upload, Trash2, Loader2, CheckCircle2, XCircle, Save, RotateCcw, Volume2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { isDevelopment } from '@/lib/utils/environment'
import { toast } from 'sonner'

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
}

interface MusicFile {
  name: string
  url: string
}

export default function SettingsCard() {
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [originalSettings, setOriginalSettings] = useState<DashboardSettings | null>(null)
  const [musicFiles, setMusicFiles] = useState<MusicFile[]>([])
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
        const settingsWithPlaylist = {
          ...data,
          streaming_music_playlist: data.streaming_music_playlist || []
        }
        setSettings(settingsWithPlaylist)
        setOriginalSettings(settingsWithPlaylist)
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="printer">
              <Cpu className="h-4 w-4 mr-2" />
              Printer
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
                  {printerStatus === 'online' ? (
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
