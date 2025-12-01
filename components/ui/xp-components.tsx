'use client'

import { memo, useRef, useEffect, useState } from 'react'

// Windows XP color palette - authentic colors
export const XP_COLORS = {
  // Window chrome
  titleBarStart: '#0054E3',
  titleBarEnd: '#0054E3',
  titleBarActive: 'linear-gradient(180deg, #0054E3 0%, #0047CC 50%, #003EB8 100%)',
  windowBg: '#ECE9D8',
  // Tab and content
  tabBg: '#ECE9D8',
  tabActiveBg: '#FFFFFF',
  tabBorder: '#919B9C',
  contentBg: '#FFFFFF',
  // Graphs - authentic XP green
  graphBg: '#000000',
  graphGrid: '#003200',
  graphLine: '#00FF00',
  graphLineAlt: '#FFFF00',
  graphLineRed: '#FF0000',
  // Text
  labelText: '#000000',
  valueText: '#000000',
  // Headers and borders
  headerBg: '#D4D0C8',
  headerText: '#000000',
  border: '#808080',
  borderLight: '#FFFFFF',
  borderDark: '#404040',
  // Status bar
  statusBg: '#ECE9D8',
  // Window buttons
  closeBtn: '#E04343',
  closeBtnHover: '#FF5555',
  minBtn: '#3C6EAF',
  maxBtn: '#3C6EAF',
} as const

// Common styles that can be reused
export const XP_STYLES = {
  databoxBorder: {
    borderColor: '#919B9C',
    boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #FFFFFF'
  },
  insetBorder: {
    borderColor: `${XP_COLORS.borderDark} ${XP_COLORS.borderLight} ${XP_COLORS.borderLight} ${XP_COLORS.borderDark}`,
  },
  dialogTitleBar: {
    background: 'linear-gradient(180deg, #0A6AF3 0%, #0054E3 50%, #003EB8 100%)',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
  },
  closeButton: {
    background: 'linear-gradient(180deg, #E87A6E 0%, #D85C4B 50%, #C44333 100%)',
    border: '1px solid rgba(255,255,255,0.5)',
  },
} as const

interface XPGraphProps {
  data: number[]
  data2?: number[]
  maxValue?: number
  height?: number
  title?: string
  showGrid?: boolean
  lineColor?: string
  line2Color?: string
  className?: string
}

// XP-style Graph Component with optional second line - memoized for performance
export const XPGraph = memo(function XPGraph({ 
  data, 
  data2,
  maxValue = 100, 
  height = 100,
  title,
  showGrid = true,
  lineColor = XP_COLORS.graphLine,
  line2Color = XP_COLORS.graphLineAlt,
  className = ''
}: XPGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 200, height })
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setDimensions(prev => {
            if (prev.width === rect.width && prev.height === height) {
              return prev // No change, don't update
            }
            return { width: rect.width, height }
          })
        }
      }
    }
    
    // Use requestAnimationFrame to ensure DOM is ready
    animationFrameRef.current = requestAnimationFrame(updateDimensions)
    window.addEventListener('resize', updateDimensions)
    return () => {
      window.removeEventListener('resize', updateDimensions)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height: h } = dimensions
    
    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Fill background - ensure it's always black
    ctx.fillStyle = XP_COLORS.graphBg
    ctx.fillRect(0, 0, width, h)

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = XP_COLORS.graphGrid
      ctx.lineWidth = 1

      const vSpacing = 20
      for (let x = width; x >= 0; x -= vSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      const hSpacing = 20
      for (let y = 0; y <= h; y += hSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    }

    // Draw second data line (if provided) - drawn first so primary line is on top
    if (data2 && data2.length > 1) {
      ctx.strokeStyle = line2Color
      ctx.lineWidth = 1
      ctx.beginPath()

      const pointSpacing = width / (data2.length - 1)
      
      data2.forEach((value, index) => {
        const x = index * pointSpacing
        const y = h - (Math.min(value, maxValue) / maxValue) * h
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
    }

    // Draw primary data line
    if (data.length > 1) {
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.beginPath()

      const pointSpacing = width / (data.length - 1)
      
      data.forEach((value, index) => {
        const x = index * pointSpacing
        const y = h - (Math.min(value, maxValue) / maxValue) * h
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
    }
  }, [data, data2, dimensions, maxValue, showGrid, lineColor, line2Color])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {title && (
        <div className="text-xs text-black mb-1 font-['Tahoma']">{title}</div>
      )}
      <div 
        className="border-2"
        style={{
          borderColor: `${XP_COLORS.borderDark} ${XP_COLORS.borderLight} ${XP_COLORS.borderLight} ${XP_COLORS.borderDark}`,
          backgroundColor: XP_COLORS.graphBg
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: '100%', 
            height: `${height}px`,
            display: 'block',
            backgroundColor: XP_COLORS.graphBg
          }}
        />
      </div>
    </div>
  )
})

