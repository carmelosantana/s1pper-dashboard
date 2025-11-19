/**
 * Moonraker WebSocket Client
 * 
 * Provides real-time printer status updates via WebSocket connection to Moonraker.
 * This replaces polling-based HTTP requests with event-driven updates.
 * 
 * Based on Moonraker's JSON-RPC 2.0 WebSocket API:
 * https://moonraker.readthedocs.io/en/latest/web_api/
 */

import type { PrinterStatus, TemperatureHistory } from './types'

type NotificationCallback = (data: any) => void

interface WebSocketMessage {
  jsonrpc: '2.0'
  method?: string
  params?: any
  id?: number
  result?: any
  error?: {
    code: number
    message: string
  }
}

interface SubscriptionObjects {
  [key: string]: null | string[]
}

export class MoonrakerWebSocketClient {
  private ws: WebSocket | null = null
  private wsUrl: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private reconnectTimer: NodeJS.Timeout | null = null
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>()
  private subscribed = false
  private identified = false
  
  // Notification handlers
  private onStatusUpdate: NotificationCallback | null = null
  private onKlippyReady: (() => void) | null = null
  private onKlippyDisconnected: (() => void) | null = null
  private onKlippyShutdown: (() => void) | null = null
  
  // Connection state
  public isConnected = false
  public isReady = false

  constructor(printerHost: string, port = 7127) {
    // For client-side, use the current location's protocol (ws:// or wss://)
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.wsUrl = `${protocol}//${printerHost}:${port}/websocket`
  }

  /**
   * Connect to Moonraker WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected')
      return
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[WebSocket] Connecting to:', this.wsUrl)
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.handleConnect()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error)
          this.isConnected = false
          reject(error)
        }

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason)
          this.isConnected = false
          this.isReady = false
          this.subscribed = false
          this.identified = false
          
          // Attempt reconnection
          this.scheduleReconnect()
        }
      } catch (error) {
        console.error('[WebSocket] Connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Handle successful connection
   */
  private async handleConnect() {
    try {
      // Step 1: Identify the connection
      await this.identifyConnection()
      
      // Step 2: Get printer info to check Klipper state
      const info = await this.request('printer.info')
      console.log('[WebSocket] Printer info:', info)
      
      if (info.state === 'ready') {
        this.isReady = true
        
        // Step 3: Subscribe to printer objects
        await this.subscribeToPrinterObjects()
      } else {
        console.warn('[WebSocket] Klipper not ready:', info.state, info.state_message)
        // We can still connect, but won't receive updates until Klipper is ready
      }
    } catch (error) {
      console.error('[WebSocket] Error during connection setup:', error)
    }
  }

  /**
   * Identify this connection to Moonraker
   */
  private async identifyConnection(): Promise<void> {
    if (this.identified) return

    try {
      const result = await this.request('server.connection.identify', {
        client_name: 's1pper-dashboard',
        version: '1.0.0',
        type: 'web',
        url: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000'
      })
      
      this.identified = true
      console.log('[WebSocket] Connection identified:', result.connection_id)
    } catch (error) {
      console.error('[WebSocket] Failed to identify connection:', error)
      throw error
    }
  }

  /**
   * Subscribe to printer object updates
   * This is the key to receiving real-time updates
   */
  private async subscribeToPrinterObjects(): Promise<void> {
    if (this.subscribed) return

    // Define which printer objects we want to subscribe to
    const objects: SubscriptionObjects = {
      // Print status
      print_stats: null,
      virtual_sdcard: null,
      display_status: null,
      
      // Temperatures
      extruder: null,
      heater_bed: null,
      
      // Positions and movement
      toolhead: null,
      gcode_move: null,
      motion_report: null,
      
      // System
      webhooks: null,
      idle_timeout: null,
      system_stats: null,
      
      // Heaters list
      heaters: null,
    }

    try {
      const result = await this.request('printer.objects.subscribe', { objects })
      this.subscribed = true
      console.log('[WebSocket] Subscribed to printer objects')
      
      // The initial status is returned in the result
      if (result.status) {
        console.log('[WebSocket] Initial status received')
        // Trigger the status update callback with initial data
        if (this.onStatusUpdate) {
          this.onStatusUpdate(result.status)
        }
      }
    } catch (error) {
      console.error('[WebSocket] Failed to subscribe:', error)
      throw error
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private request(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }

      const id = ++this.requestId
      const message: WebSocketMessage = {
        jsonrpc: '2.0',
        method,
        id,
      }

      if (params) {
        message.params = params
      }

      this.pendingRequests.set(id, { resolve, reject })
      this.ws.send(JSON.stringify(message))
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 10000)
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data)

