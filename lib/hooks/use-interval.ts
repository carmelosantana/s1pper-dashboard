'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for running intervals with proper cleanup
 * Uses refs to always have access to the latest callback without re-creating the interval
 */
export function useInterval(
  callback: () => void | Promise<void>,
  delay: number | null,
  options?: {
    immediate?: boolean // Run callback immediately on mount
    enabled?: boolean // Allow disabling the interval
  }
) {
  const { immediate = false, enabled = true } = options || {}
  const savedCallback = useRef(callback)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])
  
  // Set up the interval
  useEffect(() => {
    if (delay === null || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    
    // Run immediately if requested
    if (immediate) {
      savedCallback.current()
    }
    
    intervalRef.current = setInterval(() => {
      savedCallback.current()
    }, delay)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [delay, immediate, enabled])
  
  // Return a function to manually trigger the callback
  const trigger = useCallback(() => {
    savedCallback.current()
  }, [])
  
  return trigger
}

/**
 * Hook for polling data at regular intervals
 * Includes loading state and error handling
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number,
  options?: {
    enabled?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  }
) {
  const { enabled = true, onSuccess, onError } = options || {}
  const fetcherRef = useRef(fetcher)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  
  // Keep refs updated
  useEffect(() => {
    fetcherRef.current = fetcher
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  }, [fetcher, onSuccess, onError])
  
  const poll = useCallback(async () => {
    try {
      const data = await fetcherRef.current()
      onSuccessRef.current?.(data)
    } catch (error) {
      onErrorRef.current?.(error as Error)
    }
  }, [])
  
  useInterval(poll, interval, { immediate: true, enabled })
  
  return poll
}
