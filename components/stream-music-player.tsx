"use client"

import { useEffect, useRef, useState } from 'react'

interface StreamMusicPlayerProps {
  enabled: boolean
  volume: number // 0-100
  playlist: string[]
  loop: boolean
  crossfadeEnabled: boolean
  crossfadeDuration: number // 0-10 seconds
}

export function StreamMusicPlayer({ 
  enabled, 
  volume, 
  playlist, 
  loop,
  crossfadeEnabled,
  crossfadeDuration
}: StreamMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const nextAudioRef = useRef<HTMLAudioElement>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [needsInteraction, setNeedsInteraction] = useState(false)
  const [isCrossfading, setIsCrossfading] = useState(false)
  const crossfadeIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
    if (nextAudioRef.current) {
      nextAudioRef.current.volume = 0 // Will be adjusted during crossfade
    }
  }, [volume])

  // Start crossfade to next track
  const startCrossfade = (nextIndex: number) => {
    if (!crossfadeEnabled || !audioRef.current || !nextAudioRef.current || isCrossfading) {
      // If crossfade disabled, just switch tracks normally
      setCurrentTrackIndex(nextIndex)
      return
    }

    setIsCrossfading(true)
    const currentAudio = audioRef.current
    const nextAudio = nextAudioRef.current
    const targetVolume = volume / 100
    
    // Load next track
    const nextTrack = playlist[nextIndex]
    nextAudio.src = `/music/${nextTrack}`
    nextAudio.load()

    // Start playing next track at 0 volume
    nextAudio.volume = 0
    nextAudio.play()
      .then(() => {
        console.log('[Music Player] Crossfade started to:', nextTrack)
        
        // Crossfade over the specified duration
        const steps = 50 // Number of volume adjustments
        const intervalMs = (crossfadeDuration * 1000) / steps
        let step = 0
        
        crossfadeIntervalRef.current = setInterval(() => {
          step++
          const progress = step / steps
          
          // Fade out current track
          if (currentAudio) {
            currentAudio.volume = Math.max(0, targetVolume * (1 - progress))
          }
          
          // Fade in next track
          if (nextAudio) {
            nextAudio.volume = Math.min(targetVolume, targetVolume * progress)
          }
          
          // When crossfade complete
          if (step >= steps) {
            if (crossfadeIntervalRef.current) {
              clearInterval(crossfadeIntervalRef.current)
              crossfadeIntervalRef.current = null
            }
            
            // Pause and reset current track
            if (currentAudio) {
              currentAudio.pause()
              currentAudio.currentTime = 0
            }
            
            // Make next track the current track
            setCurrentTrackIndex(nextIndex)
            setIsCrossfading(false)
            
            console.log('[Music Player] Crossfade complete')
          }
        }, intervalMs)
      })
      .catch(error => {
        console.error('[Music Player] Error during crossfade:', error)
        setIsCrossfading(false)
        // Fallback to normal track change
        setCurrentTrackIndex(nextIndex)
      })
  }

  // Handle track end - move to next track or loop
  const handleTrackEnd = () => {
    if (!enabled || playlist.length === 0 || isCrossfading) return

    const isLastTrack = currentTrackIndex === playlist.length - 1
    
    if (isLastTrack) {
      if (loop) {
        // Loop back to first track
        if (crossfadeEnabled && crossfadeDuration > 0) {
          startCrossfade(0)
        } else {
          setCurrentTrackIndex(0)
        }
      } else {
        // Stop at the end
        if (audioRef.current) {
          audioRef.current.pause()
        }
      }
    } else {
      // Move to next track
      const nextIndex = currentTrackIndex + 1
      if (crossfadeEnabled && crossfadeDuration > 0) {
        startCrossfade(nextIndex)
      } else {
        setCurrentTrackIndex(nextIndex)
      }
    }
  }

  // Start crossfade before track ends if crossfade is enabled
  useEffect(() => {
    if (!audioRef.current || !crossfadeEnabled || crossfadeDuration <= 0) return
    
    const audio = audioRef.current
    
    const handleTimeUpdate = () => {
      if (!audio || isCrossfading || playlist.length === 0) return
      
      const timeRemaining = audio.duration - audio.currentTime
      
      // Start crossfade when time remaining equals crossfade duration
      if (timeRemaining > 0 && timeRemaining <= crossfadeDuration && !isCrossfading) {
        const isLastTrack = currentTrackIndex === playlist.length - 1
        
        if (isLastTrack && !loop) {
          // Don't crossfade at the end if not looping
          return
        }
        
        const nextIndex = isLastTrack ? 0 : currentTrackIndex + 1
        startCrossfade(nextIndex)
      }
    }
    
    audio.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [audioRef.current, crossfadeEnabled, crossfadeDuration, currentTrackIndex, isCrossfading, playlist.length, loop])

  // Cleanup crossfade interval on unmount
  useEffect(() => {
    return () => {
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current)
      }
    }
  }, [])

  // Handle track changes
  useEffect(() => {
    if (audioRef.current && enabled && playlist.length > 0 && !isCrossfading) {
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
  }, [currentTrackIndex, enabled, playlist, volume, isCrossfading])

  // Handle play/pause based on enabled state
  useEffect(() => {
    if (audioRef.current && !isCrossfading) {
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
  }, [enabled, playlist, needsInteraction, isCrossfading])

  // Don't render audio element if music is disabled or playlist is empty
  if (!enabled || playlist.length === 0) {
    return null
  }

  return (
    <>
      <audio 
        ref={audioRef}
        onEnded={handleTrackEnd}
        preload="auto"
        style={{ display: 'none' }}
      />
      {/* Second audio element for crossfading */}
      <audio 
        ref={nextAudioRef}
        preload="auto"
        style={{ display: 'none' }}
      />
    </>
  )
}
