import { NextRequest, NextResponse } from 'next/server'
import { 
  getViewCameraSettings, 
  updateViewCameraEnabled, 
  updateViewCameraDisplayOrder,
  updateDashboardSettings 
} from '@/lib/database'

// GET /api/view-camera/settings?view=stream|horizontal|vertical
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') as 'stream' | 'horizontal' | 'vertical' | null

    if (!view || !['stream', 'horizontal', 'vertical'].includes(view)) {
      return NextResponse.json(
        { error: 'Invalid or missing view parameter. Must be one of: stream, horizontal, vertical' },
        { status: 400 }
      )
    }

    const settings = await getViewCameraSettings(view)
    return NextResponse.json({ view, settings })
  } catch (error) {
    console.error('Error fetching view camera settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch view camera settings' },
      { status: 500 }
    )
  }
}

// PUT /api/view-camera/settings
// Body: { view: string, camera_uid: string, enabled?: boolean, display_order?: number }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { view, camera_uid, enabled, display_order } = body

    if (!view || !['stream', 'horizontal', 'vertical'].includes(view)) {
      return NextResponse.json(
        { error: 'Invalid or missing view parameter. Must be one of: stream, horizontal, vertical' },
        { status: 400 }
      )
    }

    if (!camera_uid) {
      return NextResponse.json(
        { error: 'Missing camera_uid parameter' },
        { status: 400 }
      )
    }

    let result = null

    // Update enabled state if provided
    if (enabled !== undefined) {
      result = await updateViewCameraEnabled(view, camera_uid, enabled)
    }

    // Update display order if provided
    if (display_order !== undefined) {
      result = await updateViewCameraDisplayOrder(view, camera_uid, display_order)
    }

    if (!result && enabled === undefined && display_order === undefined) {
      return NextResponse.json(
        { error: 'No update parameters provided. Provide either enabled or display_order' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      view,
      camera_uid,
      result 
    })
  } catch (error) {
    console.error('Error updating view camera settings:', error)
    return NextResponse.json(
      { error: 'Failed to update view camera settings' },
      { status: 500 }
    )
  }
}

// POST /api/view-camera/settings/pip-main
// Body: { view: string, camera_uid: string | null }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { view, camera_uid } = body

    if (!view || !['stream', 'horizontal', 'vertical'].includes(view)) {
      return NextResponse.json(
        { error: 'Invalid or missing view parameter. Must be one of: stream, horizontal, vertical' },
        { status: 400 }
      )
    }

    // Update the pip main camera for the specific view
    const fieldMap = {
      stream: 'stream_pip_main_camera_uid',
      horizontal: 'horizontal_pip_main_camera_uid',
      vertical: 'vertical_pip_main_camera_uid'
    }

    const updateParams: any = {}
    updateParams[fieldMap[view]] = camera_uid

    const result = await updateDashboardSettings(
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      view === 'stream' ? camera_uid : undefined,
      view === 'horizontal' ? camera_uid : undefined,
      view === 'vertical' ? camera_uid : undefined
    )

    return NextResponse.json({ 
      success: true, 
      view,
      pip_main_camera_uid: camera_uid,
      result 
    })
  } catch (error) {
    console.error('Error updating pip main camera:', error)
    return NextResponse.json(
      { error: 'Failed to update pip main camera' },
      { status: 500 }
    )
  }
}
