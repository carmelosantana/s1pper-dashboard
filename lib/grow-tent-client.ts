/**
 * AC Infinity Grow Tent API Client
 * 
 * Provides HTTP and WebSocket access to grow tent devices
 */

import type { GrowTentStatus, GrowTentControlRequest, GrowTentControlResponse } from './grow-tent-types'

export class GrowTentClient {
  private baseUrl: string
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private reconnectTimer: NodeJS.Timeout | null = null
  private statusCallback: ((status: GrowTentStatus) => void) | null = null
  private controlErrorLogged = false
  
  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  /**
   * Fetch current grow tent status
   */
  async getStatus(): Promise<GrowTentStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/grow-tent/status`, {
        cache: 'no-store',
        next: { revalidate: 0 }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching grow tent status:', error)
      return null
    }
  }

  /**
   * Control a grow tent device
   */
  async control(request: GrowTentControlRequest): Promise<GrowTentControlResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/grow-tent/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Only log error once for debugging, not every time
        if (!this.controlErrorLogged) {
          console.warn('Grow tent controls unavailable:', response.status, errorData.error)
          this.controlErrorLogged = true
        }
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
      
      return await response.json()
    } catch (error) {
      if (!this.controlErrorLogged) {
        console.warn('Grow tent control error:', error instanceof Error ? error.message : 'Unknown error')
        this.controlErrorLogged = true
      }
      return { success: false, error: 'Failed to control device' }
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(onStatus: (status: GrowTentStatus) => void, onError?: (error: Error) => void) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    this.statusCallback = onStatus

    try {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      this.ws = new WebSocket(`${wsUrl}/ws`)

      this.ws.onopen = () => {
        console.log('✅ Grow tent WebSocket connected')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'status' && this.statusCallback) {
            this.statusCallback(data)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (event) => {
        console.error('❌ Grow tent WebSocket error:', event)
        if (onError) {
          onError(new Error('WebSocket connection error'))
        }
      }

      this.ws.onclose = () => {
        console.log('Grow tent WebSocket disconnected')
        this.ws = null
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('Error connecting to WebSocket:', error)
      if (onError) {
        onError(error as Error)
      }
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    if (this.reconnectTimer) {
      return
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.statusCallback) {
        this.connectWebSocket(this.statusCallback)
      }
    }, delay)
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.statusCallback = null
    this.reconnectAttempts = 0
  }

  /**
   * Check if WebSocket is connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

/**
 * Default client instance (can be overridden with custom baseUrl)
 */
export const growTentClient = new GrowTentClient(
  process.env.NEXT_PUBLIC_GROWTENT_API_URL || 'http://localhost:3000'
)
