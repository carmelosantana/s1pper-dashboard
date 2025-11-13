'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
import { trackEvent } from '@/components/umami-analytics';
import { Video } from 'lucide-react';
import type { DashboardSettings } from '@/lib/types';

interface CameraInfo {
  name: string;
  service: string;
  target_fps: number;
  target_fps_idle: number;
  current_fps: number;
  aspect_ratio: string;
  resolution: {
    width: number;
    height: number;
  };
  location: string;
  enabled: boolean;
}

interface DetectedResolution {
  width: number;
  height: number;
  timestamp: string;
}

interface CameraComponentProps {
  className?: string;
  isPrinting?: boolean;
  onPrintComplete?: boolean;
}

export function CameraComponent({ className, isPrinting = false, onPrintComplete = false }: CameraComponentProps) {
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [detectedResolution, setDetectedResolution] = useState<DetectedResolution | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [backgroundSnapshot, setBackgroundSnapshot] = useState<string | null>(null);
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);

  // Fetch camera info, settings, and detect resolution
  useEffect(() => {
    const fetchCameraInfo = async () => {
      try {
        const response = await fetch('/api/camera/info');
        if (response.ok) {
          const info = await response.json();
          setCameraInfo(info);
        }
      } catch (error) {
        console.error('Failed to fetch camera info:', error);
      }
    };

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const settingsData = await response.json();
          setSettings(settingsData);
        } else {
          console.warn('Settings API not accessible, defaulting to public mode');
          // Fallback to default settings if API is not accessible
          setSettings({
            visibility_mode: 'public',
            video_feed_enabled: true,
            updated_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        // Fallback to default settings on network error
        setSettings({
          visibility_mode: 'public',
          video_feed_enabled: true,
          updated_at: new Date().toISOString()
        });
      }
    };

    const detectResolution = async () => {
      try {
        const response = await fetch('/api/camera/resolution');
        if (response.ok) {
          const resolution: DetectedResolution = await response.json();
          setDetectedResolution(resolution);
          trackEvent('camera_resolution_detected', { 
            width: resolution.width, 
            height: resolution.height 
          });
        }
      } catch (error) {
        console.error('Failed to detect camera resolution:', error);
        // Don't set any resolution if detection fails - badge won't show
      }
    };

    fetchCameraInfo();
    fetchSettings();
    detectResolution();
  }, []);

  // Determine if video should be shown
  const shouldShowVideo = settings?.video_feed_enabled !== false && settings?.visibility_mode !== 'private';

  // Fetch background snapshot and periodically re-detect resolution
  useEffect(() => {
    if (!cameraInfo || !shouldShowVideo) return;

    const fetchSnapshot = async () => {
      try {
        const cacheBust = Date.now();
        // Use blurred snapshot when not printing, regular snapshot when printing
        const endpoint = isPrinting ? '/api/camera/snapshot' : '/api/camera/blurred-snapshot';
        const response = await fetch(`${endpoint}?cacheBust=${cacheBust}`);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          // Clean up the previous blob URL before setting new one
          setBackgroundSnapshot(prevUrl => {
            if (prevUrl) {
              URL.revokeObjectURL(prevUrl);
            }
            return url;
          });
        }
      } catch (error) {
        console.error('Failed to fetch background snapshot:', error);
      }
    };

    const reDetectResolution = async () => {
      // Only re-detect resolution occasionally to avoid performance issues
      if (!detectedResolution || 
          (Date.now() - new Date(detectedResolution.timestamp).getTime()) > 300000) { // 5 minutes
        try {
          const response = await fetch('/api/camera/resolution');
          if (response.ok) {
            const resolution: DetectedResolution = await response.json();
            setDetectedResolution(resolution);
          }
        } catch (error) {
          console.error('Failed to re-detect camera resolution:', error);
        }
      }
    };

    // Fetch initial snapshot
    fetchSnapshot();

    // Set up interval for background snapshots (every 30 seconds)
    // Also re-detect resolution occasionally
    snapshotIntervalRef.current = setInterval(() => {
      fetchSnapshot();
      reDetectResolution();
    }, 30000);

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, [cameraInfo, isPrinting, shouldShowVideo, detectedResolution]);

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (backgroundSnapshot) {
        URL.revokeObjectURL(backgroundSnapshot);
      }
    };
  }, [backgroundSnapshot]);

  // Handle snapshot load/error for display
  const handleSnapshotLoad = () => {
    setStreamError(false);
    trackEvent('camera_stream_success', { isPrinting, hasBackgroundSnapshot: !!backgroundSnapshot });
  };

  const handleSnapshotError = () => {
    setStreamError(true);
    trackEvent('camera_stream_error', { isPrinting, hasBackgroundSnapshot: !!backgroundSnapshot });
  };

  // Update error state when snapshot is available
  useEffect(() => {
    if (backgroundSnapshot) {
      setStreamError(false);
    }
  }, [backgroundSnapshot]);

  // Trigger confetti when print completes
  useEffect(() => {
    if (onPrintComplete && confettiRef.current) {
      // Multiple confetti bursts for celebration
      const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
      
      // First burst
      confettiRef.current.fire({
        particleCount: 50,
        spread: 70,
        origin: { x: 0.3, y: 0.7 },
        colors,
      });
      
      // Second burst
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 50,
          spread: 70,
          origin: { x: 0.7, y: 0.7 },
          colors,
        });
      }, 200);
      
      // Third burst
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 80,
          spread: 100,
          origin: { x: 0.5, y: 0.6 },
          colors,
        });
      }, 400);
    }
  }, [onPrintComplete]);



  // Check if settings indicate we shouldn't show video, even if camera info is still loading
  if (settings?.visibility_mode === 'private' || settings?.video_feed_enabled === false) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Video className="h-5 w-5 text-gray-400" />
              {cameraInfo?.name || 'Camera'} Camera
            </CardTitle>
            <Badge variant="outline" className="font-mono">
              DISABLED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
            <div className="text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Camera feed disabled</p>
              <p className="text-xs mt-1">
                {settings?.visibility_mode === 'private' ? 'Private mode enabled' : 'Video feed disabled in settings'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cameraInfo) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Video className="h-5 w-5 text-cyan-500" />
            Camera Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
            <span className="text-muted-foreground">Loading camera...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!shouldShowVideo) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Video className="h-5 w-5 text-gray-400" />
              {cameraInfo.name} Camera
            </CardTitle>
            <Badge variant="outline" className="font-mono">
              DISABLED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
            <div className="text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Camera feed disabled</p>
              <p className="text-xs mt-1">
                {settings?.visibility_mode === 'private' ? 'Private mode enabled' : 'Video feed disabled in settings'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Video className="h-5 w-5 text-cyan-500" />
            {cameraInfo.name} Camera
          </CardTitle>
          {detectedResolution && (
            <Badge variant="outline" className="font-mono">
              {detectedResolution.width}×{detectedResolution.height}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div 
            className="relative rounded-lg overflow-hidden bg-black"
            style={{ 
              aspectRatio: detectedResolution 
                ? `${detectedResolution.width}/${detectedResolution.height}`
                : '16/9', // Default to 16:9 for 1920x1080
              maxWidth: '640px',
              width: '100%'
            }}
          >
          {/* Background snapshot (fallback when stream fails) */}
          {backgroundSnapshot && (
            <img
              src={backgroundSnapshot}
              alt="Camera Background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Live video stream (primary display) - only when printing and video enabled */}
          {isPrinting && shouldShowVideo && (
            <img
              ref={imgRef}
              src="/api/camera/stream"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onLoad={handleSnapshotLoad}
              onError={handleSnapshotError}
            />
          )}
          
          {/* Default placeholder when nothing is available */}
          {!backgroundSnapshot && streamError && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-800">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 opacity-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <p className="text-sm">Camera unavailable</p>
              </div>
            </div>
          )}
          
          {/* Top left status badge */}
          <div className="absolute top-2 left-2">
            {isPrinting && shouldShowVideo && !streamError && (
              <Badge className="bg-red-600 hover:bg-red-700 text-white animate-pulse backdrop-blur-sm bg-opacity-90">
                LIVE
              </Badge>
            )}
            {!isPrinting && shouldShowVideo && backgroundSnapshot && (
              <Badge className="bg-blue-600/80 hover:bg-blue-600/90 text-white backdrop-blur-sm">
                STANDBY
              </Badge>
            )}
            {isPrinting && shouldShowVideo && streamError && backgroundSnapshot && (
              <Badge className="bg-red-600/50 hover:bg-red-600/60 text-white backdrop-blur-sm">
                SNAPSHOT
              </Badge>
            )}
            {shouldShowVideo && ((streamError && !backgroundSnapshot) || (!isPrinting && !backgroundSnapshot)) && (
              <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white backdrop-blur-sm">
                RECONNECTING
              </Badge>
            )}
          </div>

          {/* Bottom right FPS display */}
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="font-mono backdrop-blur-sm bg-black/70 text-white border-gray-600">
              {isPrinting && shouldShowVideo && !streamError ? `${cameraInfo.target_fps} FPS` : shouldShowVideo ? '0.03 FPS' : 'DISABLED'}
            </Badge>
          </div>

          {/* Confetti canvas - positioned within video feed area */}
          <Confetti
            ref={confettiRef}
            manualstart={true}
            className="absolute inset-0 pointer-events-none"
            globalOptions={{
              resize: true,
              useWorker: true
            }}
          />
          </div>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Service: <code className="text-foreground bg-muted px-1 py-0.5 rounded text-xs font-mono">{cameraInfo.service}</code>
          </span>
          <span className="text-muted-foreground">
            Location: <code className="text-foreground bg-muted px-1 py-0.5 rounded text-xs font-mono">{cameraInfo.location}</code>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}