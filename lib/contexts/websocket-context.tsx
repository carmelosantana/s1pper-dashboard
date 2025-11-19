'use client'

/**
 * WebSocket Context Provider
 * 
 * Provides a single WebSocket connection shared across the entire application.
 * This prevents multiple components from creating their own connections.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { MoonrakerWebSocketClient } from '../websocket-client'

interface WebSocketContextValue {
  // Connection state
  isConnected: boolean
  isReady: boolean
  error: Error | null
  
  // Printer data (updated in real-time)
  printerStatus: any | null
  
  // Client instance
  client: MoonrakerWebSocketClient | null
  
  // Methods
  connect: () => Promise<void>
  disconnect: () => void
  sendGcode: (script: string) => Promise<void>
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined)

interface WebSocketProviderProps {
  children: React.ReactNode
  printerHost?: string
  port?: number
  autoConnect?: boolean
}

export function WebSocketProvider({
  children,
  printerHost: printerHostProp,
  port: portProp,
  autoConnect = true,
}: WebSocketProviderProps) {
  // Memoize configuration values to prevent re-renders
  const printerHost = useMemo(() => 
    printerHostProp || process.env.NEXT_PUBLIC_PRINTER_HOST,
    [printerHostProp]
  )
  const port = useMemo(() => 
    portProp || (process.env.NEXT_PUBLIC_MOONRAKER_PORT ? parseInt(process.env.NEXT_PUBLIC_MOONRAKER_PORT) : undefined),
    [portProp]
  )
  
  const [client, setClient] = useState<MoonrakerWebSocketClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [printerStatus, setPrinterStatus] = useState<any | null>(null)
  
  // Log configuration only once on initial mount
  useEffect(() => {
    console.log('[WebSocketProvider] Initialized:', {
      printerHost,
      port,
      autoConnect
    })
  }, [])

  /**
   * Handle status updates from WebSocket
   */
  const handleStatusUpdate = useCallback((data: any) => {
    setPrinterStatus((prev: any) => {
      if (!prev) return data
      
      // Deep merge: WebSocket updates only send changed fields
      // We need to preserve fields that weren't updated (like target temps)
      const merged = { ...prev }
      
      for (const key in data) {
        if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
          // Deep merge objects (like extruder, heater_bed)
          merged[key] = { ...merged[key], ...data[key] }
        } else {
          // Direct assignment for primitives
          merged[key] = data[key]
        }
      }
      
      return merged
    })
  }, [])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (client?.isConnected) {
      console.log('[WebSocketProvider] Already connected')
      return
    }

    if (!printerHost || !port) {
      const err = new Error(`Missing WebSocket configuration. Please set NEXT_PUBLIC_PRINTER_HOST and NEXT_PUBLIC_MOONRAKER_PORT in .env.local`)
      console.error('[WebSocketProvider]', err.message)
      setError(err)
      return
    }

    try {
      setError(null)
      console.log('[WebSocketProvider] Connecting to:', `ws://${printerHost}:${port}/websocket`)
      
      let wsClient = client
      if (!wsClient) {
        wsClient = new MoonrakerWebSocketClient(printerHost, port)
        
        // Set up event handlers
        wsClient.onStatus(handleStatusUpdate)
        
        wsClient.onReady(() => {
          console.log('[WebSocketProvider] Klipper ready')
          setIsReady(true)
        })
        
        wsClient.onDisconnected(() => {
          console.log('[WebSocketProvider] Klipper disconnected')
          setIsReady(false)
        })
        
        wsClient.onShutdown(() => {
          console.log('[WebSocketProvider] Klipper shutdown')
          setIsReady(false)
        })
        
        setClient(wsClient)
      }

      await wsClient.connect()
      setIsConnected(true)
      setIsReady(wsClient.isReady)
    } catch (err) {
      console.error('[WebSocketProvider] Connection error:', err)
      const error = err instanceof Error ? err : new Error('Connection failed')
      setError(error)
      setIsConnected(false)
      setIsReady(false)
    }
  }, [client, printerHost, port, handleStatusUpdate])

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect()
      setClient(null)
    }
    setIsConnected(false)
    setIsReady(false)
    setPrinterStatus(null)
  }, [client])

  /**
   * Send GCode command
   */
  const sendGcode = useCallback(async (script: string) => {
    if (!client) {
      throw new Error('WebSocket not connected')
    }
    await client.sendGcode(script)
  }, [client])

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    let mounted = true
    
    if (autoConnect && mounted) {
      connect()
    }

    // Cleanup on unmount only
    return () => {
      mounted = false
      if (client) {
        console.log('[WebSocketProvider] Disconnecting on unmount')
        client.disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount/unmount

  /**
   * Monitor connection state changes from the client
   */
  useEffect(() => {
    if (!client) return

    const interval = setInterval(() => {
      setIsConnected(client.isConnected)
      setIsReady(client.isReady)
    }, 1000)

    return () => clearInterval(interval)
  }, [client])

  const value: WebSocketContextValue = {
    isConnected,
    isReady,
    error,
    printerStatus,
    client,
    connect,
    disconnect,
    sendGcode,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

/**
 * Hook to use the WebSocket context
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

/**
 * Hook to get a specific printer object from the status
 */
export function usePrinterObject<T = any>(objectName: string): T | null {
  const { printerStatus } = useWebSocket()
  return printerStatus?.[objectName] ?? null
}

/**
 * Hook to get printer temperatures
 */
export function usePrinterTemperatures() {
  const { printerStatus } = useWebSocket()
  
  return {
    extruder: printerStatus?.extruder || null,
    heater_bed: printerStatus?.heater_bed || null,
  }
}

/**
 * Hook to get print status
 */
export function usePrintStatus() {
  const { printerStatus } = useWebSocket()
  
  return {
    print_stats: printerStatus?.print_stats || null,
    virtual_sdcard: printerStatus?.virtual_sdcard || null,
    display_status: printerStatus?.display_status || null,
  }
}

/**
 * Hook to get toolhead information
 */
export function useToolhead() {
  const { printerStatus } = useWebSocket()
  return printerStatus?.toolhead || null
}
