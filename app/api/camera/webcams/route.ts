import { NextRequest, NextResponse } from 'next/server';
import { MoonrakerWebcamListResponse, WebcamConfig } from '@/lib/types';
import { getCameraSettings, upsertCameraSettings } from '@/lib/database';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

export async function GET(request: NextRequest) {
  try {
    // Check if PRINTER_IP is configured
    if (!PRINTER_IP) {
      return NextResponse.json(
        { error: 'PRINTER_HOST environment variable not configured' },
        { status: 500 }
      );
    }

    const webcamListUrl = `http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`;
    
    console.log('Fetching webcam list from:', webcamListUrl);
    
    const response = await fetch(webcamListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('Moonraker webcam list response not ok:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Moonraker returned ${response.status}: ${response.statusText}` }, 
        { status: response.status }
      );
    }
    
    const data: MoonrakerWebcamListResponse = await response.json();
    
    if (!data.result?.webcams || data.result.webcams.length === 0) {
      return NextResponse.json(
        { webcams: [] }, 
        { status: 200 }
      );
    }
    
    try {
      const cameraNames = data.result.webcams.map(w => ({ uid: w.uid, name: w.name }));
      await upsertCameraSettings(cameraNames);
    } catch (dbError) {
      console.warn('Failed to sync camera settings to database:', dbError);
      // Continue even if database sync fails
    }
    
    // Get camera settings from database to merge enabled state
    let cameraSettings: Map<string, boolean> = new Map();
    try {
      const settings = await getCameraSettings();
      cameraSettings = new Map(settings.map(s => [s.uid, s.enabled]));
    } catch (dbError) {
      console.warn('Failed to fetch camera settings from database:', dbError);
      // Continue with default enabled state
    }
    
    // Build response with camera configs including our database settings
    const webcams = data.result.webcams.map(webcam => {
      const dbEnabled = cameraSettings.get(webcam.uid);
      return {
        ...webcam,
        // Override enabled state with our database setting if available
        database_enabled: dbEnabled !== undefined ? dbEnabled : true,
      };
    });
    
    return NextResponse.json({
      webcams
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Webcam list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webcam list', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
