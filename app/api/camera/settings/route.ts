import { NextRequest, NextResponse } from 'next/server';
import { getCameraSettings, updateCameraEnabled, isDatabaseAvailable } from '@/lib/database';

// GET - Get all camera settings
export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const settings = await getCameraSettings();
    
    return NextResponse.json({
      camera_settings: settings
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching camera settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera settings' },
      { status: 500 }
    );
  }
}

// PUT - Update camera enabled state
export async function PUT(request: NextRequest) {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { uid, enabled } = body;

    if (!uid || enabled === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, enabled' },
        { status: 400 }
      );
    }

    const updated = await updateCameraEnabled(uid, enabled);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update camera settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      camera_setting: updated
    });
  } catch (error) {
    console.error('Error updating camera settings:', error);
    return NextResponse.json(
      { error: 'Failed to update camera settings' },
      { status: 500 }
    );
  }
}
