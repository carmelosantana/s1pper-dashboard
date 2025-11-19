#!/usr/bin/env node

const { Pool } = require('pg')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

// Load .env.local file
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

// Database configuration
const connectionString = process.env.DATABASE_URL || (() => {
  console.error('❌ DATABASE_URL environment variable is not set!')
  console.error('Please set DATABASE_URL in your .env.local file')
  console.error('Example: DATABASE_URL=postgresql://username:password@host:port/database')
  process.exit(1)
})()

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Check for command-line arguments (non-interactive mode)
const args = process.argv.slice(2)
const isNonInteractive = args.length > 0

// Create readline interface only for interactive mode
let rl
if (!isNonInteractive) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'guestbook-sql> '
  })

  console.log('🔗 Connected to PostgreSQL database')
  console.log('Type .help for available commands, .quit to exit\n')
}

// Helper functions
async function executeQuery(query) {
  try {
    const result = await pool.query(query)
    return result
  } catch (error) {
    throw error
  }
}

function formatResults(result) {
  if (result.rows && result.rows.length > 0) {
    console.table(result.rows)
    console.log(`\n(${result.rows.length} rows)`)
  } else if (result.rowCount !== undefined) {
    console.log(`Query executed successfully. Rows affected: ${result.rowCount}`)
  } else {
    console.log('Query executed successfully.')
  }
}

function showHelp() {
  console.log(`
Available commands:
  .help                 - Show this help message
  .quit                 - Exit the SQL runner
  .tables               - List all tables
  .describe <table>     - Describe table structure
  .init                 - Initialize guestbook tables
  .sample               - Insert sample data
  .count                - Count all guestbook entries
  .recent               - Show recent 10 entries
  .clear                - Clear all guestbook entries (DANGER!)
  .backup               - Backup guestbook entries to JSON file
  .restore <filename>   - Restore guestbook entries from JSON file
  .settings             - Show current dashboard settings
  .settings-update      - Update dashboard settings (interactive)
  .settings-reset       - Reset settings to defaults

Raw SQL queries:
  Just type any SQL query and press Enter
  Example: SELECT * FROM guestbook_entries LIMIT 5;
`)
}

