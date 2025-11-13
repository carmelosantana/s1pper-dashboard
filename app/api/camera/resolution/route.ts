import { NextResponse } from 'next/server';
import sharp from 'sharp';

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

    // Fetch a snapshot to determine the actual resolution
    const response = await fetch(snapshotUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Failed to fetch camera snapshot for resolution detection:', response.status);
      return NextResponse.json({ error: 'Failed to fetch camera snapshot' }, { status: 500 });
    }

    const imageBuffer = await response.arrayBuffer();
    
    try {
      // Use sharp to get image metadata
      const metadata = await sharp(Buffer.from(imageBuffer)).metadata();
      
      if (!metadata.width || !metadata.height) {
        console.error('Could not determine image dimensions');
        return NextResponse.json({ error: 'Could not determine image dimensions' }, { status: 500 });
      }

      return NextResponse.json({
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          // Cache for 5 minutes to avoid excessive requests
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        }
      });

    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }

  } catch (error) {
    console.error('Camera resolution detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect camera resolution', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}