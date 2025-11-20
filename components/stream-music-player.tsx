"use client"

import { useEffect, useRef, useState, useCallback } from 'react'

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
  const hasStartedCrossfadeRef = useRef(false)

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
    if (audioRef.current && !isCrossfading) {
      audioRef.current.volume = volume / 100
    }
    if (nextAudioRef.current && isCrossfading) {
      // During crossfade, volume is managed by the crossfade logic
      return
    }
  }, [volume, isCrossfading])

  // Start crossfade to next track
  const startCrossfade = useCallback((nextIndex: number) => {
    if (!crossfadeEnabled || !audioRef.current || !nextAudioRef.current || isCrossfading) {
      // If crossfade disabled, just switch tracks normally
      setCurrentTrackIndex(nextIndex)
      hasStartedCrossfadeRef.current = false
      return
    }

    console.log('[Music Player] Starting crossfade to track index:', nextIndex)
    setIsCrossfading(true)
    hasStartedCrossfadeRef.current = true
    
    const currentAudio = audioRef.current
    const nextAudio = nextAudioRef.current
    const targetVolume = volume / 100
    
    // Load next track
    const nextTrack = playlist[nextIndex]
    nextAudio.src = `/music/${nextTrack}`
    nextAudio.volume = 0
    nextAudio.load()

    // Start playing next track at 0 volume
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
          if (currentAudio && !currentAudio.paused) {
            currentAudio.volume = Math.max(0, targetVolume * (1 - progress))
          }
          
          // Fade in next track
          if (nextAudio && !nextAudio.paused) {
            nextAudio.volume = Math.min(targetVolume, targetVolume * progress)
          }
          
          // When crossfade complete
          if (step >= steps) {
            if (crossfadeIntervalRef.current) {
              clearInterval(crossfadeIntervalRef.current)
              crossfadeIntervalRef.current = null
            }
            
            console.log('[Music Player] Crossfade complete, switching to next track')
            
            // Pause and reset current track
            if (currentAudio) {
              currentAudio.pause()
              currentAudio.currentTime = 0
              currentAudio.volume = targetVolume
            }
            
            // Swap the audio elements: next becomes current
            if (audioRef.current && nextAudioRef.current) {
              const tempSrc = audioRef.current.src
              audioRef.current.src = nextAudio.src
              audioRef.current.currentTime = nextAudio.currentTime
              audioRef.current.volume = targetVolume
              
              // Clear next audio
              nextAudio.pause()
              nextAudio.currentTime = 0
              nextAudio.src = ''
            }
            
            // Update state
            setCurrentTrackIndex(nextIndex)
            setIsCrossfading(false)
            hasStartedCrossfadeRef.current = false
          }
        }, intervalMs)
      })
      .catch(error => {
        console.error('[Music Player] Error during crossfade:', error)
        setIsCrossfading(false)
        hasStartedCrossfadeRef.current = false
        // Fallback to normal track change
        setCurrentTrackIndex(nextIndex)
      })
  }, [crossfadeEnabled, isCrossfading, volume, playlist, crossfadeDuration])

  // Handle track end - move to next track or loop
  const handleTrackEnd = useCallback(() => {
    if (!enabled || playlist.length === 0 || isCrossfading) {
      console.log('[Music Player] Track ended but not progressing:', { enabled, playlistLength: playlist.length, isCrossfading })
      return
    }

    console.log('[Music Player] Track ended, moving to next track')
    const isLastTrack = currentTrackIndex === playlist.length - 1
    
    if (isLastTrack) {
      if (loop) {
        // Loop back to first track
        if (crossfadeEnabled && crossfadeDuration > 0) {
          startCrossfade(0)
        } else {
          setCurrentTrackIndex(0)
          hasStartedCrossfadeRef.current = false
        }
      } else {
        // Stop at the end
        console.log('[Music Player] Reached end of playlist, stopping')
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
        hasStartedCrossfadeRef.current = false
      }
    }
  }, [enabled, playlist.length, isCrossfading, currentTrackIndex, loop, crossfadeEnabled, crossfadeDuration, startCrossfade])

  // Start crossfade before track ends if crossfade is enabled
  useEffect(() => {
    if (!enabled || !audioRef.current || !crossfadeEnabled || crossfadeDuration <= 0 || playlist.length === 0) {
      return
    }
    
    const audio = audioRef.current
    
    const handleTimeUpdate = () => {
      if (!audio || isCrossfading || playlist.length === 0 || hasStartedCrossfadeRef.current) {
        return
      }
      
      const timeRemaining = audio.duration - audio.currentTime
      
      // Start crossfade when time remaining equals crossfade duration
      // Add a small buffer (0.1s) to ensure we catch it
      if (timeRemaining > 0 && timeRemaining <= crossfadeDuration + 0.1 && !hasStartedCrossfadeRef.current) {
        const isLastTrack = currentTrackIndex === playlist.length - 1
        
        if (isLastTrack && !loop) {
          // Don't crossfade at the end if not looping
          console.log('[Music Player] Last track, not looping, skipping crossfade')
          return
        }
        
        const nextIndex = isLastTrack ? 0 : currentTrackIndex + 1
        console.log('[Music Player] Time to crossfade! Time remaining:', timeRemaining, 'Next index:', nextIndex)
        startCrossfade(nextIndex)
      }
    }
    
    audio.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [enabled, crossfadeEnabled, crossfadeDuration, currentTrackIndex, isCrossfading, playlist.length, loop, startCrossfade])

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
    // Don't reload if we're in the middle of a crossfade
    if (isCrossfading) {
      console.log('[Music Player] Skipping track load during crossfade')
      return
    }

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