interface XPVerticalBarProps {
  value: number
  maxValue?: number
  height?: number
  title?: string
  displayValue?: string
  color?: string
}

// XP-style Vertical Bar Component (like PF Usage) - memoized for performance
export const XPVerticalBar = memo(function XPVerticalBar({
  value,
  maxValue = 100,
  height = 90,
  title,
  displayValue,
  color = XP_COLORS.graphLine
}: XPVerticalBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100)
  
  return (
    <div className="w-full">
      {title && (
        <div className="text-xs text-black mb-1 font-['Tahoma']">{title}</div>
      )}
      <div 
        className="border-2 relative w-full"
        style={{
          borderColor: `${XP_COLORS.borderDark} ${XP_COLORS.borderLight} ${XP_COLORS.borderLight} ${XP_COLORS.borderDark}`,
          height: `${height}px`,
          backgroundColor: '#000000',
          minWidth: '40px'
        }}
      >
        {/* Bar fill */}
        <div 
          className="absolute bottom-0 left-0 right-0 transition-all duration-300"
          style={{ height: `${percentage}%`, backgroundColor: color }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-full border-t"
              style={{ top: `${(i + 1) * 20}%`, borderColor: XP_COLORS.graphGrid }}
            />
          ))}
        </div>
        {/* Value text */}
        {displayValue && (
          <div 
            className="absolute bottom-1 left-1 font-['Tahoma'] text-[10px] font-bold"
            style={{ 
              color,
              textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000'
            }}
          >
            {displayValue}
          </div>
        )}
      </div>
    </div>
  )
})

interface XPTabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

// XP-style Tab Button - smaller text - memoized for performance
export const XPTabButton = memo(function XPTabButton({ 
  active, 
  onClick, 
  children 
}: XPTabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-0.5 text-xs font-['Tahoma'] border-t border-l border-r text-black
        ${active 
          ? 'bg-white border-[#919B9C] -mb-px z-10 relative' 
          : 'bg-[#ECE9D8] border-[#919B9C] hover:bg-[#F5F4EF]'
        }
      `}
      style={{
        borderTopLeftRadius: '3px',
        borderTopRightRadius: '3px',
        color: '#000000',
      }}
    >
      {children}
    </button>
  )
})

interface XPDataboxProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerAction?: React.ReactNode
}

// XP-style Databox container - memoized for performance
export const XPDatabox = memo(function XPDatabox({
  title,
  icon,
  children,
  className = '',
  headerAction
}: XPDataboxProps) {
  return (
    <div 
      className={`border p-2 ${className}`}
      style={XP_STYLES.databoxBorder}
    >
      <div className="font-bold text-black mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {icon}
          <span>{title}</span>
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  )
})

interface XPDialogProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  width?: string
  maxHeight?: string
}

// XP-style Dialog window - memoized for performance
export const XPDialog = memo(function XPDialog({
  title,
  isOpen,
  onClose,
  children,
  width = 'w-80',
  maxHeight = '50vh'
}: XPDialogProps) {
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div 
        className={`${width} shadow-lg`}
        style={{
          backgroundColor: XP_COLORS.windowBg,
          border: '2px outset #FFFFFF',
          borderRadius: '8px',
        }}
      >
        {/* Dialog title bar */}
        <div 
          className="flex items-center justify-between px-2 py-1"
          style={XP_STYLES.dialogTitleBar}
        >
          <span className="text-white text-xs font-bold">{title}</span>
          <button 
            className="w-4 h-4 rounded-sm flex items-center justify-center text-white"
            style={XP_STYLES.closeButton}
            onClick={onClose}
          >
            <span className="text-[10px] font-bold">×</span>
          </button>
        </div>
        {/* Dialog content */}
        <div className="p-3 overflow-y-auto" style={{ maxHeight }}>
          {children}
        </div>
      </div>
    </div>
  )
})

interface XPButtonProps {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  variant?: 'default' | 'danger'
  className?: string
}

// XP-style Button - memoized for performance
export const XPButton = memo(function XPButton({
  onClick,
  children,
  disabled = false,
  variant = 'default',
  className = ''
}: XPButtonProps) {
  const baseStyles = variant === 'danger' 
    ? {
        backgroundColor: '#CC0000',
        border: '2px outset #FF6666',
        color: 'white',
      }
    : {
        backgroundColor: XP_COLORS.windowBg,
        border: '2px outset #FFFFFF',
        color: 'black',
      }
  
  return (
    <button
      className={`px-3 py-0.5 text-[10px] ${className}`}
      style={{
        ...baseStyles,
        borderRadius: '3px',
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
})

// Grid item stat row for databoxes
interface XPStatRowProps {
  label: string
  value: string | number
  className?: string
}

export const XPStatRow = memo(function XPStatRow({ 
  label, 
  value, 
  className = '' 
}: XPStatRowProps) {
  return (
    <>
      <span className={className}>{label}</span>
      <span className={`text-right ${className}`}>{value}</span>
    </>
  )
})
