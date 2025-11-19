'use client'

/**
 * React Hook for Moonraker WebSocket Connection
 * 
 * Provides real-time printer status updates via WebSocket.
 * Automatically handles connection, reconnection, and subscriptions.
 * 
 * Usage:
 * ```tsx
 * const { status, isConnected, isReady } = useMoonrakerWebSocket()
 * ```
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { MoonrakerWebSocketClient } from '../websocket-client'
import type { PrinterStatus } from '../types'

interface UseMoonrakerWebSocketOptions {
  printerHost?: string
  port?: number
  autoConnect?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

interface UseMoonrakerWebSocketReturn {
  status: any | null
  isConnected: boolean
  isReady: boolean
  error: Error | null
  client: MoonrakerWebSocketClient | null
  connect: () => Promise<void>
  disconnect: () => void
}

/**
 * Hook to manage Moonraker WebSocket connection and receive real-time updates
 */
export function useMoonrakerWebSocket(
  options: UseMoonrakerWebSocketOptions = {}
): UseMoonrakerWebSocketReturn {
  const {
    printerHost = process.env.NEXT_PUBLIC_PRINTER_HOST || 'localhost',
    port = parseInt(process.env.NEXT_PUBLIC_MOONRAKER_PORT || '7127'),
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = options

  const [status, setStatus] = useState<any | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const clientRef = useRef<MoonrakerWebSocketClient | null>(null)
  const mountedRef = useRef(true)

  /**
   * Handle status updates from WebSocket
   */
  const handleStatusUpdate = useCallback((data: any) => {
    if (!mountedRef.current) return
    
    setStatus((prevStatus: any) => {
      // Merge the new data with existing status
      if (!prevStatus) return data
      
      // Deep merge the status updates
      return {
        ...prevStatus,
        ...data,
      }
    })
  }, [])

  /**
   * Handle WebSocket connection
   */
  const connect = useCallback(async () => {
    if (clientRef.current?.isConnected) {
      console.log('[Hook] Already connected')
      return
    }

    try {
      setError(null)
      
      if (!clientRef.current) {
        clientRef.current = new MoonrakerWebSocketClient(printerHost, port)
        
        // Set up event handlers
        clientRef.current.onStatus(handleStatusUpdate)
        
        clientRef.current.onReady(() => {
          if (!mountedRef.current) return
          console.log('[Hook] Klipper ready')
          setIsReady(true)
        })
        
        clientRef.current.onDisconnected(() => {
          if (!mountedRef.current) return
          console.log('[Hook] Klipper disconnected')
          setIsReady(false)
        })
        
        clientRef.current.onShutdown(() => {
          if (!mountedRef.current) return
          console.log('[Hook] Klipper shutdown')
          setIsReady(false)
        })
      }

      await clientRef.current.connect()
      
      if (!mountedRef.current) return
      
      setIsConnected(true)
      setIsReady(clientRef.current.isReady)
      
      if (onConnect) {
        onConnect()
      }
    } catch (err) {
      console.error('[Hook] Connection error:', err)
      const error = err instanceof Error ? err : new Error('Connection failed')
      
      if (!mountedRef.current) return
      
      setError(error)
      setIsConnected(false)
      setIsReady(false)
      
      if (onError) {
        onError(error)
      }
    }
  }, [printerHost, port, handleStatusUpdate, onConnect, onError])

  /**
   * Handle WebSocket disconnection
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
    
    if (!mountedRef.current) return
    
    setIsConnected(false)
    setIsReady(false)
    setStatus(null)
    
    if (onDisconnect) {
      onDisconnect()
    }
  }, [onDisconnect])

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    mountedRef.current = true

    if (autoConnect) {
      connect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  /**
   * Monitor WebSocket connection state
   */
  useEffect(() => {
    if (!clientRef.current) return

    const checkInterval = setInterval(() => {
      if (!clientRef.current) return
      
      const connected = clientRef.current.isConnected
      const ready = clientRef.current.isReady
      
      if (isConnected !== connected) {
        setIsConnected(connected)
      }
      
      if (isReady !== ready) {
        setIsReady(ready)
      }
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [isConnected, isReady])

  return {
    status,
    isConnected,
    isReady,
    error,
    client: clientRef.current,
    connect,
    disconnect,
  }
}
