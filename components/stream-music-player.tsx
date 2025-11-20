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
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Handle track end - move to next track or loop
  const handleTrackEnd = () => {
    if (!enabled || playlist.length === 0) {
      console.log('[Music Player] Track ended but not progressing:', { enabled, playlistLength: playlist.length })
      return
    }

    console.log('[Music Player] Track ended, moving to next track')
    const isLastTrack = currentTrackIndex === playlist.length - 1
    
    if (isLastTrack) {
      if (loop) {
        // Loop back to first track
        setCurrentTrackIndex(0)
      } else {
        // Stop at the end
        console.log('[Music Player] Reached end of playlist, stopping')
        if (audioRef.current) {
          audioRef.current.pause()
        }
      }
    } else {
      // Move to next track
      setCurrentTrackIndex(currentTrackIndex + 1)
    }
  }

  // Handle track changes
  useEffect(() => {
    if (audioRef.current && enabled && playlist.length > 0) {
      const currentTrack = playlist[currentTrackIndex]
      const currentSrc = audioRef.current.src
      const newSrc = `/music/${currentTrack}`
      
      // Only reload if the source is actually different
      if (currentSrc && currentSrc.endsWith(newSrc)) {
        console.log('[Music Player] Track already loaded:', currentTrack)
        // Make sure it's playing
        if (audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            if (error.name === 'NotAllowedError') {
              console.log('[Music Player] Autoplay blocked - waiting for user interaction')
              setNeedsInteraction(true)
            } else {
              console.error('[Music Player] Error playing existing track:', error)
            }
          })
        }
        return
      }
      
      console.log('[Music Player] Loading new track:', currentTrack, 'Volume:', volume)
      audioRef.current.src = newSrc
      audioRef.current.volume = volume / 100
      
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
