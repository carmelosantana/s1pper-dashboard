/**
 * Module Registry
 * 
 * Central registry for all dashboard modules.
 * Import and register new modules here.
 */

import type { ModuleRegistry } from './types'
import { GrowTentModule } from './grow-tent'

/**
 * All available modules
 */
export const modules: ModuleRegistry = {
  'grow-tent': GrowTentModule,
}

/**
 * Get a module by ID
 */
export function getModule(moduleId: string) {
  return modules[moduleId]
}

/**
 * Get all registered modules
 */
export function getAllModules() {
  return Object.values(modules)
}

/**
 * Get modules by position
 */
export function getModulesByPosition(position: 'main' | 'sidebar' | 'bottom' | 'floating') {
  return Object.values(modules).filter(m => m.position === position)
}
