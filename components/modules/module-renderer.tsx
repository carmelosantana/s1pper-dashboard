'use client'

/**
 * Module Renderer
 * 
 * Dynamically renders enabled modules based on database settings
 */

import { useEffect, useState } from 'react'
import type { ModuleSettings } from '@/lib/database'
import { getModule } from './index'

interface ModuleRendererProps {
  moduleSettings: ModuleSettings[]
  position?: 'main' | 'sidebar' | 'bottom' | 'floating'
}

export function ModuleRenderer({ moduleSettings, position }: ModuleRendererProps) {
  const [modules, setModules] = useState<ModuleSettings[]>([])
  
  useEffect(() => {
    // Filter modules by position if specified
    const filtered = position
      ? moduleSettings.filter(m => m.enabled && m.position === position)
      : moduleSettings.filter(m => m.enabled)
    
    // Sort by display order
    filtered.sort((a, b) => a.display_order - b.display_order)
    
    setModules(filtered)
  }, [moduleSettings, position])
  
  if (modules.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-6">
      {modules.map((moduleSetting) => {
        const moduleDefinition = getModule(moduleSetting.module_id)
        
        if (!moduleDefinition) {
          console.warn(`Module ${moduleSetting.module_id} not found in registry`)
          return null
        }
        
        const ModuleComponent = moduleDefinition.component
        
        return (
          <div key={moduleSetting.module_id}>
            <ModuleComponent
              moduleId={moduleSetting.module_id}
              settings={moduleSetting.settings}
              isVisible={moduleSetting.enabled}
            />
          </div>
        )
      })}
    </div>
  )
}
