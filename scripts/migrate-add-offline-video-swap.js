#!/usr/bin/env node

/**
 * Database Migration: Add 'offline_video_swap' to display mode constraints
 * 
 * This migration updates the CHECK constraints on camera display mode columns
 * to include the new 'offline_video_swap' option.
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local file
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

// Database configuration
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set!')
  process.exit(1)
}

const pool = new Pool({ connectionString })

async function migrate() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Starting migration: Add offline_video_swap to display modes...\n')
    
    // Start transaction
    await client.query('BEGIN')
    
    // Drop old constraints
    console.log('Dropping old CHECK constraints...')
    await client.query(`
      ALTER TABLE dashboard_settings 
      DROP CONSTRAINT IF EXISTS dashboard_settings_stream_camera_display_mode_check
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      DROP CONSTRAINT IF EXISTS dashboard_settings_horizontal_stream_camera_display_mode_check
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      DROP CONSTRAINT IF EXISTS dashboard_settings_vertical_stream_camera_display_mode_check
    `)
    
    // Add new constraints with offline_video_swap
    console.log('Adding new CHECK constraints with offline_video_swap...')
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_stream_camera_display_mode_check 
      CHECK (stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap'))
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_horizontal_stream_camera_display_mode_check 
      CHECK (horizontal_stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap'))
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_vertical_stream_camera_display_mode_check 
      CHECK (vertical_stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap'))
    `)
    
    // Commit transaction
    await client.query('COMMIT')
    
    console.log('\n✅ Migration completed successfully!')
    console.log('   - Updated stream_camera_display_mode constraint')
    console.log('   - Updated horizontal_stream_camera_display_mode constraint')
    console.log('   - Updated vertical_stream_camera_display_mode constraint')
    console.log('\nAll display mode columns now support: single, grid, pip, offline_video_swap')
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK')
    console.error('\n❌ Migration failed:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
