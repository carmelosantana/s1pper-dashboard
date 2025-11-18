"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

interface SettingsControlProps {
  className?: string
}

export function SettingsControl({ className }: SettingsControlProps) {
  const router = useRouter()

  // Only show in development mode
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment) {
    return null
  }

  const navigateToSettings = () => {
    router.push('/settings')
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Settings Button */}
      <Button
        onClick={navigateToSettings}
        variant="ghost"
        size="sm"
        className="h-7 px-2 flex items-center gap-1.5"
        title="Open Settings"
      >
        <Settings className="h-4 w-4" />
        <span className="text-xs">Settings</span>
      </Button>
    </div>
  )
}