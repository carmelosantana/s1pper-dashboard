#!/usr/bin/env node

/**
 * Migration Script: Add streaming_title_enabled column
 * 
 * This script adds the streaming_title_enabled column to the dashboard_settings table
 * for existing databases that don't have this column yet.
 * 
 * Usage: node scripts/migrate-streaming-title.js
 */

const { Pool } = require('pg')

// Database configuration
const connectionString = process.env.DATABASE_URL || (() => {
  console.error('❌ DATABASE_URL environment variable is not set!')
  console.error('Please set DATABASE_URL in your .env.local file')
  process.exit(1)
})()

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

async function migrate() {
  console.log('🔄 Starting migration: Add streaming_title_enabled column\n')

  try {
    // Check if the column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dashboard_settings' 
        AND column_name = 'streaming_title_enabled';
    `
    
    const checkResult = await pool.query(checkColumnQuery)
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column streaming_title_enabled already exists. No migration needed.')
      return
    }

    console.log('📝 Adding streaming_title_enabled column...')
    
    // Add the column with default value
    const addColumnQuery = `
      ALTER TABLE dashboard_settings 
      ADD COLUMN streaming_title_enabled BOOLEAN NOT NULL DEFAULT true;
    `
    
    await pool.query(addColumnQuery)
    
    console.log('✅ Successfully added streaming_title_enabled column')
    console.log('✅ Migration completed successfully!\n')
    
    // Verify the change
    const verifyQuery = `
      SELECT streaming_title_enabled 
      FROM dashboard_settings 
      LIMIT 1;
    `
    
    const verifyResult = await pool.query(verifyQuery)
    
    if (verifyResult.rows.length > 0) {
      console.log(`📊 Current value: ${verifyResult.rows[0].streaming_title_enabled}`)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✨ All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error)
    process.exit(1)
  })
