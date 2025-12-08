import { NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

/**
 * POST /api/printer/emergency-stop
 * Performs an emergency stop or host shutdown
 * 
 * Body:
 *  - action: 'emergency_stop' | 'shutdown'
 *    - emergency_stop: Immediately stops the printer (M112)
 *    - shutdown: Gracefully shuts down the host machine
 */
export async function POST(request: Request) {
  try {
    if (!KLIPPER_BASE_URL) {
      return NextResponse.json(
        { 
          error: 'Printer not configured',
          message: 'PRINTER_HOST environment variable is not set'
        },
        { status: 500 }
      )
    }

    // Only allow shutdown in development mode for safety
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'Shutdown is only allowed in development mode'
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const action = body?.action || 'emergency_stop'

    let endpoint: string
    let successMessage: string

    switch (action) {
      case 'shutdown':
        // Shutdown the host machine (Raspberry Pi)
        endpoint = '/machine/shutdown'
        successMessage = 'Host shutdown initiated'
        break
      case 'emergency_stop':
      default:
        // Emergency stop - immediately halt the printer
        endpoint = '/printer/emergency_stop'
        successMessage = 'Emergency stop executed'
        break
    }

    const response = await fetch(`${KLIPPER_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Machine shutdown may not return a response as the host goes down
    if (action === 'shutdown') {
      return NextResponse.json({
        success: true,
        message: successMessage,
        action
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          error: `${action} failed`,
          message: errorText || `Moonraker returned ${response.status}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: successMessage,
      action,
      data
    })

  } catch (error) {
    console.error('Emergency stop/shutdown error:', error)
    return NextResponse.json(
      { 
        error: 'Request failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
