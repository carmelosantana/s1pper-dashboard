import { NextRequest, NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

interface ThumbnailInfo {
  width: number
  height: number
  size: number
  relative_path: string
}

interface FileMetadata {
  filename: string
  size?: number
  modified?: number
  slicer?: string
  slicer_version?: string
  layer_height?: number
  first_layer_height?: number
  object_height?: number
  filament_total?: number
  estimated_time?: number
  thumbnails?: ThumbnailInfo[]
}

export async function GET(request: NextRequest) {
  if (!KLIPPER_BASE_URL) {
    return NextResponse.json({ error: 'Printer host not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const filename = searchParams.get('filename')

  if (!filename) {
    return NextResponse.json({ error: 'Filename parameter is required' }, { status: 400 })
  }

  try {
    // Fetch file metadata from Moonraker
    const url = `${KLIPPER_BASE_URL}/server/files/metadata?filename=${encodeURIComponent(filename)}`
    
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Return the metadata result
    const metadata: FileMetadata = {
      filename: data.result?.filename || filename,
      size: data.result?.size,
      modified: data.result?.modified,
      slicer: data.result?.slicer,
      slicer_version: data.result?.slicer_version,
      layer_height: data.result?.layer_height,
      first_layer_height: data.result?.first_layer_height,
      object_height: data.result?.object_height,
      filament_total: data.result?.filament_total,
      estimated_time: data.result?.estimated_time,
      thumbnails: data.result?.thumbnails || []
    }

    return NextResponse.json(metadata)

  } catch (error) {
    console.error('Error fetching file metadata:', error)
    return NextResponse.json(
      { error: 'Failed to fetch file metadata', details: String(error) },
      { status: 500 }
    )
  }
}
