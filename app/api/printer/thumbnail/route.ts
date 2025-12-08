import { NextRequest, NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

export async function GET(request: NextRequest) {
  if (!KLIPPER_BASE_URL) {
    return NextResponse.json({ error: 'Printer host not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 })
  }

  try {
    // Construct the thumbnail URL - thumbnails are stored in gcodes/.thumbs/
    const thumbnailUrl = `${KLIPPER_BASE_URL}/server/files/gcodes/${path}`
    
    const response = await fetch(thumbnailUrl, { 
      method: 'GET',
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Get the image content type
    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Get the image as a buffer
    const imageBuffer = await response.arrayBuffer()
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('Error fetching thumbnail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch thumbnail', details: String(error) },
      { status: 500 }
    )
  }
}
