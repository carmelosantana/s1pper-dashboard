import { NextResponse } from 'next/server';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

interface WebcamConfig {
  stream_url: string;
}

interface WebcamListResponse {
  result: {
    webcams: WebcamConfig[];
  };
}

async function getCameraStreamUrl(): Promise<string> {
  try {
    // Get camera config from Moonraker
    const response = await fetch(`http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`);
    if (response.ok) {
      const data: WebcamListResponse = await response.json();
      const webcam = data.result.webcams[0];
      if (webcam?.stream_url) {
        // Build full URL - stream_url is relative
        return `http://${PRINTER_IP}${webcam.stream_url}`;
      }
    }
  } catch (error) {
    console.error('Failed to get camera config:', error);
  }
  
  // Fallback to direct stream URL
  return `http://${PRINTER_IP}/webcam/?action=stream`;
}

export async function GET() {
  try {
    // Check if PRINTER_IP is configured
    if (!PRINTER_IP) {
      return NextResponse.json(
        { error: 'PRINTER_HOST environment variable not configured' },
        { status: 500 }
      );
    }

    const streamUrl = await getCameraStreamUrl();

    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch camera stream' }, { status: response.status });
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'multipart/x-mixed-replace',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Camera stream error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}