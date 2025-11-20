import { NextRequest, NextResponse } from 'next/server'
import { getDashboardSettings, updateDashboardSettings, initializeDatabase, isDatabaseAvailable } from '@/lib/database'

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
function isAuthorizedRequest(request: NextRequest): boolean {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    return true
  }
  
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  const isLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1')
  const isSameOrigin = origin ? origin === `https://${host}` || origin === `http://${host}` : false
  const isSameReferer = referer ? (
    referer.startsWith(`https://${host}/`) || referer.startsWith(`http://${host}/`)
  ) : false
  const isServerSide = !origin && !referer
  
  return isLocalhost || isSameOrigin || isSameReferer || isServerSide
}

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({
        visibility_mode: 'public',
        video_feed_enabled: true
      })
    }

    if (!isAuthorizedRequest(request)) {
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
      streaming_title_enabled: settings.streaming_title_enabled ?? true,
      selected_camera_uid: settings.selected_camera_uid,
      stream_camera_display_mode: settings.stream_camera_display_mode || 'single',
      horizontal_stream_camera_display_mode: settings.horizontal_stream_camera_display_mode || 'single',
      vertical_stream_camera_display_mode: settings.vertical_stream_camera_display_mode || 'single',
      stream_pip_main_camera_uid: settings.stream_pip_main_camera_uid || null,
      horizontal_pip_main_camera_uid: settings.horizontal_pip_main_camera_uid || null,
      vertical_pip_main_camera_uid: settings.vertical_pip_main_camera_uid || null,
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
      streaming_music_volume,
      streaming_music_crossfade_enabled,
      streaming_music_crossfade_duration,
      streaming_title_enabled,
      selected_camera_uid,
      stream_camera_display_mode,
      horizontal_stream_camera_display_mode,
      vertical_stream_camera_display_mode,
      stream_pip_main_camera_uid,
      horizontal_pip_main_camera_uid,
      vertical_pip_main_camera_uid
    } = body

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

    if (streaming_title_enabled !== undefined && typeof streaming_title_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid streaming_title_enabled. Must be a boolean' },
        { status: 400 }
      )
    }

    if (stream_camera_display_mode && !['single', 'grid', 'pip', 'offline_video_swap'].includes(stream_camera_display_mode)) {
      return NextResponse.json(
        { error: 'Invalid stream_camera_display_mode. Must be single, grid, pip, or offline_video_swap' },
        { status: 400 }
      )
    }

    if (horizontal_stream_camera_display_mode && !['single', 'grid', 'pip', 'offline_video_swap'].includes(horizontal_stream_camera_display_mode)) {
      return NextResponse.json(
        { error: 'Invalid horizontal_stream_camera_display_mode. Must be single, grid, pip, or offline_video_swap' },
        { status: 400 }
      )
    }

    if (vertical_stream_camera_display_mode && !['single', 'grid', 'pip', 'offline_video_swap'].includes(vertical_stream_camera_display_mode)) {
      return NextResponse.json(
        { error: 'Invalid vertical_stream_camera_display_mode. Must be single, grid, pip, or offline_video_swap' },
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
      streaming_music_volume,
      streaming_music_crossfade_enabled,
      streaming_music_crossfade_duration,
      streaming_title_enabled,
      selected_camera_uid,
      stream_camera_display_mode,
      horizontal_stream_camera_display_mode,
      vertical_stream_camera_display_mode,
      stream_pip_main_camera_uid,
      horizontal_pip_main_camera_uid,
      vertical_pip_main_camera_uid
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
      streaming_title_enabled: updatedSettings.streaming_title_enabled ?? true,
      selected_camera_uid: updatedSettings.selected_camera_uid,
      stream_camera_display_mode: updatedSettings.stream_camera_display_mode || 'single',
      horizontal_stream_camera_display_mode: updatedSettings.horizontal_stream_camera_display_mode || 'single',
      vertical_stream_camera_display_mode: updatedSettings.vertical_stream_camera_display_mode || 'single',
      stream_pip_main_camera_uid: updatedSettings.stream_pip_main_camera_uid || null,
      horizontal_pip_main_camera_uid: updatedSettings.horizontal_pip_main_camera_uid || null,
      vertical_pip_main_camera_uid: updatedSettings.vertical_pip_main_camera_uid || null,
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