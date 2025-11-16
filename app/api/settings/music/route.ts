import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const MUSIC_DIR = join(process.cwd(), 'public', 'music')

/**
 * GET /api/settings/music
 * List all available music files
 */
export async function GET() {
  try {
    // Ensure music directory exists
    if (!existsSync(MUSIC_DIR)) {
      return NextResponse.json({
        files: []
      })
    }

    // Read directory and filter for audio files
    const files = await readdir(MUSIC_DIR)
    const audioFiles = files.filter(file => {
      const ext = file.toLowerCase().split('.').pop()
      return ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext || '')
    })

    return NextResponse.json({
      files: audioFiles.map(file => ({
        name: file,
        url: `/music/${file}`
      }))
    })
  } catch (error) {
    console.error('Error listing music files:', error)
    return NextResponse.json(
      { error: 'Failed to list music files' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/music
 * Upload a new music file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const ext = file.name.toLowerCase().split('.').pop()
    if (!['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported formats: mp3, wav, ogg, aac, flac, m4a' },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = join(MUSIC_DIR, sanitizedName)

    // Check if file already exists
    if (existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File already exists' },
        { status: 409 }
      )
    }

    // Ensure directory exists
    const { mkdir } = await import('fs/promises')
    await mkdir(MUSIC_DIR, { recursive: true })

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      file: {
        name: sanitizedName,
        url: `/music/${sanitizedName}`
      }
    })
  } catch (error) {
    console.error('Error uploading music file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/music?file=filename.mp3
 * Delete a music file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('file')

    if (!filename) {
      return NextResponse.json(
        { error: 'No filename provided' },
        { status: 400 }
      )
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = join(MUSIC_DIR, sanitizedFilename)

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Delete file
    await unlink(filePath)

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting music file:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
