'use client'

import { useRef, useCallback, useEffect } from 'react'

/**
 * Returns a stable callback reference that always calls the latest version
 * of the provided function. This is useful for callbacks passed to memoized
 * components or used in useEffect dependencies.
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback)
  
  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  
  // Return a stable function that calls the current ref
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  )
}

/**
 * Creates a stable event handler that doesn't change between renders
 * but always has access to the latest props/state
 */
export function useEventCallback<T extends (...args: unknown[]) => unknown>(
  handler: T
): T {
  const handlerRef = useRef<T>(handler)
  
  // Update ref synchronously to avoid stale closures
  handlerRef.current = handler
  
  return useCallback(
    ((...args) => {
      return handlerRef.current?.(...args)
    }) as T,
    []
  )
}
