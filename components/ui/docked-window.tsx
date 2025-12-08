'use client'

import { memo, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { Resizable } from 're-resizable'

export type DockedPosition = 'above' | 'below'

export interface DockedWindowProps {
  id: string
  title: string
  children: React.ReactNode
  onClose?: () => void
  position: DockedPosition
  className?: string
  defaultHeight?: number
  defaultWidth?: number | string
  minHeight?: number
  maxHeight?: number
  onHeightChange?: (height: number) => void
  onSizeChange?: (id: string, width: number | string, height: number) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export interface DockedWindowContainerProps {
  children: React.ReactNode
  position: DockedPosition
  maxWindows?: number
  className?: string
}

// Styling for docked windows
const windowStyles = {
  container: {
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  header: {
    background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)',
    borderBottom: '1px solid #444',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  closeButton: {
    width: '18px',
    height: '18px',
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
    position: 'relative' as const,
  },
}

// Individual docked window with resizable height
export const DockedWindow = memo(function DockedWindow({
  id,
  title,
  children,
  onClose,
  position,
  className = '',
  defaultHeight = 300,
  defaultWidth = '100%',
  minHeight = 150,
  maxHeight = 800,
  onHeightChange,
  onSizeChange,
  dragHandleProps,
}: DockedWindowProps) {
  const [height, setHeight] = useState(defaultHeight)
  const [width, setWidth] = useState<number | string>(defaultWidth)

  const handleResizeStop = useCallback((_e: unknown, _direction: unknown, ref: HTMLElement, _d: unknown) => {
    const newHeight = ref.offsetHeight
    const newWidth = ref.offsetWidth
    setHeight(newHeight)
    setWidth(newWidth)
    onHeightChange?.(newHeight)
    onSizeChange?.(id, newWidth, newHeight)
  }, [id, onHeightChange, onSizeChange])

  return (
    <Resizable
      size={{ width, height }}
      onResizeStop={handleResizeStop}
      minHeight={minHeight}
      maxHeight={maxHeight}
      minWidth={200}
      maxWidth="100%"
      enable={{
        top: position === 'below',
        right: true,
        bottom: position === 'above',
        left: true,
        topRight: position === 'below',
        bottomRight: position === 'above',
        bottomLeft: position === 'above',
        topLeft: position === 'below',
      }}
      handleStyles={{
        top: {
          cursor: 'ns-resize',
          height: '8px',
          top: '-4px',
        },
        bottom: {
          cursor: 'ns-resize',
          height: '8px',
          bottom: '-4px',
        },
        left: {
          cursor: 'ew-resize',
          width: '8px',
          left: '-4px',
        },
        right: {
          cursor: 'ew-resize',
          width: '8px',
          right: '-4px',
        },
        topLeft: {
          cursor: 'nwse-resize',
          width: '16px',
          height: '16px',
          top: '-8px',
          left: '-8px',
        },
        topRight: {
          cursor: 'nesw-resize',
          width: '16px',
          height: '16px',
          top: '-8px',
          right: '-8px',
        },
        bottomLeft: {
          cursor: 'nesw-resize',
          width: '16px',
          height: '16px',
          bottom: '-8px',
          left: '-8px',
        },
        bottomRight: {
          cursor: 'nwse-resize',
          width: '16px',
          height: '16px',
          bottom: '-8px',
          right: '-8px',
        },
      }}
      className={`min-w-0 ${className}`}
      style={{ flex: width === '100%' ? 1 : `0 0 ${width}px` }}
    >
      <div 
        className="docked-window h-full flex flex-col"
        style={windowStyles.container}
        data-window-id={id}
      >
      {/* Header */}
      <div style={windowStyles.header} {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
        <span style={windowStyles.title}>{title}</span>
        {onClose && (
          <button
            onClick={onClose}
            style={windowStyles.closeButton}
            className="hover:bg-red-500/80 hover:text-white"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {/* Content */}
      <div style={windowStyles.content} className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      </div>
    </Resizable>
  )
})

// Container for docked windows - handles layout
export const DockedWindowContainer = memo(function DockedWindowContainer({
  children,
  position,
  maxWindows = 3,
  className = '',
}: DockedWindowContainerProps) {
  return (
    <div 
      className={`docked-window-container flex gap-3 w-full ${
        position === 'above' ? 'mb-3' : 'mt-3'
      } ${className}`}
      style={{
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  )
})

export default DockedWindow
