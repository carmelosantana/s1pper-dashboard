export interface ConfigFile {
  name: string
  content: string
  language: string
  description: string
}

import fs from 'fs/promises'
import path from 'path'

/**
 * Loads s1pper configuration files using a hybrid approach:
 * 1. First tries to load from public/configs/ via filesystem (server-side, build-time)
 * 2. Falls back to HTTP requests to /configs/ endpoints (client-side or when filesystem fails)
 * 
 * This ensures the files are accessible in both development and production environments,
 * while keeping the original s1pper/ directory intact for git history and development.
 */
export async function loadS1pperFiles(): Promise<ConfigFile[]> {
  const configFiles = [
    {
      name: 's1pper.cfg',
      language: 'ini',
      description: 'Main s1pper configuration with printer preheat, start, and end macros'
    },
    {
      name: 's1pper-automesh.cfg',
      language: 'ini',
      description: 'Adaptive bed mesh calibration with dynamic purge line scaling'
    },
    {
      name: 'printer.cfg',
      language: 'ini',
      description: 'Ender 3 S1 Pro configuration with 0.6mm nozzle optimizations'
    },
    {
      name: 'KlipperPrintArea.py',
      language: 'python',
      description: 'Cura slicer script for extracting print area boundaries and enabling adaptive bed meshing'
    }
  ]

  const files: ConfigFile[] = []

  // First try to load from filesystem (works in server-side environments)
  if (typeof window === 'undefined') {
    try {
      const publicConfigsDir = path.join(process.cwd(), 'public', 'configs')
      
      for (const configFile of configFiles) {
        try {
          const filePath = path.join(publicConfigsDir, configFile.name)
          const content = await fs.readFile(filePath, 'utf-8')
          files.push({
            name: configFile.name,
            content,
            language: configFile.language,
            description: configFile.description
          })
        } catch (err) {
          console.warn(`Could not load ${configFile.name} from filesystem:`, err)
        }
      }
      
      if (files.length > 0) {
        return files
      }
    } catch (error) {
      console.warn('Filesystem loading failed, falling back to HTTP:', error)
    }
  }

  // Fallback to HTTP requests (works in client-side and when filesystem loading fails)
  try {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin  // Client-side
      : process.env.NEXT_PUBLIC_APP_URL || (
          process.env.NODE_ENV === 'production' 
            ? `https://${process.env.VERCEL_URL || 'localhost:3000'}` // Use Vercel URL if available in production
            : 'http://localhost:3000'   // Development server-side
        )
    
    for (const configFile of configFiles) {
      try {
        const response = await fetch(`${baseUrl}/configs/${configFile.name}`, {
          headers: {
            'Accept': 'text/plain'
          }
        })
        if (response.ok) {
          const content = await response.text()
          files.push({
            name: configFile.name,
            content,
            language: configFile.language,
            description: configFile.description
          })
        } else {
          console.warn(`Could not load ${configFile.name}: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.warn(`Could not load ${configFile.name}:`, err)
      }
    }
  } catch (error) {
    console.error('Error loading s1pper files:', error)
  }

  return files
}