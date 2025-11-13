import crypto from 'crypto'
import type { PrinterStatus } from './types'

export interface GuestbookEntry {
  id: number
  name: string
  email: string
  message: string
  printer_status: string
  print_filename?: string
  print_progress: number
  created_at: string
  updated_at: string
  gravatar_url?: string
}

export interface CreateGuestbookEntry {
  name: string
  email: string
  message: string
  printer_status: string
  print_filename?: string
  print_progress: number
}

// Generate Gravatar URL from email
export function generateGravatarUrl(email: string, size: number = 128): string {
  const hash = crypto
    .createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex')
  
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon&r=pg`
}

// Format timestamp for display
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }
  
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  
  // For older dates, show the actual date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

// Format absolute timestamp
export function formatAbsoluteTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Sanitize and validate message content
export function sanitizeMessage(message: string): string {
  // Remove any HTML tags and limit length
  const cleaned = message.replace(/<[^>]*>/g, '').trim()
  return cleaned.substring(0, 500) // Limit to 500 characters
}

// Validate name
export function isValidName(name: string): boolean {
  const cleaned = name.trim()
  return cleaned.length >= 2 && cleaned.length <= 50
}

// Extract printer status info for guestbook entry
export function extractPrinterInfo(printerStatus: PrinterStatus | null): {
  status: string
  filename?: string
  progress: number
} {
  if (!printerStatus || printerStatus.print.state === 'offline') {
    return {
      status: 'offline',
      filename: undefined,
      progress: 0
    }
  }

  const status = printerStatus.print.state
  const filename = printerStatus.print.filename || undefined
  const progress = Math.round(printerStatus.print.progress * 100)

  return {
    status,
    filename,
    progress
  }
}

// Get status badge styling
export function getStatusBadgeStyle(status: string): {
  className: string
  label: string
} {
  switch (status) {
    case 'printing':
      return {
        className: 'bg-amber-600/10 dark:bg-amber-600/20 text-amber-500 border-amber-600/60',
        label: 'Printing'
      }
    case 'complete':
      return {
        className: 'bg-emerald-600/10 dark:bg-emerald-600/20 text-emerald-500 border-emerald-600/60',
        label: 'Complete'
      }
    case 'cancelled':
      return {
        className: 'bg-gray-600/10 dark:bg-gray-600/20 text-gray-500 border-gray-600/60',
        label: 'Cancelled'
      }
    case 'ready':
      return {
        className: 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-500 border-blue-600/60',
        label: 'Ready'
      }
    case 'offline':
      return {
        className: 'bg-red-600/10 dark:bg-red-600/20 text-red-500 border-red-600/60',
        label: 'Offline'
      }
    default:
      return {
        className: 'bg-gray-600/10 dark:bg-gray-600/20 text-gray-500 border-gray-600/60',
        label: 'Unknown'
      }
  }
}

// Add gravatar URL to guestbook entries
export function enrichGuestbookEntries(entries: GuestbookEntry[]): GuestbookEntry[] {
  return entries.map(entry => ({
    ...entry,
    gravatar_url: generateGravatarUrl(entry.email)
  }))
}