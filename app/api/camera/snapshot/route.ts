import { NextResponse } from 'next/server';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

interface WebcamConfig {
  snapshot_url: string;
}

interface WebcamListResponse {
  result: {
    webcams: WebcamConfig[];
  };
}

async function getCameraSnapshotUrl(): Promise<string> {
  try {
    // Get camera config from Moonraker
    const response = await fetch(`http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`);
    if (response.ok) {
      const data: WebcamListResponse = await response.json();
      const webcam = data.result.webcams[0];
      if (webcam?.snapshot_url) {
        // Build full URL - snapshot_url is relative
        return `http://${PRINTER_IP}${webcam.snapshot_url}`;
      }
    }
  } catch (error) {
    console.error('Failed to get camera config:', error);
  }
  
  // Fallback to direct snapshot URL
  return `http://${PRINTER_IP}/webcam/?action=snapshot`;
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

    const snapshotUrl = await getCameraSnapshotUrl();

    const response = await fetch(snapshotUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch camera snapshot' }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Camera snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}