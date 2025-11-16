"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Settings, Monitor } from 'lucide-react'
import { trackEvent } from '@/components/umami-analytics'

interface DashboardSettings {
  visibility_mode: 'offline' | 'private' | 'public'
  video_feed_enabled: boolean
  updated_at: string
}

interface SettingsControlProps {
  className?: string
}

export function SettingsControl({ className }: SettingsControlProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentView, setCurrentView] = useState<string>('default')

  // Only show in development mode
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment) {
    return null
  }

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToSettings = () => {
    const settingsCard = document.getElementById('settings-card')
    if (settingsCard) {
      settingsCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
      trackEvent('settings_scroll', { source: 'header_gear_icon' })
    }
  }

  const updateSettings = async (updates: Partial<DashboardSettings>) => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
        
        // Track the setting change
        trackEvent('settings_changed', {
          visibility_mode: updatedSettings.visibility_mode,
          video_feed_enabled: updatedSettings.video_feed_enabled
        })
        
        // Reload the page after a short delay to apply changes
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        console.error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleVisibilityChange = (visibility_mode: 'offline' | 'private' | 'public') => {
    // When switching to private mode, automatically disable video feed
    if (visibility_mode === 'private') {
      updateSettings({ visibility_mode, video_feed_enabled: false })
    } else {
      updateSettings({ visibility_mode })
    }
  }

  const handleVideoFeedToggle = (video_feed_enabled: boolean) => {
    updateSettings({ video_feed_enabled })
  }

  const handleViewChange = (view: string) => {
    setCurrentView(view)
    trackEvent('view_changed', { view })
    
    if (view === 'default') {
      router.push('/')
    } else {
      router.push(`/view/${view}`)
    }
  }

  if (loading || !settings) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Settings className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Settings Scroll Button */}
      <Button
        onClick={scrollToSettings}
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        title="Scroll to Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {/* View Selector */}
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentView}
          onValueChange={handleViewChange}
        >
          <SelectTrigger className="w-36 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="stream/horizontal">Horizontal Stream</SelectItem>
            <SelectItem value="stream/vertical">Vertical Stream</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Visibility Mode Selector */}
      <div className="flex items-center gap-2">
        <Select
          value={settings.visibility_mode}
          onValueChange={handleVisibilityChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Video Feed Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="video-feed-toggle"
          checked={settings.video_feed_enabled}
          onCheckedChange={handleVideoFeedToggle}
          disabled={isUpdating || settings.visibility_mode === 'private'}
          className="scale-75"
        />
        <Label 
          htmlFor="video-feed-toggle" 
          className={`text-xs cursor-pointer ${
            settings.visibility_mode === 'private' 
              ? 'text-muted-foreground/50' 
              : 'text-muted-foreground'
          }`}
        >
          {settings.visibility_mode === 'private' 
            ? 'Video Disabled' 
            : settings.video_feed_enabled 
              ? 'Video On' 
              : 'Video Off'
          }
        </Label>
      </div>

      {/* Update indicator */}
      {isUpdating && (
        <div className="text-xs text-muted-foreground">
          Updating...
        </div>
      )}
    </div>
  )
}