"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Send, User, Clock, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  formatTimeAgo, 
  formatAbsoluteTime, 
  getStatusBadgeStyle,
  type GuestbookEntry 
} from '@/lib/guestbook'

interface GuestbookCardProps {
  className?: string
}

interface GuestbookResponse {
  entries: GuestbookEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export default function GuestbookCard({ className }: GuestbookCardProps) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  
  const formRef = useRef<HTMLFormElement>(null)
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Load user data from session storage
  useEffect(() => {
    const savedName = sessionStorage.getItem('guestbook_name')
    const savedEmail = sessionStorage.getItem('guestbook_email')
    
    if (savedName || savedEmail) {
      setFormData(prev => ({
        ...prev,
        name: savedName || '',
        email: savedEmail || ''
      }))
    }
  }, [])

  // Save user data to session storage
  const saveUserData = () => {
    if (formData.name) sessionStorage.setItem('guestbook_name', formData.name)
    if (formData.email) sessionStorage.setItem('guestbook_email', formData.email)
  }

  // Fetch guestbook entries
  const fetchEntries = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/guestbook?page=${page}&limit=10`)
      
      if (response.status === 503) {
        // Database not available - set as unavailable
        setIsAvailable(false)
        setError(null)
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch entries')
      }
      
      const data: GuestbookResponse = await response.json()
      setEntries(data.entries)
      setPagination(data.pagination)
      setIsAvailable(true)
      setError(null)
    } catch (error) {
      console.error('Error fetching guestbook entries:', error)
      setError('Failed to load guestbook entries')
      setIsAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  // Submit new entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please fill in all fields')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit entry')
      }

      const result = await response.json()
      
      // Save user data for next time
      saveUserData()
      
      // Clear form
      setFormData(prev => ({ ...prev, message: '' }))
      setShowForm(false)
      
      // Refresh entries (go to first page to see new entry)
      await fetchEntries(1)
      
    } catch (error) {
      console.error('Error submitting guestbook entry:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit entry')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchEntries(newPage)
    }
  }

  // Delete entry
  const handleDelete = async (entryId: number) => {
    setDeletingId(entryId)
    setError(null)

    try {
      const response = await fetch(`/api/guestbook/${entryId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete entry')
      }

      // Refresh entries
      await fetchEntries(pagination.page)
      
    } catch (error) {
      console.error('Error deleting guestbook entry:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  // Initial load
  useEffect(() => {
    fetchEntries()
  }, [])

  // Don't render the card if guestbook is not available
  if (isAvailable === false) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-3">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Visitor Guestbook</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5"
          >
            {showForm ? 'Cancel' : 'Sign Guestbook'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* New Entry Form */}
        {showForm && (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-zinc-300 mb-1">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Leave a message about your visit..."
                required
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Sign Guestbook
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2 text-sm text-zinc-400">Loading entries...</span>
          </div>
        ) : error && entries.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-red-400 text-sm">{error}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchEntries()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No entries yet. Be the first to sign the guestbook!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const statusStyle = getStatusBadgeStyle(entry.printer_status)
              
              return (
                <div key={entry.id} className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {entry.gravatar_url ? (
                        <img
                          src={entry.gravatar_url}
                          alt={entry.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{entry.name}</span>
                          <Badge 
                            className={`text-xs px-2 py-0.5 shadow-none rounded-full ${statusStyle.className}`}
                          >
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <div className="flex items-center text-xs text-zinc-500 space-x-2">
                          <Clock className="w-3 h-3" />
                          <span title={formatAbsoluteTime(entry.created_at)}>
                            {formatTimeAgo(entry.created_at)}
                          </span>
                          {isDevelopment && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-600/20"
                                  disabled={deletingId === entry.id}
                                >
                                  {deletingId === entry.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this guestbook entry from {entry.name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(entry.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-zinc-300 leading-relaxed mb-2">
                        {entry.message}
                      </p>
                      
                      {/* Printer Status Details */}
                      {(entry.print_filename || entry.print_progress > 0) && (
                        <div className="text-xs text-zinc-500">
                          {entry.print_filename && (
                            <span>Printing: {entry.print_filename}</span>
                          )}
                          {entry.print_progress > 0 && (
                            <span className="ml-2">({entry.print_progress}% complete)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total entries)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="text-xs px-3 py-1.5"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="text-xs px-3 py-1.5"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}