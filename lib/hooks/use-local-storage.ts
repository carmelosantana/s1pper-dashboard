'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook for managing state that persists to localStorage
 * Includes debounced writes to prevent excessive storage operations
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  options?: {
    debounceMs?: number
    validate?: (value: unknown) => boolean
  }
): [T, (value: T | ((prev: T) => T)) => void] {
  const { debounceMs = 0, validate } = options || {}
  
  // Use lazy initialization to avoid reading localStorage on every render
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (validate && !validate(parsed)) {
          return defaultValue
        }
        return parsed
      }
    } catch (e) {
      console.error(`Failed to parse localStorage key "${key}":`, e)
    }
    return defaultValue
  })
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(prev)
        : value
      
      // Debounced write to localStorage
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      if (debounceMs > 0) {
        timeoutRef.current = setTimeout(() => {
          localStorage.setItem(key, JSON.stringify(newValue))
        }, debounceMs)
      } else {
        localStorage.setItem(key, JSON.stringify(newValue))
      }
      
      return newValue
    })
  }, [key, debounceMs])
  
  return [state, setValue]
}

/**
 * Hook for managing boolean toggle state with localStorage persistence
 */
export function useLocalStorageToggle(
  key: string,
  defaultValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useLocalStorageState(key, defaultValue)
  
  const toggle = useCallback(() => {
    setValue(prev => !prev)
  }, [setValue])
  
  return [value, toggle, setValue]
}