async function handleRestore(trimmed) {
    if (trimmed.startsWith('.restore ')) {
    const filename = trimmed.split(' ')[1]
    if (!filename) {
      console.log('❌ Please provide a filename')
      return
    }
    
    try {
      const filePath = path.join(process.cwd(), filename)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      
      for (const entry of data.entries) {
        await executeQuery(`
          INSERT INTO guestbook_entries (name, email, message, printer_status, print_filename, print_progress, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          entry.name, 
          entry.email, 
          entry.message, 
          entry.printer_status || 'unknown', 
          entry.print_filename || null, 
          entry.print_progress || 0, 
          entry.created_at
        ])
      }
      
      console.log(`✅ Restored ${data.entries.length} entries from ${filename}`)
    } catch (error) {
      console.error('❌ Error restoring data:', error.message)
    }
    return
  }
  
  if (trimmed === '.settings') {
    try {
      const result = await executeQuery('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1')
      if (result.rows && result.rows.length > 0) {
        console.log('\n📊 Current Dashboard Settings:')
        console.table(result.rows)
      } else {
        console.log('❌ No settings found')
      }
    } catch (error) {
      console.error('❌ Error fetching settings:', error.message)
    }
    return
  }
  
  if (trimmed === '.settings-update') {
    console.log('📝 Update Dashboard Settings (press Enter to skip a field)')
    rl.question('Visibility mode (offline/private/public): ', async (visibility) => {
      rl.question('Video feed enabled (true/false): ', async (video) => {
        rl.question('Dashboard title: ', async (title) => {
          rl.question('Dashboard subtitle: ', async (subtitle) => {
            rl.question('Config page enabled (true/false): ', async (config) => {
              rl.question('Guestbook enabled (true/false): ', async (guestbook) => {
                try {
                  const updates = []
                  const values = []
                  let paramCount = 1
                  
                  if (visibility && ['offline', 'private', 'public'].includes(visibility)) {
                    updates.push(`visibility_mode = $${paramCount}`)
                    values.push(visibility)
                    paramCount++
                  }
                  
                  if (video && (video === 'true' || video === 'false')) {
                    updates.push(`video_feed_enabled = $${paramCount}`)
                    values.push(video === 'true')
                    paramCount++
                  }
                  
                  if (title) {
                    updates.push(`dashboard_title = $${paramCount}`)
                    values.push(title)
                    paramCount++
                  }
                  
                  if (subtitle) {
                    updates.push(`dashboard_subtitle = $${paramCount}`)
                    values.push(subtitle)
                    paramCount++
                  }
                  
                  if (config && (config === 'true' || config === 'false')) {
                    updates.push(`config_page_enabled = $${paramCount}`)
                    values.push(config === 'true')
                    paramCount++
                  }
                  
                  if (guestbook && (guestbook === 'true' || guestbook === 'false')) {
                    updates.push(`guestbook_enabled = $${paramCount}`)
                    values.push(guestbook === 'true')
                    paramCount++
                  }
                  
                  if (updates.length > 0) {
                    updates.push('updated_at = CURRENT_TIMESTAMP')
                    const query = `
                      UPDATE dashboard_settings 
                      SET ${updates.join(', ')}
                      WHERE id = (SELECT id FROM dashboard_settings ORDER BY id DESC LIMIT 1)
                      RETURNING *
                    `
                    const result = await executeQuery(query, values)
                    console.log('✅ Settings updated successfully')
                    console.table(result.rows)
                  } else {
                    console.log('⚠️  No changes made')
                  }
                } catch (error) {
                  console.error('❌ Error updating settings:', error.message)
                }
                rl.prompt()
              })
            })
          })
        })
      })
    })
    return
  }
  
  if (trimmed === '.settings-reset') {
    console.log('⚠️  This will reset all settings to defaults!')
    rl.question('Are you sure? Type "yes" to confirm: ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        try {
          await executeQuery(`
            UPDATE dashboard_settings
            SET 
              visibility_mode = 'public',
              video_feed_enabled = true,
              dashboard_title = 's1pper''s Dashboard',
              dashboard_subtitle = 'A dashboard for s1pper, the Ender 3 S1 Pro',
              dashboard_icon_url = NULL,
              config_page_enabled = true,
              guestbook_enabled = true,
              streaming_music_file = NULL,
              streaming_music_enabled = false,
              streaming_music_loop = true,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT id FROM dashboard_settings ORDER BY id DESC LIMIT 1)
          `)
          console.log('✅ Settings reset to defaults')
        } catch (error) {
          console.error('❌ Error resetting settings:', error.message)
        }
      } else {
        console.log('❌ Reset cancelled')
      }
      rl.prompt()
    })
    return
  }
}

async function handleCommand(input) {
  const trimmed = input.trim()
  
  if (trimmed === '.help') {
    showHelp()
    return
  }
  
  if (trimmed === '.quit') {
    console.log('Goodbye! 👋')
    await pool.end()
    process.exit(0)
  }
  
  if (trimmed === '.tables') {
    try {
      const result = await executeQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `)
      formatResults(result)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed.startsWith('.describe ')) {
    const tableName = trimmed.split(' ')[1]
    if (!tableName) {
      console.log('Usage: .describe <table_name>')
      return
    }
    
    try {
      const result = await executeQuery(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `)
      formatResults(result)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed === '.init') {
    try {
      const initQuery = `
        CREATE TABLE IF NOT EXISTS guestbook_entries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          printer_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
          print_filename VARCHAR(255),
          print_progress INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_guestbook_created_at ON guestbook_entries(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_guestbook_printer_status ON guestbook_entries(printer_status);
      `
      
      const result = await executeQuery(initQuery)
      console.log('✅ Database tables initialized successfully!')
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed === '.sample') {
    try {
      const sampleData = `
        INSERT INTO guestbook_entries (name, email, message, printer_status, print_filename, print_progress)
        VALUES 
          ('John Doe', 'john@example.com', 'Great printer setup! Love watching the live stream.', 'printing', 'benchy.gcode', 45),
          ('Jane Smith', 'jane@example.com', 'Amazing quality prints. What settings do you use?', 'complete', 'calibration_cube.gcode', 100),
          ('Bob Johnson', 'bob@example.com', 'Cool dashboard! Very professional looking.', 'ready', NULL, 0),
          ('Alice Wilson', 'alice@example.com', 'Been following your prints for a while. Keep it up!', 'offline', NULL, 0)
        ON CONFLICT DO NOTHING;
      `
      
      const result = await executeQuery(sampleData)
      console.log('✅ Sample data inserted successfully!')
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed === '.count') {
    try {
      const result = await executeQuery('SELECT COUNT(*) as total_entries FROM guestbook_entries;')
      formatResults(result)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed === '.recent') {
    try {
      const result = await executeQuery(`
        SELECT id, name, message, printer_status, print_filename, print_progress, created_at 
        FROM guestbook_entries 
        ORDER BY created_at DESC 
        LIMIT 10;
      `)
      formatResults(result)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed === '.clear') {
    console.log('⚠️  This will delete ALL guestbook entries!')
    rl.question('Are you sure? Type "yes" to confirm: ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        try {
          const result = await executeQuery('DELETE FROM guestbook_entries;')
          console.log('🗑️  All entries cleared!')
        } catch (error) {
          console.error('Error:', error.message)
        }
      } else {
        console.log('Operation cancelled.')
      }
      rl.prompt()
    })
    return
  }
  
  if (trimmed === '.backup') {
    try {
      const result = await executeQuery('SELECT * FROM guestbook_entries ORDER BY created_at;')
      const filename = `guestbook_backup_${new Date().toISOString().split('T')[0]}.json`
      const filepath = path.join(process.cwd(), filename)
      
      fs.writeFileSync(filepath, JSON.stringify(result.rows, null, 2))
      console.log(`💾 Backup saved to: ${filepath}`)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  if (trimmed.startsWith('.restore ')) {
    const filename = trimmed.split(' ')[1]
    if (!filename) {
      console.log('Usage: .restore <filename>')
      return
    }
    
    try {
      const filepath = path.join(process.cwd(), filename)
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
      
      // Clear existing data first
      await executeQuery('DELETE FROM guestbook_entries;')
      
      // Insert backed up data
      for (const entry of data) {
        await executeQuery(`
          INSERT INTO guestbook_entries (name, email, message, printer_status, print_filename, print_progress, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [entry.name, entry.email, entry.message, entry.printer_status, entry.print_filename, entry.print_progress, entry.created_at])
      }
      
      console.log(`📦 Restored ${data.length} entries from backup!`)
    } catch (error) {
      console.error('Error:', error.message)
    }
    return
  }
  
  // Handle raw SQL queries
  if (trimmed.length > 0) {
    try {
      const result = await executeQuery(trimmed)
      formatResults(result)
    } catch (error) {
      console.error('Error:', error.message)
    }
  }
}

// Handle readline events
if (!isNonInteractive) {
  rl.on('line', async (input) => {
    await handleCommand(input)
    rl.prompt()
  })

  rl.on('close', async () => {
    console.log('\nGoodbye! 👋')
    await pool.end()
    process.exit(0)
  })

  // Start the prompt
  rl.prompt()
} else {
  // Non-interactive mode: execute command from arguments
  (async () => {
    try {
      // Join all arguments to support SQL queries with spaces
      const command = args.join(' ')
      
      // Check if it's a file path (ends with .sql)
      if (command.endsWith('.sql') && fs.existsSync(command)) {
        console.log(`📄 Executing SQL file: ${command}`)
        const sqlContent = fs.readFileSync(command, 'utf8')
        const result = await executeQuery(sqlContent)
        formatResults(result)
      } else {
        // Execute as direct SQL command or special command
        await handleCommand(command)
      }
      
      await pool.end()
      process.exit(0)
    } catch (error) {
      console.error('❌ Error:', error.message)
      await pool.end()
      process.exit(1)
    }
  })()
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error)
})


process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT. Gracefully shutting down...')
  await pool.end()
  process.exit(0)
})
