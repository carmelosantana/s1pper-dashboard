/**
 * API endpoint to get and update a specific module's settings
 * GET /api/modules/settings/[moduleId]
 * PUT /api/modules/settings/[moduleId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getModuleSettings, updateModuleSettings } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  try {
    const moduleId = params.moduleId
    const settings = await getModuleSettings(moduleId)
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch module settings' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  try {
    const moduleId = params.moduleId
    const body = await request.json()
    
    const updated = await updateModuleSettings(moduleId, body)
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update module settings' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating module settings:', error)
    return NextResponse.json(
      { error: 'Failed to update module settings' },
      { status: 500 }
    )
  }
}
