import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

const PRINTER_IP = process.env.PRINTER_HOST;
const MOONRAKER_PORT = process.env.MOONRAKER_PORT || '7127';
// Camera URL prefix for relative URLs - uses Traefik proxy port
const CAMERA_URL_PREFIX = process.env.CAMERA_URL_PREFIX || `http://${PRINTER_IP}`;

if (!PRINTER_IP) {
  console.error('PRINTER_HOST environment variable is not set');
}

interface WebcamConfig {
  uid: string;
  snapshot_url: string;
}

interface WebcamListResponse {
  result: {
    webcams: WebcamConfig[];
  };
}

async function getCameraSnapshotUrl(uid?: string): Promise<string> {
  try {
    // Get camera config from Moonraker
    const response = await fetch(`http://${PRINTER_IP}:${MOONRAKER_PORT}/server/webcams/list`);
    if (response.ok) {
      const data: WebcamListResponse = await response.json();
      
      // Find the webcam by uid if provided, otherwise use first one
      let webcam = data.result.webcams[0];
      if (uid) {
        const found = data.result.webcams.find(w => w.uid === uid);
        if (found) webcam = found;
      }
      
      if (webcam?.snapshot_url) {
        let finalUrl: string;
        // Check if snapshot_url is already a full URL
        if (webcam.snapshot_url.startsWith('http://') || webcam.snapshot_url.startsWith('https://')) {
          finalUrl = webcam.snapshot_url;
        } else {
          // Build full URL using CAMERA_URL_PREFIX for relative URLs
          // This handles Traefik proxy port (e.g., 6780) correctly
          finalUrl = `${CAMERA_URL_PREFIX}${webcam.snapshot_url}`;
        }
        console.log(`[Snapshot] Camera ${uid || 'default'}: fetching from ${finalUrl}`);
        return finalUrl;
      }
    }
  } catch (error) {
    console.error('Failed to get camera config:', error);
  }
  
  // Fallback to direct snapshot URL using CAMERA_URL_PREFIX
  const fallbackUrl = `${CAMERA_URL_PREFIX}/webcam/?action=snapshot`;
  console.log(`[Snapshot] Using fallback URL: ${fallbackUrl}`);
  return fallbackUrl;
}

// Helper function to fetch with SSL bypass for self-signed certs using native Node.js modules
function fetchWithSSLBypass(url: string, options: { headers?: Record<string, string>, signal?: AbortSignal } = {}): Promise<{ ok: boolean, status: number, arrayBuffer: () => Promise<ArrayBuffer>, headers: { get: (name: string) => string | null } }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    
    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: options.headers || {},
      // Ignore self-signed certificate errors
      rejectUnauthorized: false,
    };

    const httpModule = isHttps ? https : http;
    
    const req = httpModule.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 500,
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          headers: {
            get: (name: string) => {
              const value = res.headers[name.toLowerCase()];
              if (Array.isArray(value)) return value[0];
              return value || null;
            }
          }
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    // Handle abort signal
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('AbortError'));
      });
    }

    req.end();
  });
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

    const snapshotUrl = await getCameraSnapshotUrl(uid);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetchWithSSLBypass(snapshotUrl, {
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
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
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
      // Handle self-signed certificate errors
      if (error.message.includes('self-signed') || error.message.includes('DEPTH_ZERO_SELF_SIGNED_CERT')) {
        return NextResponse.json(
          { error: 'Camera uses self-signed certificate. Please check camera configuration.' }, 
          { status: 503 }
        );
      }
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