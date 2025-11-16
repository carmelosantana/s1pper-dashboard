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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(snapshotUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Camera snapshot HTTP error: ${response.status}`);
        return NextResponse.json({ error: 'Failed to fetch camera snapshot' }, { status: response.status });
      }

      const imageBuffer = await response.arrayBuffer();
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error('Camera snapshot timeout');
          return NextResponse.json({ error: 'Camera snapshot request timed out' }, { status: 504 });
        }
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Camera snapshot error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET') || error.message.includes('terminated')) {
        return NextResponse.json(
          { error: 'Camera connection was reset. The camera may be busy or unavailable.' }, 
          { status: 503 }
        );
      }
      if (error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Cannot connect to camera. Please check camera configuration.' }, 
          { status: 503 }
        );
      }
      if (error.message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          { error: 'Camera request timed out' }, 
          { status: 504 }
        );
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}