      // Handle JSON-RPC responses
      if (message.id !== undefined && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!
        this.pendingRequests.delete(message.id)

        if (message.error) {
          reject(new Error(message.error.message))
        } else {
          resolve(message.result)
        }
        return
      }

      // Handle notifications (no id field)
      if (message.method && message.method.startsWith('notify_')) {
        this.handleNotification(message.method, message.params)
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error, data)
    }
  }

  /**
   * Handle notification messages from Moonraker
   */
  private handleNotification(method: string, params: any) {
    switch (method) {
      case 'notify_status_update':
        // This is the main notification - Klipper object updates
        // params is [data, timestamp]
        if (params && params[0] && this.onStatusUpdate) {
          this.onStatusUpdate(params[0])
        }
        break

      case 'notify_klippy_ready':
        console.log('[WebSocket] Klipper is ready')
        this.isReady = true
        if (this.onKlippyReady) {
          this.onKlippyReady()
        }
        // Re-subscribe after Klipper restart
        this.subscribeToPrinterObjects()
        break

      case 'notify_klippy_disconnected':
        console.warn('[WebSocket] Klipper disconnected')
        this.isReady = false
        if (this.onKlippyDisconnected) {
          this.onKlippyDisconnected()
        }
        break

      case 'notify_klippy_shutdown':
        console.warn('[WebSocket] Klipper shutdown')
        this.isReady = false
        if (this.onKlippyShutdown) {
          this.onKlippyShutdown()
        }
        break

      case 'notify_gcode_response':
        // GCode responses from Klipper
        if (params && params[0]) {
          console.log('[WebSocket] GCode:', params[0])
        }
        break

      case 'notify_proc_stat_update':
        // System stats updates (CPU, memory, etc.) - ignore silently
        break

      default:
        console.log('[WebSocket] Unhandled notification:', method, params)
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached')
      return
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Set status update callback
   */
  public onStatus(callback: NotificationCallback) {
    this.onStatusUpdate = callback
  }

  /**
   * Set Klippy ready callback
   */
  public onReady(callback: () => void) {
    this.onKlippyReady = callback
  }

  /**
   * Set Klippy disconnected callback
   */
  public onDisconnected(callback: () => void) {
    this.onKlippyDisconnected = callback
  }

  /**
   * Set Klippy shutdown callback
   */
  public onShutdown(callback: () => void) {
    this.onKlippyShutdown = callback
  }

  /**
   * Get server info
   */
  public async getServerInfo(): Promise<any> {
    return this.request('server.info')
  }

  /**
   * Get printer info
   */
  public async getPrinterInfo(): Promise<any> {
    return this.request('printer.info')
  }

  /**
   * Get printer objects list
   */
  public async getPrinterObjectsList(): Promise<string[]> {
    const result = await this.request('printer.objects.list')
    return result.objects || []
  }

  /**
   * Query specific printer objects
   */
  public async queryPrinterObjects(objects: SubscriptionObjects): Promise<any> {
    const result = await this.request('printer.objects.query', { objects })
    return result.status
  }

  /**
   * Get temperature store (history)
   */
  public async getTemperatureStore(): Promise<any> {
    return this.request('server.temperature_store')
  }

  /**
   * Get job history totals (lifetime stats)
   */
  public async getJobHistoryTotals(): Promise<any> {
    return this.request('server.history.totals')
  }

  /**
   * Send GCode command
   */
  public async sendGcode(script: string): Promise<void> {
    await this.request('printer.gcode.script', { script })
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.isConnected = false
    this.isReady = false
    this.subscribed = false
    this.identified = false
    this.pendingRequests.clear()
  }
}
