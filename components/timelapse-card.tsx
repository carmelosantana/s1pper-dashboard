"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, Film, Calendar, FileText } from "lucide-react"
import Image from "next/image"

interface TimelapseFile {
  filename: string;
  thumbnail: string;
  video: string;
  title: string;
  date: string;
  size: number;
  modified: Date;
}

interface TimelapseResponse {
  timelapse: TimelapseFile[];
  count: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function VideoModal({ timelapse }: { timelapse: TimelapseFile }) {
  return (
    <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-500" />
            {timelapse.title}
          </div>
        </DialogTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {timelapse.date}
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {formatFileSize(timelapse.size)}
          </div>
        </div>
      </DialogHeader>
      
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          controls
          autoPlay
          className="w-full h-full object-contain"
          poster={timelapse.thumbnail}
        >
          <source src={timelapse.video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </DialogContent>
  )
}

function TimelapseGrid({ timelapses }: { timelapses: TimelapseFile[] }) {
  if (timelapses.length === 0) {
    return (
      <div className="text-center py-8">
        <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No timelapse videos found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Run `pnpm sync-timelapse` to download videos from your printer
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {timelapses.map((timelapse) => (
        <Dialog key={timelapse.filename}>
          <DialogTrigger asChild>
            <div className="group relative aspect-video bg-zinc-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all duration-200">
              <Image
                src={timelapse.thumbnail}
                alt={timelapse.title}
                fill
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              
              {/* Play button overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="bg-cyan-500/90 rounded-full p-3">
                  <Play className="h-6 w-6 text-white ml-1" fill="currentColor" />
                </div>
              </div>
              
              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <h3 className="text-white text-sm font-medium truncate mb-1">
                  {timelapse.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timelapse.date}
                  </div>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                    {formatFileSize(timelapse.size)}
                  </Badge>
                </div>
              </div>
            </div>
          </DialogTrigger>
          
          <VideoModal timelapse={timelapse} />
        </Dialog>
      ))}
    </div>
  )
}

export default function TimelapseCard() {
  const [timelapses, setTimelapses] = useState<TimelapseFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTimelapses = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/timelapse/list', { cache: 'no-store' })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch timelapses: ${response.status}`)
        }
        
        const data: TimelapseResponse = await response.json()
        setTimelapses(data.timelapse)
      } catch (error) {
        console.error('Error fetching timelapses:', error)
        setError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTimelapses()
  }, [])

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-500" />
            Timelapse Videos
          </CardTitle>
          {!loading && !error && (
            <Badge variant="secondary" className="text-xs">
              {timelapses.length} video{timelapses.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <span className="ml-3 text-muted-foreground">Loading timelapses...</span>
          </div>
        )}
        
        {error && (
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">Failed to load timelapses</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        )}
        
        {!loading && !error && (
          <TimelapseGrid timelapses={timelapses} />
        )}
      </CardContent>
    </Card>
  )
}