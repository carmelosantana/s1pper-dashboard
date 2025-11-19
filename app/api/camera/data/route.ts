import { NextRequest, NextResponse } from 'next/server';
import type { WebcamConfig, MoonrakerWebcamListResponse } from '@/lib/types';
import { getCameraSettings, getDashboardSettings, upsertCameraSettings } from '@/lib/database';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

// Cache for 10 seconds to reduce load
const CACHE_DURATION = 10000;
let lastFetch = 0;
let cachedData: any = null;

export async function GET(request: NextRequest) {
  try {
    if (!PRINTER_IP) {
      return NextResponse.json(
        { error: 'PRINTER_HOST environment variable not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedUid = searchParams.get('uid') || undefined;

    const now = Date.now();
    if (cachedData && now - lastFetch < CACHE_DURATION && !requestedUid) {
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        }
      });
    }

    const webcamListUrl = `http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`;
    
    const webcamsResponse = await fetch(webcamListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store'
    });
    
    if (!webcamsResponse.ok) {
      console.error('Moonraker webcam list response not ok:', webcamsResponse.status);
      return NextResponse.json(
        { error: `Moonraker returned ${webcamsResponse.status}` }, 
        { status: webcamsResponse.status }
      );
    }
    
    const webcamsData: MoonrakerWebcamListResponse = await webcamsResponse.json();
    
    if (!webcamsData.result?.webcams || webcamsData.result.webcams.length === 0) {
      return NextResponse.json({
        webcams: [],
        selectedCamera: null,
        resolution: null
      });
    }
    
    try {
      const cameraNames = webcamsData.result.webcams.map(w => ({ uid: w.uid, name: w.name }));
      await upsertCameraSettings(cameraNames);
    } catch (dbError) {
      console.warn('Failed to sync camera settings:', dbError);
    }
    
    let cameraSettings: Map<string, boolean> = new Map();
    try {
      const settings = await getCameraSettings();
      cameraSettings = new Map(settings.map(s => [s.uid, s.enabled]));
    } catch (dbError) {
      console.warn('Failed to fetch camera settings from database:', dbError);
    }
    
    // Build webcams list with database settings
    const webcams = webcamsData.result.webcams.map(webcam => ({
      ...webcam,
      database_enabled: cameraSettings.get(webcam.uid) ?? true
    }));
    
    // Determine selected camera
    let selectedCamera: WebcamConfig | null = null;
    
    // First, try to use requested UID
    if (requestedUid) {
      selectedCamera = webcams.find(w => w.uid === requestedUid) || null;
    }
    
    // If no requested UID, try to use dashboard settings
    if (!selectedCamera) {
      try {
        const dashboardSettings = await getDashboardSettings();
        if (dashboardSettings?.selected_camera_uid) {
          selectedCamera = webcams.find(w => w.uid === dashboardSettings.selected_camera_uid) || null;
        }
      } catch (dbError) {
        console.warn('Failed to fetch dashboard settings:', dbError);
      }
    }
    
    // If still no selected camera, use the first enabled one
    if (!selectedCamera) {
      const enabledWebcams = webcams.filter(w => w.database_enabled !== false);
      selectedCamera = enabledWebcams[0] || webcams[0] || null;
    }
    
    // Get resolution for selected camera
    let resolution = null;
    if (selectedCamera) {
      // Common resolution mappings based on aspect ratio
      const resolutionMap: Record<string, { width: number; height: number }> = {
        '16:9': { width: 1920, height: 1080 },
        '4:3': { width: 1280, height: 960 },
        '1:1': { width: 1080, height: 1080 },
      };
      
      resolution = resolutionMap[selectedCamera.aspect_ratio] || { width: 1920, height: 1080 };
    }
    
    const responseData = {
      webcams,
      selectedCamera,
      resolution
    };
    
    // Cache the response if no specific UID was requested
    if (!requestedUid) {
      cachedData = responseData;
      lastFetch = now;
    }
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
      }
    });
    
  } catch (error) {
    console.error('Camera data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera data', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
