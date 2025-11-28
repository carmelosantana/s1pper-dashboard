/**
 * Grow Tent Module Definition
 */

import { Droplets } from 'lucide-react'
import type { ModuleDefinition } from '../types'
import { GrowTentModuleComponent } from './grow-tent-module'

export const GrowTentModule: ModuleDefinition = {
  id: 'grow-tent',
  name: 'AC Infinity Grow Tent',
  description: 'Monitor and control your AC Infinity grow tent devices',
  version: '1.0.0',
  author: 's1pper',
  icon: Droplets,
  
  enabled: false,
  position: 'main',
  order: 100,
  
  minWidth: 300,
  minHeight: 200,
  defaultWidth: 400,
  defaultHeight: 500,
  
  hasSettings: true,
  settingsSchema: {
    apiUrl: {
      type: 'string',
      label: 'API URL',
      description: 'URL of the grow tent API server',
      default: 'http://localhost:3000'
    },
    refreshInterval: {
      type: 'number',
      label: 'Refresh Interval (ms)',
      description: 'How often to fetch status updates (fallback when WebSocket is disconnected)',
      default: 30000,
      min: 5000,
      max: 300000
    },
    showControls: {
      type: 'boolean',
      label: 'Show Controls',
      description: 'Allow controlling devices from the dashboard',
      default: true
    },
    compactView: {
      type: 'boolean',
      label: 'Compact View',
      description: 'Use a more compact layout for the module',
      default: false
    }
  },
  
  component: GrowTentModuleComponent,
}
