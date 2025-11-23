import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { ConfigFile } from '@/lib/types'

export async function GET() {
  try {
    const configDir = path.join(process.cwd(), 'public', 'configs')
    
    const configFiles: ConfigFile[] = [
      {
        name: 's1pper.cfg',
        description: 'Main s1pper configuration file with adaptive bed mesh and enhanced print start/end macros.',
        language: 'gcode' as const,
        content: ''
      },
      {
        name: 'printer.cfg',
        description: 'Complete Klipper printer configuration for the Ender 3 S1 Pro with s1pper enhancements.',
        language: 'gcode' as const,
        content: ''
      },
      {
        name: 's1pper-automesh.cfg',
        description: 'Automated bed mesh leveling configuration for optimal first layer adhesion.',
        language: 'gcode' as const,
        content: ''
      },
      {
        name: 'KlipperPrintArea.py',
        description: 'Python script for adaptive bed mesh based on actual print area for improved efficiency.',
        language: 'python' as const,
        content: ''
      }
    ]

    // Load content for each file
    for (const file of configFiles) {
      try {
        const filePath = path.join(configDir, file.name)
        const content = await fs.promises.readFile(filePath, 'utf-8')
        file.content = content
      } catch (error) {
        console.error(`Error reading ${file.name}:`, error)
        file.content = `# Error loading ${file.name}\n# File may not exist at public/configs/${file.name}`
      }
    }

    return NextResponse.json(configFiles)
  } catch (error) {
    console.error('Error loading config files:', error)
    return NextResponse.json({ error: 'Failed to load config files' }, { status: 500 })
  }
}