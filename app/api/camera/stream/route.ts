import { NextRequest, NextResponse } from 'next/server';
import { MoonrakerWebcamListResponse, WebcamConfig } from '@/lib/types';
import { getDashboardSettings } from '@/lib/database';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';
const CAMERA_URL_PREFIX = process.env.CAMERA_URL_PREFIX || `http://${PRINTER_IP}`;

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

interface WebcamListResponse {
  result: {
    webcams: WebcamConfig[];
  };
}

async function getWebcamByUid(uid: string): Promise<WebcamConfig | null> {
  try {
    const response = await fetch(`http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`);
    if (response.ok) {
      const data: WebcamListResponse = await response.json();
      const webcam = data.result.webcams.find(w => w.uid === uid);
      return webcam || null;
    }
  } catch (error) {
    console.error('Failed to get webcam by uid:', error);
  }
  return null;
}

async function getCameraStreamUrl(uid?: string): Promise<string> {
  try {
    // Get camera config from Moonraker
    const response = await fetch(`http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`);
    if (response.ok) {
      const data: MoonrakerWebcamListResponse = await response.json();
      
      let webcam: WebcamConfig | undefined;
      
      if (uid) {
        // Find specific webcam by UID
        webcam = data.result.webcams.find(w => w.uid === uid);
      } else {
        // No uid provided, check if there's a selected camera in settings
        const settings = await getDashboardSettings();
        if (settings?.selected_camera_uid) {
          webcam = data.result.webcams.find(w => w.uid === settings.selected_camera_uid);
        }
        
        // Fallback to first webcam if selected camera not found or no selection
        if (!webcam) {
          webcam = data.result.webcams[0];
        }
      }
      
      if (webcam?.stream_url) {
        // Build full URL - stream_url is relative
        return `${CAMERA_URL_PREFIX}${webcam.stream_url}`;
      }
    }
  } catch (error) {
    console.error('Failed to get camera config:', error);
  }
  
  // Fallback to direct stream URL (first camera)
  return `${CAMERA_URL_PREFIX}/webcam/?action=stream`;
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

    const streamUrl = await getCameraStreamUrl(uid);

    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'multipart/x-mixed-replace,image/jpeg',
      },
      // @ts-ignore - Next.js types don't include duplex
      duplex: 'half',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch camera stream' }, { status: response.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'multipart/x-mixed-replace; boundary=frame');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('Connection', 'keep-alive');
    headers.set('X-Accel-Buffering', 'no');
    
    return new NextResponse(response.body, { headers });
  } catch (error) {
    console.error('Camera stream error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}