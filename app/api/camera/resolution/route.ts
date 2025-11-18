import { NextRequest, NextResponse } from 'next/server';
import { MoonrakerWebcamListResponse, WebcamConfig } from '@/lib/types';
import { getDashboardSettings } from '@/lib/database';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

// Common resolution mappings based on aspect ratio
function getResolutionFromAspectRatio(aspectRatio: string): { width: number; height: number } {
  const commonResolutions: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1280, height: 960 },
    '1:1': { width: 1080, height: 1080 },
  };
  
  return commonResolutions[aspectRatio] || { width: 1920, height: 1080 };
}

async function getCameraResolution(uid?: string): Promise<{ width: number; height: number }> {
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
      
      if (webcam) {
        // Use aspect ratio to determine resolution
        const aspectRatio = webcam.aspect_ratio || '16:9';
        return getResolutionFromAspectRatio(aspectRatio);
      }
    }
  } catch (error) {
    console.error('Failed to get camera config:', error);
  }
  
  // Fallback to standard 1080p
  return { width: 1920, height: 1080 };
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

    const resolution = await getCameraResolution(uid);

    return NextResponse.json({
      width: resolution.width,
      height: resolution.height,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        // Cache for 1 hour since aspect ratio doesn't change
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      }
    });

  } catch (error) {
    console.error('Camera resolution detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect camera resolution', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}