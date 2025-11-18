import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSettings } from '@/lib/database';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

interface WebcamConfig {
  uid: string;
  enabled: boolean;
  icon: string;
  aspect_ratio: string;
  target_fps_idle: number;
  name: string;
  location: string;
  service: string;
  target_fps: number;
  stream_url: string;
  snapshot_url: string;
  flip_horizontal: boolean;
  flip_vertical: boolean;
  rotation: number;
  source: string;
  extra_data: object;
}

interface WebcamListResponse {
  result: {
    webcams: WebcamConfig[];
  };
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

    // Get uid from query params
    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get('uid') || undefined;

    const webcamListUrl = `http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`;
    
    console.log('Fetching webcam config from:', webcamListUrl);
    
    const response = await fetch(webcamListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('Moonraker webcam config response not ok:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Moonraker returned ${response.status}: ${response.statusText}` }, 
        { status: response.status }
      );
    }
    
    const data: WebcamListResponse = await response.json();
    
    if (!data.result?.webcams || data.result.webcams.length === 0) {
      return NextResponse.json(
        { error: 'No webcams configured' }, 
        { status: 404 }
      );
    }
    
    // Find specific webcam by UID or get first webcam
    let webcam: WebcamConfig;
    if (uid) {
      const found = data.result.webcams.find(w => w.uid === uid);
      if (!found) {
        return NextResponse.json(
          { error: `Webcam with UID ${uid} not found` }, 
          { status: 404 }
        );
      }
      webcam = found;
    } else {
      // No uid provided, check if there's a selected camera in settings
      const settings = await getDashboardSettings();
      if (settings?.selected_camera_uid) {
        const selectedWebcam = data.result.webcams.find(w => w.uid === settings.selected_camera_uid);
        webcam = selectedWebcam || data.result.webcams[0];
      } else {
        webcam = data.result.webcams[0];
      }
    }
    
    // Calculate resolution from aspect ratio (this is an approximation)
    // Most common resolutions for 4:3 aspect ratio
    const resolutionMap: Record<string, { width: number; height: number }> = {
      '4:3': { width: 640, height: 480 }, // VGA
      '16:9': { width: 1280, height: 720 }, // HD
      '16:10': { width: 1280, height: 800 },
    };
    
    const resolution = resolutionMap[webcam.aspect_ratio] || { width: 640, height: 480 };
    
    return NextResponse.json({
      name: webcam.name,
      service: webcam.service,
      target_fps: webcam.target_fps,
      target_fps_idle: webcam.target_fps_idle,
      current_fps: webcam.target_fps_idle, // We'll assume it's running at idle FPS when not printing
      aspect_ratio: webcam.aspect_ratio,
      resolution: {
        width: resolution.width,
        height: resolution.height
      },
      location: webcam.location,
      enabled: webcam.enabled,
      stream_url: webcam.stream_url,
      snapshot_url: webcam.snapshot_url
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Camera info error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera info', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}