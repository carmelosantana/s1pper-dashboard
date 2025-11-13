'use client'

import { useEffect } from 'react'
import Script from 'next/script'

interface UmamiAnalyticsProps {
  websiteId?: string
  hostUrl?: string
}

declare global {
  interface Window {
    umami?: {
      track: (event?: string | object | ((props: any) => object), data?: object) => void
      identify: (id?: string | object, data?: object) => void
    }
  }
}

export default function UmamiAnalytics({ websiteId, hostUrl }: UmamiAnalyticsProps) {
  // Don't load analytics in development unless explicitly enabled
  const isDevelopment = process.env.NODE_ENV === 'development'
  const enableInDev = process.env.NEXT_PUBLIC_UMAMI_DEV === 'true'
  
  if (isDevelopment && !enableInDev) {
    return null
  }

  if (!websiteId || !hostUrl) {
    console.warn('Umami: Missing websiteId or hostUrl configuration')
    return null
  }

  const scriptSrc = `${hostUrl}/script.js`

  return (
    <>
      <Script
        src={scriptSrc}
        data-website-id={websiteId}
        data-domains="s1pper.carmelosantana.cloud,localhost"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Umami analytics loaded successfully')
        }}
        onError={(e) => {
          console.error('Failed to load Umami analytics:', e)
        }}
      />
    </>
  )
}

// Utility functions for tracking events
export const trackEvent = (eventName: string, data?: object) => {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(eventName, data)
  }
}

export const trackPageView = (url?: string, title?: string) => {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track({ url, title })
  }
}

export const identifyUser = (userId?: string, userData?: object) => {
  if (typeof window !== 'undefined' && window.umami) {
    if (userId && userData) {
      window.umami.identify(userId, userData)
    } else if (userId) {
      window.umami.identify(userId)
    } else if (userData) {
      window.umami.identify(userData)
    }
  }
}