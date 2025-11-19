import { NextRequest, NextResponse } from 'next/server'
import { query, initializeDatabase, isDatabaseAvailable } from '@/lib/database'
import { 
  enrichGuestbookEntries, 
  sanitizeMessage, 
  isValidEmail, 
  isValidName,
  extractPrinterInfo,
  type GuestbookEntry,
  type CreateGuestbookEntry 
} from '@/lib/guestbook'
import type { PrinterStatus } from '@/lib/types'

let dbInitialized = false

async function ensureDbInitialized() {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available')
  }

  if (!dbInitialized) {
    try {
      await initializeDatabase()
      dbInitialized = true
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }
}

// GET /api/guestbook - Fetch guestbook entries with pagination
export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Guestbook feature is not available' },
        { status: 503 }
      )
    }

    await ensureDbInitialized()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50) // Max 50 per page
    const offset = (page - 1) * limit

    // Get total count for pagination
    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM guestbook_entries')
    const total = parseInt(countResult[0]?.count || '0', 10)

    // Get entries for current page
    const entries = await query<GuestbookEntry>(`
      SELECT id, name, email, message, printer_status, print_filename, print_progress, created_at, updated_at
      FROM guestbook_entries 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    // Enrich with gravatar URLs
    const enrichedEntries = enrichGuestbookEntries(entries)

    return NextResponse.json({
      entries: enrichedEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('GET /api/guestbook error:', error)
    
    if (error instanceof Error && error.message === 'Database not available') {
      return NextResponse.json(
        { error: 'Guestbook feature is not available' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch guestbook entries' },
      { status: 500 }
    )
  }
}

// POST /api/guestbook - Create new guestbook entry
export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Guestbook feature is not available' },
        { status: 503 }
      )
    }

    await ensureDbInitialized()
    
    const body = await request.json()
    const { name, email, message } = body

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    if (!isValidName(name)) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 50 characters' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    const sanitizedMessage = sanitizeMessage(message)
    if (sanitizedMessage.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters long' },
        { status: 400 }
      )
    }

    // Get current printer status
    let printerInfo = { status: 'unknown', filename: undefined as string | undefined, progress: 0 }
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' 
        ? 'https://s1pper.carmelosantana.cloud' 
        : 'http://localhost:3000')
      
      const printerResponse = await fetch(`${baseUrl}/api/printer/status`, {
        cache: 'no-store'
      })
      
      if (printerResponse.ok) {
        const printerStatus: PrinterStatus = await printerResponse.json()
        printerInfo = extractPrinterInfo(printerStatus)
      }
    } catch (printerError) {
      console.warn('Could not fetch printer status:', printerError)
      // Continue with unknown status
    }

    // Insert new entry
    const newEntry = await query<GuestbookEntry>(`
      INSERT INTO guestbook_entries (name, email, message, printer_status, print_filename, print_progress)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, message, printer_status, print_filename, print_progress, created_at, updated_at
    `, [
      name.trim(),
      email.toLowerCase().trim(),
      sanitizedMessage,
      printerInfo.status,
      printerInfo.filename ?? null,
      printerInfo.progress
    ])

    if (newEntry.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create guestbook entry' },
        { status: 500 }
      )
    }

    // Enrich with gravatar URL
    const enrichedEntry = enrichGuestbookEntries(newEntry)[0]

    return NextResponse.json(
      { 
        message: 'Guestbook entry created successfully',
        entry: enrichedEntry
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('POST /api/guestbook error:', error)
    
    return NextResponse.json(
      { error: 'Failed to create guestbook entry' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}