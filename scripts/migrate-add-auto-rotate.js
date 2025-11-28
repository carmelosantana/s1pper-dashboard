#!/usr/bin/env node

/**
 * Database Migration: Add 'auto_rotate' display mode and rotation settings
 * 
 * This migration:
 * 1. Updates CHECK constraints to include 'auto_rotate' mode
 * 2. Adds rotation_interval column for customizable rotation timing
 * 3. Adds transition_effect column for customizable transitions
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
    console.log('🔄 Starting migration: Add auto_rotate mode and rotation settings...\n')
    
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
    
    // Add new constraints with auto_rotate
    console.log('Adding new CHECK constraints with auto_rotate...')
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_stream_camera_display_mode_check 
      CHECK (stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap', 'auto_rotate'))
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_horizontal_stream_camera_display_mode_check 
      CHECK (horizontal_stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap', 'auto_rotate'))
    `)
    
    await client.query(`
      ALTER TABLE dashboard_settings 
      ADD CONSTRAINT dashboard_settings_vertical_stream_camera_display_mode_check 
      CHECK (vertical_stream_camera_display_mode IN ('single', 'grid', 'pip', 'offline_video_swap', 'auto_rotate'))
    `)
    
    // Add rotation_interval column if it doesn't exist
    console.log('Adding rotation_interval column...')
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='dashboard_settings' AND column_name='rotation_interval'
        ) THEN
          ALTER TABLE dashboard_settings 
          ADD COLUMN rotation_interval INTEGER DEFAULT 60 CHECK (rotation_interval >= 5 AND rotation_interval <= 300);
        END IF;
      END $$;
    `)
    
    // Add transition_effect column if it doesn't exist
    console.log('Adding transition_effect column...')
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='dashboard_settings' AND column_name='transition_effect'
        ) THEN
          ALTER TABLE dashboard_settings 
          ADD COLUMN transition_effect VARCHAR(20) DEFAULT 'fade' CHECK (transition_effect IN ('fade', 'slide', 'zoom', 'none'));
        END IF;
      END $$;
    `)
    
    // Commit transaction
    await client.query('COMMIT')
    
    console.log('\n✅ Migration completed successfully!')
    console.log('   - Updated stream_camera_display_mode constraint')
    console.log('   - Updated horizontal_stream_camera_display_mode constraint')
    console.log('   - Updated vertical_stream_camera_display_mode constraint')
    console.log('   - Added rotation_interval column (5-300 seconds, default 60)')
    console.log('   - Added transition_effect column (fade/slide/zoom/none, default fade)')
    console.log('\nAll display mode columns now support: single, grid, pip, offline_video_swap, auto_rotate')
    
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
