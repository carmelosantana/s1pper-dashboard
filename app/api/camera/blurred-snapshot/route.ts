import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSettings } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Check dashboard settings first
    const settings = await getDashboardSettings();
    const videoFeedEnabled = settings?.video_feed_enabled ?? true;
    const visibilityMode = settings?.visibility_mode || 'public';
    
    // If video feed is disabled or dashboard is offline, return error
    if (!videoFeedEnabled || visibilityMode === 'offline') {
      return NextResponse.json(
        { error: 'Video feed is disabled' }, 
        { status: 403 }
      );
    }
    
    const PRINTER_IP = process.env.PRINTER_HOST;
    
    if (!PRINTER_IP) {
      return NextResponse.json(
        { error: 'PRINTER_HOST environment variable not configured' },
        { status: 500 }
      );
    }
    
    // First, get the regular snapshot
    const snapshotResponse = await fetch(`http://${PRINTER_IP}/webcam/?action=snapshot`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!snapshotResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch snapshot from camera' },
        { status: 500 }
      );
    }

    const imageBuffer = await snapshotResponse.arrayBuffer();
    
    // Import sharp for server-side image processing
    const sharp = require('sharp');
    
    // Apply blur effect to the image
    const blurredImageBuffer = await sharp(Buffer.from(imageBuffer))
      .blur(15) // Apply significant blur for privacy
      .jpeg({ quality: 80 }) // Convert to JPEG to reduce size
      .toBuffer();

    // Return the blurred image
    return new NextResponse(blurredImageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error creating blurred snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to create blurred snapshot' },
      { status: 500 }
    );
  }
}