'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
import { trackEvent } from '@/components/umami-analytics';
import { Video, Camera } from 'lucide-react';
import type { DashboardSettings, WebcamConfig } from '@/lib/types';

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
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [webcams, setWebcams] = useState<(WebcamConfig & { database_enabled?: boolean })[]>([]);
  const [selectedCameraUid, setSelectedCameraUid] = useState<string | null>(null);
  const [enabledWebcams, setEnabledWebcams] = useState<(WebcamConfig & { database_enabled?: boolean })[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const confettiRef = useRef<ConfettiRef>(null);

  // Fetch all camera data and settings in parallel on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch camera data and settings in parallel
        const [cameraDataResponse, settingsResponse] = await Promise.all([
          fetch(selectedCameraUid ? `/api/camera/data?uid=${selectedCameraUid}` : '/api/camera/data'),
          fetch('/api/settings')
        ]);

        // Process camera data
        if (cameraDataResponse.ok) {
          const cameraData = await cameraDataResponse.json();
          
          // Update webcams
          setWebcams(cameraData.webcams || []);
          
          // Update enabled webcams
          const enabled = (cameraData.webcams || []).filter((w: WebcamConfig & { database_enabled?: boolean }) => 
            w.database_enabled !== false
          );
          setEnabledWebcams(enabled);
          
          // Update selected camera
          if (enabled.length > 0 && selectedCameraUid === null) {
            if (enabled.length > 1) {
              setSelectedCameraUid(null);
            } else {
              setSelectedCameraUid(enabled[0].uid);
            }
          }

          // Update camera info and resolution from consolidated response
          if (cameraData.selectedCamera) {
            setCameraInfo({
              uid: cameraData.selectedCamera.uid,
              name: cameraData.selectedCamera.name,
              location: cameraData.selectedCamera.location,
              service: cameraData.selectedCamera.service,
              target_fps: cameraData.selectedCamera.target_fps,
              target_fps_idle: cameraData.selectedCamera.target_fps_idle,
              stream_url: cameraData.selectedCamera.stream_url,
              snapshot_url: cameraData.selectedCamera.snapshot_url,
              flip_horizontal: cameraData.selectedCamera.flip_horizontal,
              flip_vertical: cameraData.selectedCamera.flip_vertical,
              rotation: cameraData.selectedCamera.rotation,
              aspect_ratio: cameraData.selectedCamera.aspect_ratio,
              icon: cameraData.selectedCamera.icon,
              enabled: cameraData.selectedCamera.enabled,
              source: cameraData.selectedCamera.source,
              extra_data: cameraData.selectedCamera.extra_data
            });
          }

          if (cameraData.resolution) {
            setDetectedResolution(cameraData.resolution);
            trackEvent('camera_resolution_detected', { 
              width: cameraData.resolution.width, 
              height: cameraData.resolution.height 
            });
          }
        }

        // Process settings
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setSettings(settingsData);
        } else {
          setSettings({
            visibility_mode: 'public',
            video_feed_enabled: true,
            updated_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setSettings({
          visibility_mode: 'public',
          video_feed_enabled: true,
          updated_at: new Date().toISOString()
        });
      }
    };

    fetchData();
  }, [selectedCameraUid]);

  const shouldShowVideo = settings?.video_feed_enabled !== false && settings?.visibility_mode !== 'private';

  const handleStreamLoad = () => {
    setStreamError(false);
    trackEvent('camera_stream_success', { isPrinting });
  };

  const handleStreamError = () => {
    setStreamError(true);
    trackEvent('camera_stream_error', { isPrinting });
  };

  // Trigger confetti when print completes
  useEffect(() => {
    if (onPrintComplete && confettiRef.current) {
      const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
      
      confettiRef.current.fire({
        particleCount: 50,
        spread: 70,
        origin: { x: 0.3, y: 0.7 },
        colors,
      });
      
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 50,
          spread: 70,
          origin: { x: 0.7, y: 0.7 },
          colors,
        });
      }, 200);
      
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
  // Check if settings indicate we shouldn't show video
  const videoFeedDisabledMessage = settings?.video_feed_disabled_message || 'Video feed is disabled';
  
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
              <p>{videoFeedDisabledMessage}</p>
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
              <p>{videoFeedDisabledMessage}</p>
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
            {selectedCameraUid === null ? 'All Cameras' : (cameraInfo?.name || 'Camera')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {detectedResolution && selectedCameraUid !== null && (
              <Badge variant="outline" className="font-mono">
                {detectedResolution.width}×{detectedResolution.height}
              </Badge>
            )}
            {enabledWebcams.length > 1 && (
              <Select 
                value={selectedCameraUid || 'all'} 
                onValueChange={(value) => setSelectedCameraUid(value === 'all' ? null : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      <span>All Cameras</span>
                    </div>
                  </SelectItem>
                  {enabledWebcams.map(cam => (
                    <SelectItem key={cam.uid} value={cam.uid}>
                      <div className="flex items-center gap-2">
                        <span>{cam.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedCameraUid === null ? (
          // All cameras view - grid layout with stream only
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enabledWebcams.map(cam => (
              <div key={cam.uid} className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  {cam.name}
                </div>
                <div 
                  className="relative rounded-lg overflow-hidden bg-black"
                  style={{ 
                    aspectRatio: cam.aspect_ratio === '16:9' ? '16/9' : '4/3',
                    width: '100%'
                  }}
                >
                  {shouldShowVideo ? (
                    <img
                      src={`/api/camera/stream?uid=${cam.uid}`}
                      alt={`${cam.name} stream`}
                      className="w-full h-full object-cover"
                      onError={() => setStreamError(true)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-white bg-gray-800">
                      <div className="text-center">
                        <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{videoFeedDisabledMessage}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {shouldShowVideo && (
                      <Badge className="bg-red-600 hover:bg-red-700 text-white animate-pulse backdrop-blur-sm bg-opacity-90">
                        LIVE
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Single camera view with stream only
        <div className="flex justify-center">
          <div 
            className="relative rounded-lg overflow-hidden bg-black"
            style={{ 
              aspectRatio: detectedResolution 
                ? `${detectedResolution.width}/${detectedResolution.height}`
                : '16/9',
              maxWidth: '640px',
              width: '100%'
            }}
          >
          {shouldShowVideo ? (
            <>
              <img
                ref={imgRef}
                src={selectedCameraUid ? `/api/camera/stream?uid=${selectedCameraUid}` : '/api/camera/stream'}
                alt="Camera stream"
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={handleStreamLoad}
                onError={handleStreamError}
              />
              
              {streamError && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-800">
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No live video feed available</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-800">
              <div className="text-center">
                <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{videoFeedDisabledMessage}</p>
              </div>
            </div>
          )}
          
          {/* Status badge */}
          <div className="absolute top-2 left-2">
            {shouldShowVideo && !streamError && (
              <Badge className="bg-red-600 hover:bg-red-700 text-white animate-pulse backdrop-blur-sm bg-opacity-90">
                LIVE
              </Badge>
            )}
            {shouldShowVideo && streamError && (
              <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white backdrop-blur-sm">
                RECONNECTING
              </Badge>
            )}
          </div>

          {/* FPS display */}
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="font-mono backdrop-blur-sm bg-black/70 text-white border-gray-600">
              {shouldShowVideo && !streamError ? `${cameraInfo.target_fps} FPS` : 'OFFLINE'}
            </Badge>
          </div>

          {/* Confetti canvas */}
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
        )}
        
        <div className="flex justify-between text-sm mt-4">
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