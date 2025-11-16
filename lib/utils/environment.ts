/**
 * Environment utility functions
 * Centralized functions for checking the application environment
 */

/**
 * Check if the application is running in development mode
 * @returns true if NODE_ENV is 'development', false otherwise
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if the application is running in production mode
 * @returns true if NODE_ENV is 'production', false otherwise
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Get the current environment name
 * @returns The current NODE_ENV value or 'development' as default
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || 'development'
}

/**
 * Get the base URL for the application
 * Uses NEXT_PUBLIC_APP_URL or falls back to Vercel URL in production, localhost in development
 * @returns The base URL for API requests
 */
export function getBaseUrl(): string {
  // Check for explicit NEXT_PUBLIC_APP_URL first
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  
  // In production, use Vercel URL if available, otherwise fallback to localhost:3000
  if (isProduction()) {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
  }
  
  // Development default
  return 'http://localhost:3000'
}
