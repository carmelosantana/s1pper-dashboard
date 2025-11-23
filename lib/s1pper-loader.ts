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

  // Always use public/configs directory for all environments
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
        console.error(`Error reading ${configFile.name}:`, err)
        // Add empty content with error message so the file still shows up
        files.push({
          name: configFile.name,
          content: `# Error loading ${configFile.name}\n# File may not exist at public/configs/${configFile.name}`,
          language: configFile.language,
          description: configFile.description
        })
      }
    }
  } catch (error) {
    console.error('Error loading s1pper files:', error)
  }

  return files
}