"use client"

import { useEffect, useRef, useState } from 'react'

interface StreamMusicPlayerProps {
  enabled: boolean
  volume: number // 0-100
  playlist: string[]
  loop: boolean
}

export function StreamMusicPlayer({ 
  enabled, 
  volume, 
  playlist, 
  loop 
}: StreamMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [needsInteraction, setNeedsInteraction] = useState(false)

  // Listen for user interaction if autoplay is blocked
  useEffect(() => {
    if (!needsInteraction) return

    const handleInteraction = () => {
      setNeedsInteraction(false)
      // Try playing again after interaction
      if (audioRef.current && enabled && playlist.length > 0) {
        audioRef.current.play().catch(console.error)
      }
    }

    // Listen for any user interaction
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('keydown', handleInteraction, { once: true })
    window.addEventListener('touchstart', handleInteraction, { once: true })

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [needsInteraction, enabled, playlist])

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      // Convert volume from 0-100 to 0-1 for HTML5 audio
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Handle track changes
  useEffect(() => {
    if (audioRef.current && enabled && playlist.length > 0) {
      const currentTrack = playlist[currentTrackIndex]
      audioRef.current.src = `/music/${currentTrack}`
      
      console.log('[Music Player] Loading track:', currentTrack, 'Volume:', volume)
      
      // Always try to autoplay - if it fails, we'll request user interaction
      audioRef.current.play()
        .then(() => {
          console.log('[Music Player] Playing successfully')
          setNeedsInteraction(false)
        })
        .catch(error => {
          if (error.name === 'NotAllowedError') {
            console.log('[Music Player] Autoplay blocked - waiting for user interaction')
            setNeedsInteraction(true)
          } else {
            console.error('[Music Player] Error auto-playing music:', error)
          }
        })
    }
  }, [currentTrackIndex, enabled, playlist, volume])

  // Handle play/pause based on enabled state
  useEffect(() => {
    if (audioRef.current) {
      if (enabled && playlist.length > 0 && !needsInteraction) {
        audioRef.current.play().catch(error => {
          if (error.name === 'NotAllowedError') {
            console.log('[Music Player] Playback blocked - waiting for user interaction')
            setNeedsInteraction(true)
          } else {
            console.error('[Music Player] Error playing music:', error)
          }
        })
      } else {
        audioRef.current.pause()
      }
    }
  }, [enabled, playlist, needsInteraction])

  // Handle track end - move to next track or loop
  const handleTrackEnd = () => {
    if (!enabled || playlist.length === 0) return

    const isLastTrack = currentTrackIndex === playlist.length - 1
    
    if (isLastTrack) {
      if (loop) {
        // Loop back to first track
        setCurrentTrackIndex(0)
      } else {
        // Stop at the end
        if (audioRef.current) {
          audioRef.current.pause()
        }
      }
    } else {
      // Move to next track
      setCurrentTrackIndex(currentTrackIndex + 1)
    }
  }

  // Don't render audio element if music is disabled or playlist is empty
  if (!enabled || playlist.length === 0) {
    return null
  }

  return (
    <audio 
      ref={audioRef}
      onEnded={handleTrackEnd}
      preload="auto"
      style={{ display: 'none' }}
    />
  )
}
