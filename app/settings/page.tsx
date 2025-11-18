"use client"

import { useState, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings as SettingsIcon, Home } from "lucide-react"
import SettingsCard from '@/components/settings-card'

export default function SettingsPage() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (!isDevelopment) {
      // Redirect to home if not in development
      redirect('/')
    } else {
      setIsAuthorized(true)
    }
    
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <SettingsIcon className="h-8 w-8 text-cyan-500" />
              Settings
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Ender 3 S1 Pro</span>
              <span>•</span>
              <a href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </a>
              <span>•</span>
              <a href="/config" className="hover:text-foreground transition-colors">Config</a>
              <span>•</span>
              <span className="text-foreground">Settings</span>
            </div>
          </div>
          <p className="text-muted-foreground">
            Configure your dashboard settings, video feed, and streaming options
          </p>
          <div className="mt-2 px-3 py-1.5 bg-amber-600/10 border border-amber-600/20 rounded-md inline-flex items-center gap-2 text-sm text-amber-500">
            <SettingsIcon className="h-4 w-4" />
            Development Mode Only
          </div>
        </div>

        {/* Settings Card */}
        <SettingsCard />
      </div>
    </div>
  )
}
