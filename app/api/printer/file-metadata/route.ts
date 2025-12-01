import { NextRequest, NextResponse } from 'next/server'
import type { GcodeMetadata, ThumbnailInfo } from '@/lib/types'

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
    const result = data.result || {}
    
    // Return the full metadata result with all available fields
    const metadata: GcodeMetadata = {
      filename: result.filename || filename,
      size: result.size || 0,
      modified: result.modified || 0,
      uuid: result.uuid,
      slicer: result.slicer,
      slicer_version: result.slicer_version,
      gcode_start_byte: result.gcode_start_byte,
      gcode_end_byte: result.gcode_end_byte,
      object_height: result.object_height,
      estimated_time: result.estimated_time,
      nozzle_diameter: result.nozzle_diameter,
      layer_height: result.layer_height,
      first_layer_height: result.first_layer_height,
      first_layer_extr_temp: result.first_layer_extr_temp,
      first_layer_bed_temp: result.first_layer_bed_temp,
      chamber_temp: result.chamber_temp,
      filament_name: result.filament_name,
      filament_type: result.filament_type,
      filament_total: result.filament_total,
      filament_weight_total: result.filament_weight_total,
      thumbnails: (result.thumbnails || []) as ThumbnailInfo[],
      print_start_time: result.print_start_time,
      job_id: result.job_id
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
