import { NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

/**
 * POST /api/printer/restart
 * Performs a full printer firmware restart (restarts Klipper)
 */
export async function POST() {
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

    // Call Moonraker API to restart Klipper firmware
    const response = await fetch(`${KLIPPER_BASE_URL}/printer/firmware_restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          error: 'Firmware restart failed',
          message: errorText || `Moonraker returned ${response.status}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Printer firmware restart initiated',
      data
    })

  } catch (error) {
    console.error('Printer restart error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to restart printer',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to restart the printer.' },
    { status: 405 }
  )
}
