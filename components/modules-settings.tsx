'use client'

/**
 * Modules Settings Component
 * 
 * Allows enabling/disabling modules and configuring their settings
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Droplets, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ModuleSettings } from '@/lib/database'
import { getModule, getAllModules } from '@/components/modules'

export function ModulesSettings() {
  const [modules, setModules] = useState<ModuleSettings[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch module settings on mount
  useEffect(() => {
    fetchModules()
  }, [])

  const fetchModules = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/modules/settings')
      if (!response.ok) throw new Error('Failed to fetch modules')
      const data = await response.json()
      setModules(data)
    } catch (err) {
      setError('Failed to load modules')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateModule = async (moduleId: string, updates: Partial<ModuleSettings>) => {
    try {
      setIsSaving(true)
      setError(null)
      
      const response = await fetch(`/api/modules/settings/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) throw new Error('Failed to update module')
      
      const updated = await response.json()
      
      // Update local state
      setModules(prev => prev.map(m => 
        m.module_id === moduleId ? updated : m
      ))
      
      setSuccess(`${moduleId} updated successfully`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to update module')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>Loading modules...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle>Modules</CardTitle>
        <CardDescription>
          Enable and configure dashboard modules to extend functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-600/10 border border-green-600/20 text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-600/20 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Module List */}
        <div className="space-y-4">
          {modules.map(moduleSetting => {
            const moduleDefinition = getModule(moduleSetting.module_id)
            
            if (!moduleDefinition) {
              return (
                <div key={moduleSetting.module_id} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <p className="text-sm text-red-400">
                    Module "{moduleSetting.module_id}" not found in registry
                  </p>
                </div>
              )
            }

            const Icon = moduleDefinition.icon || Droplets

            return (
              <div key={moduleSetting.module_id} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-4">
                {/* Module Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-cyan-500 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold">{moduleDefinition.name}</h3>
                      <p className="text-sm text-muted-foreground">{moduleDefinition.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          v{moduleDefinition.version}
                        </Badge>
                        <Badge variant={moduleSetting.enabled ? "default" : "outline"} className="text-xs">
                          {moduleSetting.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Position: {moduleSetting.position}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Switch
                    checked={moduleSetting.enabled}
                    onCheckedChange={(checked) => updateModule(moduleSetting.module_id, { enabled: checked })}
                    disabled={isSaving}
                  />
                </div>

                {/* Module Settings (if enabled) */}
                {moduleSetting.enabled && moduleDefinition.hasSettings && moduleDefinition.settingsSchema && (
                  <div className="pt-4 border-t border-zinc-700 space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground">Module Settings</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(moduleDefinition.settingsSchema).map(([key, schema]: [string, any]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={`${moduleSetting.module_id}-${key}`} className="text-sm">
                            {schema.label}
                          </Label>
                          
                          {schema.type === 'string' && (
                            <Input
                              id={`${moduleSetting.module_id}-${key}`}
                              value={moduleSetting.settings?.[key] || schema.default || ''}
                              onChange={(e) => {
                                const newSettings = { ...moduleSetting.settings, [key]: e.target.value }
                                updateModule(moduleSetting.module_id, { settings: newSettings })
                              }}
                              placeholder={schema.description}
                              disabled={isSaving}
                              className="bg-zinc-800 border-zinc-700"
                            />
                          )}
                          
                          {schema.type === 'number' && (
                            <Input
                              id={`${moduleSetting.module_id}-${key}`}
                              type="number"
                              value={moduleSetting.settings?.[key] || schema.default || 0}
                              onChange={(e) => {
                                const newSettings = { ...moduleSetting.settings, [key]: parseInt(e.target.value) }
                                updateModule(moduleSetting.module_id, { settings: newSettings })
                              }}
                              min={schema.min}
                              max={schema.max}
                              placeholder={schema.description}
                              disabled={isSaving}
                              className="bg-zinc-800 border-zinc-700"
                            />
                          )}
                          
                          {schema.type === 'boolean' && (
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`${moduleSetting.module_id}-${key}`}
                                checked={moduleSetting.settings?.[key] ?? schema.default ?? false}
                                onCheckedChange={(checked) => {
                                  const newSettings = { ...moduleSetting.settings, [key]: checked }
                                  updateModule(moduleSetting.module_id, { settings: newSettings })
                                }}
                                disabled={isSaving}
                              />
                              <span className="text-sm text-muted-foreground">{schema.description}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {modules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No modules available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
