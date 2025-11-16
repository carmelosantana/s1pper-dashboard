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
      dashboard_title: settings.dashboard_title,
      dashboard_subtitle: settings.dashboard_subtitle,
      dashboard_icon_url: settings.dashboard_icon_url,
      config_page_enabled: settings.config_page_enabled,
      guestbook_enabled: settings.guestbook_enabled,
      streaming_music_file: settings.streaming_music_file,
      streaming_music_enabled: settings.streaming_music_enabled,
      streaming_music_loop: settings.streaming_music_loop,
      streaming_music_playlist: settings.streaming_music_playlist || [],
      streaming_music_volume: settings.streaming_music_volume || 50,
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
    const dbAvailable = isDatabaseAvailable()
    console.log('PUT /api/settings - Database check:', {
      available: dbAvailable,
      hasUrl: !!process.env.DATABASE_URL
    })
    
    if (!dbAvailable) {
      console.log('PUT /api/settings - Database not available, returning 503')
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
    const { 
      visibility_mode, 
      video_feed_enabled,
      dashboard_title,
      dashboard_subtitle,
      dashboard_icon_url,
      config_page_enabled,
      guestbook_enabled,
      streaming_music_file,
      streaming_music_enabled,
      streaming_music_loop,
      streaming_music_playlist,
      streaming_music_volume
    } = body

    // Validate input
    if (visibility_mode && !['offline', 'private', 'public'].includes(visibility_mode)) {
      return NextResponse.json(
        { error: 'Invalid visibility_mode. Must be offline, private, or public' },
        { status: 400 }
      )
    }

    if (video_feed_enabled !== undefined && typeof video_feed_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid video_feed_enabled. Must be a boolean' },
        { status: 400 }
      )
    }

    if (config_page_enabled !== undefined && typeof config_page_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid config_page_enabled. Must be a boolean' },
        { status: 400 }
      )
    }

    if (guestbook_enabled !== undefined && typeof guestbook_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid guestbook_enabled. Must be a boolean' },
        { status: 400 }
      )
    }

    if (streaming_music_enabled !== undefined && typeof streaming_music_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid streaming_music_enabled. Must be a boolean' },
        { status: 400 }
      )
    }

    if (streaming_music_loop !== undefined && typeof streaming_music_loop !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid streaming_music_loop. Must be a boolean' },
        { status: 400 }
      )
    }

    if (streaming_music_playlist !== undefined && !Array.isArray(streaming_music_playlist)) {
      return NextResponse.json(
        { error: 'Invalid streaming_music_playlist. Must be an array' },
        { status: 400 }
      )
    }

    if (streaming_music_volume !== undefined && (typeof streaming_music_volume !== 'number' || streaming_music_volume < 0 || streaming_music_volume > 100)) {
      return NextResponse.json(
        { error: 'Invalid streaming_music_volume. Must be a number between 0 and 100' },
        { status: 400 }
      )
    }

    // Update settings
    const updatedSettings = await updateDashboardSettings(
      visibility_mode,
      video_feed_enabled,
      dashboard_title,
      dashboard_subtitle,
      dashboard_icon_url,
      config_page_enabled,
      guestbook_enabled,
      streaming_music_file,
      streaming_music_enabled,
      streaming_music_loop,
      streaming_music_playlist,
      streaming_music_volume
    )
    
    if (!updatedSettings) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      visibility_mode: updatedSettings.visibility_mode,
      video_feed_enabled: updatedSettings.video_feed_enabled,
      dashboard_title: updatedSettings.dashboard_title,
      dashboard_subtitle: updatedSettings.dashboard_subtitle,
      dashboard_icon_url: updatedSettings.dashboard_icon_url,
      config_page_enabled: updatedSettings.config_page_enabled,
      guestbook_enabled: updatedSettings.guestbook_enabled,
      streaming_music_file: updatedSettings.streaming_music_file,
      streaming_music_enabled: updatedSettings.streaming_music_enabled,
      streaming_music_loop: updatedSettings.streaming_music_loop,
      streaming_music_playlist: updatedSettings.streaming_music_playlist || [],
      streaming_music_volume: updatedSettings.streaming_music_volume || 50,
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