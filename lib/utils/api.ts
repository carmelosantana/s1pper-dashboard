/**
 * API utility functions
 * Centralized functions for making API requests with consistent patterns
 */

import { getBaseUrl } from './environment'

/**
 * Fetch options with no caching for real-time data
 */
export const NO_CACHE_OPTIONS: RequestInit = {
  cache: 'no-store',
  next: { revalidate: 0 }
}

/**
 * Fetch printer status from the API
 * @returns PrinterStatus object or null if fetch fails
 */
export async function fetchPrinterStatus() {
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/printer/status`, NO_CACHE_OPTIONS)
    
    if (!response.ok) {
      console.error('Failed to fetch printer status:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching printer status:', error)
    return null
  }
}

/**
 * Fetch temperature history from the API
 * @returns TemperatureHistory object or null if fetch fails
 */
export async function fetchTemperatureHistory() {
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/printer/temperature-history`, NO_CACHE_OPTIONS)
    
    if (!response.ok) {
      console.error('Failed to fetch temperature history:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching temperature history:', error)
    return null
  }
}

/**
 * Fetch lifetime statistics from the API
 * @returns LifetimeStats object or null if fetch fails
 */
export async function fetchLifetimeStats() {
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/printer/lifetime-stats`, NO_CACHE_OPTIONS)
    
    if (!response.ok) {
      console.error('Failed to fetch lifetime stats:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching lifetime stats:', error)
    return null
  }
}

/**
 * Fetch dashboard settings from the API
 * @returns Dashboard settings or null if fetch fails
 */
export async function fetchDashboardSettings() {
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/settings`, NO_CACHE_OPTIONS)
    
    if (!response.ok) {
      console.error('Failed to fetch dashboard settings:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching dashboard settings:', error)
    return null
  }
}

/**
 * Generic fetch helper with error handling
 * @param endpoint - API endpoint to fetch from
 * @param options - Fetch options
 * @returns Response JSON or null if fetch fails
 */
export async function apiFetch<T = any>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const baseUrl = getBaseUrl()
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`
    const response = await fetch(url, { ...NO_CACHE_OPTIONS, ...options })
    
    if (!response.ok) {
      console.error(`API fetch failed for ${endpoint}:`, response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    return null
  }
}
