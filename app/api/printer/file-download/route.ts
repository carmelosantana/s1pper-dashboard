import { NextRequest, NextResponse } from 'next/server'

const KLIPPER_HOST = process.env.PRINTER_HOST
const KLIPPER_PORT = process.env.MOONRAKER_PORT || '7127'

if (!KLIPPER_HOST) {
  console.error('PRINTER_HOST environment variable is not set')
}

const KLIPPER_BASE_URL = KLIPPER_HOST ? `http://${KLIPPER_HOST}:${KLIPPER_PORT}` : null

/**
 * API route to download GCode files from Moonraker
 * GET /api/printer/file-download?filename=myfile.gcode
 */
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
    // Construct the file download URL - files are in the gcodes root
    // Format: GET /server/files/{root}/{filename}
    const fileUrl = `${KLIPPER_BASE_URL}/server/files/gcodes/${encodeURIComponent(filename)}`
    
    const response = await fetch(fileUrl, { 
      method: 'GET',
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Get the file content
    const fileBuffer = await response.arrayBuffer()
    
    // Extract just the filename without path for Content-Disposition
    const downloadFilename = filename.split('/').pop() || filename
    
    // Return the file with appropriate headers for download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      }
    })

  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json(
      { error: 'Failed to download file', details: String(error) },
      { status: 500 }
    )
  }
}
