import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import type { GuestbookEntry } from '@/lib/guestbook'

// DELETE /api/guestbook/[id] - Delete a specific guestbook entry (development only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow deletion in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Delete operation not allowed in production' },
      { status: 403 }
    )
  }

  try {
    const { id: idString } = await params
    const id = parseInt(idString, 10)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      )
    }

    // Check if entry exists
    const existingEntry = await query<GuestbookEntry>(
      'SELECT id FROM guestbook_entries WHERE id = $1',
      [id]
    )

    if (existingEntry.length === 0) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    // Delete the entry
    await query(
      'DELETE FROM guestbook_entries WHERE id = $1',
      [id]
    )

    return NextResponse.json(
      { message: 'Entry deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('DELETE /api/guestbook/[id] error:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete guestbook entry' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
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