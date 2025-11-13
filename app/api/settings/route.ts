import { NextRequest, NextResponse } from 'next/server'
import { getDashboardSettings, updateDashboardSettings, initializeDatabase, isDatabaseAvailable } from '@/lib/database'

// Initialize database on startup
let dbInitialized = false
async function ensureDbInitialized() {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available')
  }
  
  if (!dbInitialized) {
    await initializeDatabase()
    dbInitialized = true
  }
}

// Security check for settings API - only allow same-origin or server-side requests
function isAuthorizedRequest(request: NextRequest): boolean {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Allow all requests in development
  if (isDevelopment) {
    return true
  }
  
  // In production, allow requests from same origin or server-side
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // Check if request is from localhost
  const isLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1')
  
  // Check if request is from same origin (same domain)
  const isSameOrigin = origin ? origin === `https://${host}` || origin === `http://${host}` : false
  
  // Check if referer is from same domain (for cases where origin might not be set)
  const isSameReferer = referer ? (
    referer.startsWith(`https://${host}/`) || referer.startsWith(`http://${host}/`)
  ) : false
  
  // Server-side requests (no origin/referer) are allowed
  const isServerSide = !origin && !referer
  
  return isLocalhost || isSameOrigin || isSameReferer || isServerSide
}

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      // Return default settings when database is not available
      return NextResponse.json({
        visibility_mode: 'public',
        video_feed_enabled: true
      })
    }

    // Debug logging for production issues
    if (process.env.NODE_ENV === 'production') {
      console.log('Settings API request headers:', {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
        'x-real-ip': request.headers.get('x-real-ip'),
      })
    }
    
    // Security check
    if (!isAuthorizedRequest(request)) {
      console.log('Settings API: Unauthorized request blocked')
      return NextResponse.json(
        { error: 'Unauthorized access' }, 
        { status: 403 }
      )
    }
    
    await ensureDbInitialized()
    
    const settings = await getDashboardSettings()
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not found' }, 
        { status: 404 }
      )
    }

    return NextResponse.json({
      visibility_mode: settings.visibility_mode,
      video_feed_enabled: settings.video_feed_enabled,
      updated_at: settings.updated_at
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' }, 
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Settings cannot be updated - database not available' },
        { status: 503 }
      )
    }

    if (!isAuthorizedRequest(request)) {
      console.warn('Unauthorized settings update attempt:', {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      })
      
      return NextResponse.json(
        { error: 'Unauthorized access' }, 
        { status: 403 }
      )
    }

    await ensureDbInitialized()
    
    const body = await request.json()
    const { visibility_mode, video_feed_enabled } = body

    // Validate input
    if (visibility_mode && !['offline', 'private', 'public'].includes(visibility_mode)) {
      return NextResponse.json(
        { error: 'Invalid visibility_mode. Must be: offline, private, or public' },
        { status: 400 }
      )
    }

    if (video_feed_enabled !== undefined && typeof video_feed_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid video_feed_enabled. Must be boolean' },
        { status: 400 }
      )
    }

    // Update settings
    const updatedSettings = await updateDashboardSettings(visibility_mode, video_feed_enabled)
    
    if (!updatedSettings) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      visibility_mode: updatedSettings.visibility_mode,
      video_feed_enabled: updatedSettings.video_feed_enabled,
      updated_at: updatedSettings.updated_at
    })

  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}