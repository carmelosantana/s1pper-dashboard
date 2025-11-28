/**
 * Module System Types
 * 
 * Defines the structure and interface for dashboard modules
 */

import { ReactNode, ComponentType } from 'react'
import { LucideIcon } from 'lucide-react'

/**
 * Module metadata and configuration
 */
export interface ModuleDefinition {
  id: string
  name: string
  description: string
  version: string
  author?: string
  icon?: LucideIcon
  
  // Module behavior
  enabled: boolean
  position: 'main' | 'sidebar' | 'bottom' | 'floating'
  order: number
  
  // Size constraints
  minWidth?: number
  minHeight?: number
  defaultWidth?: number
  defaultHeight?: number
  
  // Settings
  hasSettings: boolean
  settingsSchema?: any
  
  // Component to render
  component: React.ComponentType<ModuleProps>
}

/**
 * Props passed to each module component
 */
export interface ModuleProps {
  moduleId: string
  settings: any
  isVisible: boolean
  onUpdateSettings?: (settings: any) => Promise<void>
  onError?: (error: Error) => void
}

/**
 * Module settings stored in database
 */
export interface ModuleSettings {
  id: number
  module_id: string
  enabled: boolean
  position: 'main' | 'sidebar' | 'bottom' | 'floating'
  order: number
  settings: any // JSON column for module-specific settings
  created_at: string
  updated_at: string
}

/**
 * Module registration interface
 */
export interface ModuleRegistry {
  [moduleId: string]: ModuleDefinition
}
