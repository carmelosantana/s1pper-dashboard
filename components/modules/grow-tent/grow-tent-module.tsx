'use client'

/**
 * AC Infinity Grow Tent Module
 * 
 * Displays grow tent status and provides control interface
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Droplets, Thermometer, Wind, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import type { ModuleProps } from './types'
import type { GrowTentStatus, GrowTentDevice } from '@/lib/grow-tent-types'
import { GrowTentClient } from '@/lib/grow-tent-client'

export function GrowTentModuleComponent({ moduleId, settings, isVisible }: ModuleProps) {
  const [status, setStatus] = useState<GrowTentStatus | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [client] = useState(() => new GrowTentClient(settings?.apiUrl || 'http://localhost:3000'))
  
  // Fetch initial status
  useEffect(() => {
    if (!isVisible) return
    
    const fetchStatus = async () => {
      const data = await client.getStatus()
      if (data) {
        setStatus(data)
        setError(null)
      } else {
        setError('Failed to fetch grow tent status')
      }
    }
    
    fetchStatus()
  }, [isVisible, client])

  // Connect WebSocket for real-time updates
  useEffect(() => {
    if (!isVisible) return

    client.connectWebSocket(
      (data) => {
        setStatus(data)
        setIsConnected(true)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setIsConnected(false)
      }
    )

    // Periodic status checks (fallback)
    const interval = setInterval(async () => {
      if (!client.isConnected) {
        const data = await client.getStatus()
        if (data) {
          setStatus(data)
          setError(null)
        }
      }
    }, settings?.refreshInterval || 30000)

    return () => {
      clearInterval(interval)
      client.disconnectWebSocket()
    }
  }, [isVisible, client, settings?.refreshInterval])

  if (!isVisible) return null

  if (error) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Grow Tent - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Make sure the grow tent API is running at {settings?.apiUrl || 'http://localhost:3000'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!status || !status.data || status.data.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-500" />
            Grow Tent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading grow tent data...</p>
        </CardContent>
      </Card>
    )
  }

  const device = status.data[0] // Use first device

  // Calculate VPD (Vapor Pressure Deficit) from temperature and humidity
  const calculateVPD = (tempF: number, humidity: number): number => {
    const tempC = (tempF - 32) * 5 / 9
    const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
    const vpd = svp * (1 - humidity / 100)
    return vpd
  }

  const vpdLeaf = calculateVPD(device.temperature.fahrenheit, device.humidity.value)

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-500" />
            {device.deviceName}
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="border-green-600 text-green-400">
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            <Badge variant={device.online ? "default" : "secondary"}>
              {device.online ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Environmental Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
            <Thermometer className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-lg font-bold">{device.temperature.fahrenheit.toFixed(1)}°F</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
            <Droplets className="h-5 w-5 text-cyan-500" />
            <div>
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="text-lg font-bold">{device.humidity.value.toFixed(1)}%</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
            <Wind className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">VPD Leaf</p>
              <p className="text-lg font-bold">{vpdLeaf.toFixed(2)} kPa</p>
            </div>
          </div>
        </div>

        {/* Port Controls */}
        {settings?.showControls && device.ports && device.ports.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Fan Controls</h4>
            {device.ports.map((port) => (
              <PortControl
                key={port.port}
                deviceId={device.deviceId}
                port={port}
                client={client}
                compact={settings?.compactView}
              />
            ))}
          </div>
        )}

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(status.timestamp).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Individual port control component
 */
interface PortControlProps {
  deviceId: string
  port: any
  client: GrowTentClient
  compact?: boolean
}

function PortControl({ deviceId, port, client, compact }: PortControlProps) {
  const [isOn, setIsOn] = useState(port.online)
  const [speed, setSpeed] = useState(port.speed)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true)
    const result = await client.control({
      deviceId,
      port: port.port,
      settings: {
        mode: checked ? 1 : 0,
      }
    })
    
    if (result?.success) {
      setIsOn(checked)
    }
    
    setIsUpdating(false)
  }

  const handleSpeedChange = async (value: number[]) => {
    const newSpeed = value[0]
    setSpeed(newSpeed)
    
    // Debounce the API call
    setTimeout(async () => {
      setIsUpdating(true)
      await client.control({
        deviceId,
        port: port.port,
        settings: {
          onSpeed: newSpeed,
        }
      })
      setIsUpdating(false)
    }, 500)
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
        <div className="flex items-center gap-3">
          <Wind className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{port.name}</span>
          {port.online && (
            <Badge variant="outline" className="text-xs">
              {speed}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={port.online ? "default" : "secondary"} className="text-xs">
            {port.online ? 'Active' : 'Offline'}
          </Badge>
          <Switch checked={isOn} onCheckedChange={handleToggle} disabled={isUpdating || !port.online} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg bg-zinc-800/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{port.name}</span>
          <Badge variant={port.online ? "default" : "secondary"} className="text-xs">
            {port.online ? 'Active' : 'Offline'}
          </Badge>
        </div>
        <Switch checked={isOn} onCheckedChange={handleToggle} disabled={isUpdating || !port.online} />
      </div>
      
      {isOn && port.online && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Speed</span>
            <span className="text-sm font-medium">{speed}%</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={handleSpeedChange}
            min={0}
            max={100}
            step={1}
            disabled={isUpdating}
            className="w-full"
          />
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Mode:</span>
          <span className="ml-1 font-medium">
            {port.mode === 0 ? 'Off' : port.mode === 1 ? 'On' : port.mode === 2 ? 'Auto' : 'Timer'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Auto:</span>
          <span className="ml-1 font-medium">{port.automation ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>
  )
}
