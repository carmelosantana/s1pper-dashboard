/**
 * API endpoint to get all module settings
 * GET /api/modules/settings
 */

import { NextResponse } from 'next/server'
import { getAllModuleSettings } from '@/lib/database'

export async function GET() {
  try {
    const modules = await getAllModuleSettings()
    return NextResponse.json(modules)
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch module settings' },
      { status: 500 }
    )
  }
}
