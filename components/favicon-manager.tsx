"use client"

import { useEffect } from 'react'

interface FaviconManagerProps {
  status: 'printing' | 'ready' | 'offline' | 'error' | 'paused' | 'complete' | 'cancelled'
}

export function FaviconManager({ status }: FaviconManagerProps) {
  useEffect(() => {
    // Update favicon based on status
    const updateFavicon = () => {
      // Remove existing dynamic favicon links
      const existingLinks = document.querySelectorAll('link[rel="icon"][data-dynamic="true"]')
      existingLinks.forEach(link => link.remove())

      // Determine which favicon set to use based on status
      let faviconSuffix = 'ready'
      switch (status) {
        case 'printing':
          faviconSuffix = 'printing'
          break
        case 'cancelled':
          faviconSuffix = 'cancelled'
          break
        case 'offline':
        case 'error':
          faviconSuffix = 'offline'
          break
        case 'ready':
          faviconSuffix = 'ready'
          break
        case 'complete':
        case 'paused':
        default:
          faviconSuffix = 'ready'
          break
      }

      // Create favicon links for different sizes
      const sizes = [
        { size: '16x16', file: `favicon-${faviconSuffix}-16x16.png` },
        { size: '32x32', file: `favicon-${faviconSuffix}-32x32.png` },
        { size: '48x48', file: `favicon-${faviconSuffix}-48x48.png` }
      ]

      sizes.forEach(({ size, file }) => {
        const link = document.createElement('link')
        link.rel = 'icon'
        link.type = 'image/png'
        link.sizes = size
        link.href = `/${file}?t=${Date.now()}` // Add timestamp to prevent caching
        link.setAttribute('data-dynamic', 'true')
        document.head.appendChild(link)
      })

      // Update apple touch icon
      const appleLink = document.querySelector('link[rel="apple-touch-icon"]')
      if (appleLink) {
        appleLink.setAttribute('href', `/apple-touch-icon-${faviconSuffix}.png?t=${Date.now()}`)
      } else {
        // Create apple touch icon if it doesn't exist
        const newAppleLink = document.createElement('link')
        newAppleLink.rel = 'apple-touch-icon'
        newAppleLink.href = `/apple-touch-icon-${faviconSuffix}.png?t=${Date.now()}`
        newAppleLink.setAttribute('data-dynamic', 'true')
        document.head.appendChild(newAppleLink)
      }
    }

    updateFavicon()
  }, [status])

  return null // This component doesn't render anything
}