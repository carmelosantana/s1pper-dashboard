'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { Rnd } from 'react-rnd'
import { X, Maximize2, Minimize2 } from 'lucide-react'

export interface FloatingWindowPosition {
  x: number
  y: number
}

export interface FloatingWindowSize {
  width: number
  height: number
}

export interface FloatingWindowProps {
  id: string
  title: string
  children: React.ReactNode
  defaultPosition?: FloatingWindowPosition
  defaultSize?: FloatingWindowSize
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  onClose?: () => void
  onFocus?: (id: string) => void
  zIndex?: number
  showControls?: boolean
  resizable?: boolean
  className?: string
}

// Window styling for the floating container
const windowStyles = {
  container: {
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  header: {
    background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)',
    borderBottom: '1px solid #444',
    padding: '8px 12px',
    cursor: 'move',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  controlButton: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    color: '#999',
    backgroundColor: 'transparent',
    border: 'none',
  },
  content: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
}

export const FloatingWindow = memo(function FloatingWindow({
  id,
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 320, height: 240 },
  minWidth = 200,
  minHeight = 150,
  maxWidth = 1920,
  maxHeight = 1080,
  onClose,
  onFocus,
  zIndex = 1000,
  showControls = true,
  resizable = true,
  className = '',
}: FloatingWindowProps) {
  const [position, setPosition] = useState<FloatingWindowPosition>(defaultPosition)
  const [size, setSize] = useState<FloatingWindowSize>(defaultSize)
  const [isMaximized, setIsMaximized] = useState(false)
  const previousState = useRef({ position, size })

  const handleMouseDown = useCallback(() => {
    onFocus?.(id)
  }, [id, onFocus])

  const handleDragStop = useCallback((_e: unknown, d: { x: number; y: number }) => {
    if (!isMaximized) {
      setPosition({ x: d.x, y: d.y })
    }
  }, [isMaximized])

  const handleResizeStop = useCallback((_e: unknown, _direction: unknown, ref: HTMLElement, _delta: unknown, pos: { x: number; y: number }) => {
    if (!isMaximized) {
      setSize({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      })
      setPosition(pos)
    }
  }, [isMaximized])

  const handleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore previous state
      setPosition(previousState.current.position)
      setSize(previousState.current.size)
    } else {
      // Save current state and maximize
      previousState.current = { position, size }
      setPosition({ x: 0, y: 0 })
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    setIsMaximized(!isMaximized)
  }, [isMaximized, position, size])

  const handleClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  return (
    <Rnd
      size={size}
      position={position}
      onDragStart={handleMouseDown}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      bounds="window"
      dragHandleClassName="floating-window-header"
      enableResizing={resizable && !isMaximized}
      disableDragging={isMaximized}
      style={{
        zIndex,
        ...windowStyles.container,
      }}
      className={`floating-window ${className}`}
    >
      <div className="flex flex-col h-full" onMouseDown={handleMouseDown}>
        {/* Header / Drag Handle */}
        <div className="floating-window-header" style={windowStyles.header}>
          <span style={windowStyles.title}>{title}</span>
          {showControls && (
            <div style={windowStyles.controls}>
              <button
                onClick={handleMaximize}
                style={windowStyles.controlButton}
                className="hover:bg-white/10"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3 h-3" />
                ) : (
                  <Maximize2 className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={handleClose}
                style={{
                  ...windowStyles.controlButton,
                }}
                className="hover:bg-red-500/80 hover:text-white"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {/* Content */}
        <div style={windowStyles.content} className="flex-1">
          {children}
        </div>
      </div>
    </Rnd>
  )
})

export default FloatingWindow
