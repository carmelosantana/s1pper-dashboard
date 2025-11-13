"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSliders, Github, ExternalLink } from "lucide-react"
import { CodeViewer } from "@/components/code-viewer"
import { trackEvent } from "@/components/umami-analytics"
import type { ConfigFile } from '@/lib/types'

// Get config files - same logic as in the main dashboard
export default function ConfigPage() {
  const [configFiles, setConfigFiles] = useState<ConfigFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfigFiles() {
      try {
        const response = await fetch('/api/config')
        if (!response.ok) {
          throw new Error('Failed to load config files')
        }
        const files = await response.json()
        setConfigFiles(files)
      } catch (error) {
        console.error('Error loading config files:', error)
        setError('Failed to load configuration files')
      } finally {
        setLoading(false)
      }
    }

    loadConfigFiles()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground">Loading configuration files...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-400 mb-2">Error loading configuration files</p>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Configuration</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Ender 3 S1 Pro</span>
              <span>•</span>
              <a href="/" className="hover:text-foreground transition-colors">Home</a>
              <span>•</span>
              <a href="/config" className="hover:text-foreground transition-colors text-foreground">Config</a>
            </div>
          </div>
          <p className="text-muted-foreground">
            s1pper configuration files and Klipper setup for your Ender 3 S1 Pro
          </p>
        </div>

        {/* s1pper Configuration Card */}
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileSliders className="h-5 w-5 text-cyan-500" />
                s1pper Configuration
              </CardTitle>
              <a 
                href="https://github.com/carmelosantana/s1pper" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => trackEvent('github_link_click', { location: 'config_page' })}
              >
                <Github className="h-4 w-4" />
                <span>View on GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                s1pper enhances your Ender 3 S1 Pro with custom Klipper macros, featuring adaptive bed mesh calibration 
                and dynamic purge lines that scale with your print size for smarter, cleaner starts to every print.
              </p>
              
              <Tabs defaultValue="s1pper.cfg" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {configFiles.map((file) => (
                    <TabsTrigger 
                      key={file.name} 
                      value={file.name}
                      onClick={() => trackEvent('config_tab_click', { filename: file.name, location: 'config_page' })}
                    >
                      {file.name === 's1pper-automesh.cfg' ? 'automesh.cfg' : file.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {configFiles.map((file) => (
                  <TabsContent key={file.name} value={file.name} className="mt-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {file.description}
                      </p>
                      <CodeViewer
                        code={file.content}
                        language={file.language}
                        filename={file.name}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}