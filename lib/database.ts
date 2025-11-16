import { Pool, PoolClient } from 'pg'

let pool: Pool | null = null
let databaseAvailable: boolean | null = null
let initializationPromise: Promise<void> | null = null
let isInitialized = false

// Initialize the database connection pool
function initializePool(): Pool | null {
  // If no DATABASE_URL is provided, database features are disabled
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not provided, database features disabled')
    databaseAvailable = false
    return null
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '20', 10)
    const timeout = parseInt(process.env.DATABASE_TIMEOUT || '2000', 10)
    
    pool = new Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: timeout,
    })

    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err)
      databaseAvailable = false
    })
  }
  
  return pool
}

// Check if database is available
export function isDatabaseAvailable(): boolean {
  return databaseAvailable !== false && !!process.env.DATABASE_URL
}

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

// Get a database client from the pool
export async function getClient(): Promise<PoolClient | null> {
  const pool = initializePool()
  if (!pool) {
    return null
  }
  
  try {
    return await pool.connect()
  } catch (error) {
    console.error('Failed to get database client:', error)
    databaseAvailable = false
    return null
  }
}

// Execute a query with automatic client release
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available')
  }

  const client = await getClient()
  if (!client) {
    throw new Error('Failed to get database client')
  }

  try {
    const result = await client.query(text, params)
    // Don't set databaseAvailable here - let initialization handle it
    return result.rows
  } catch (error) {
    console.error('Database query error:', error)
    // Only set to false for connection errors, not query errors
    if (error && typeof error === 'object' && 'code' in error) {
      const pgError = error as { code: string }
      // Connection errors
      if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '08000', '08003', '08006'].includes(pgError.code)) {
        databaseAvailable = false
      }
    }
    throw error
  } finally {
    client.release()
  }
}

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    return
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    const createTableQuery = `
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

      CREATE TABLE IF NOT EXISTS dashboard_settings (
        id SERIAL PRIMARY KEY,
        visibility_mode VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility_mode IN ('offline', 'private', 'public')),
        video_feed_enabled BOOLEAN NOT NULL DEFAULT true,
        dashboard_title VARCHAR(255) DEFAULT 's1pper''s Dashboard',
        dashboard_subtitle VARCHAR(255) DEFAULT 'A dashboard for s1pper, the Ender 3 S1 Pro',
        dashboard_icon_url TEXT,
        config_page_enabled BOOLEAN NOT NULL DEFAULT true,
        guestbook_enabled BOOLEAN NOT NULL DEFAULT true,
        streaming_music_file VARCHAR(255),
        streaming_music_enabled BOOLEAN NOT NULL DEFAULT false,
        streaming_music_loop BOOLEAN NOT NULL DEFAULT true,
        streaming_music_volume INTEGER NOT NULL DEFAULT 50 CHECK (streaming_music_volume >= 0 AND streaming_music_volume <= 100),
        streaming_music_playlist TEXT[] DEFAULT '{}',
        streaming_music_crossfade_enabled BOOLEAN NOT NULL DEFAULT false,
        streaming_music_crossfade_duration NUMERIC(3,1) NOT NULL DEFAULT 3.0 CHECK (streaming_music_crossfade_duration >= 0 AND streaming_music_crossfade_duration <= 10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default settings if none exist
      INSERT INTO dashboard_settings (
        visibility_mode, 
        video_feed_enabled, 
        dashboard_title, 
        dashboard_subtitle,
        config_page_enabled,
        guestbook_enabled,
        streaming_music_enabled,
        streaming_music_loop
      )
      SELECT 'public', true, 's1pper''s Dashboard', 'A dashboard for s1pper, the Ender 3 S1 Pro', true, true, false, true
      WHERE NOT EXISTS (SELECT 1 FROM dashboard_settings);

      CREATE INDEX IF NOT EXISTS idx_dashboard_settings_visibility ON dashboard_settings(visibility_mode);
    `

    try {
      await query(createTableQuery)
      isInitialized = true
      console.log('Database tables initialized successfully')
    } catch (error) {
      console.error('Error initializing database:', error)
      initializationPromise = null // Allow retry on next call
      throw error
    }
  })()

  return initializationPromise
}

// Close the database pool (useful for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// Health check for database connection
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    return false
  }

  try {
    await query('SELECT 1')
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    databaseAvailable = false
    return false
  }
}

// Dashboard settings types and functions
export interface DashboardSettings {
  id: number
  visibility_mode: 'offline' | 'private' | 'public'
  video_feed_enabled: boolean
  dashboard_title: string
  dashboard_subtitle: string
  dashboard_icon_url: string | null
  config_page_enabled: boolean
  guestbook_enabled: boolean
  streaming_music_file: string | null
  streaming_music_enabled: boolean
  streaming_music_loop: boolean
  streaming_music_volume: number
  streaming_music_playlist: string[]
  streaming_music_crossfade_enabled: boolean
  streaming_music_crossfade_duration: number
  created_at: string
  updated_at: string
}

// Get current dashboard settings
export async function getDashboardSettings(): Promise<DashboardSettings | null> {
  if (!isDatabaseAvailable()) {
    // Return default settings when database is not available
    return {
      id: 0,
      visibility_mode: 'public',
      video_feed_enabled: true,
      dashboard_title: "s1pper's Dashboard",
      dashboard_subtitle: "A dashboard for s1pper, the Ender 3 S1 Pro",
      dashboard_icon_url: null,
      config_page_enabled: true,
      guestbook_enabled: true,
      streaming_music_file: null,
      streaming_music_enabled: false,
      streaming_music_loop: true,
      streaming_music_volume: 50,
      streaming_music_playlist: [],
      streaming_music_crossfade_enabled: false,
      streaming_music_crossfade_duration: 3.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  try {
    const results = await query<DashboardSettings>('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1')
    if (results[0]) {
      // Convert NUMERIC fields from string to number
      return {
        ...results[0],
        streaming_music_crossfade_duration: parseFloat(results[0].streaming_music_crossfade_duration as any) || 3.0
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching dashboard settings:', error)
    // Return default settings on error
    return {
      id: 0,
      visibility_mode: 'public',
      video_feed_enabled: true,
      dashboard_title: "s1pper's Dashboard",
      dashboard_subtitle: "A dashboard for s1pper, the Ender 3 S1 Pro",
      dashboard_icon_url: null,
      config_page_enabled: true,
      guestbook_enabled: true,
      streaming_music_file: null,
      streaming_music_enabled: false,
      streaming_music_loop: true,
      streaming_music_volume: 50,
      streaming_music_playlist: [],
      streaming_music_crossfade_enabled: false,
      streaming_music_crossfade_duration: 3.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
}

// Update dashboard settings
export async function updateDashboardSettings(
  visibility_mode?: 'offline' | 'private' | 'public',
  video_feed_enabled?: boolean,
  dashboard_title?: string,
  dashboard_subtitle?: string,
  dashboard_icon_url?: string | null,
  config_page_enabled?: boolean,
  guestbook_enabled?: boolean,
  streaming_music_file?: string | null,
  streaming_music_enabled?: boolean,
  streaming_music_loop?: boolean,
  streaming_music_playlist?: string[],
  streaming_music_volume?: number,
  streaming_music_crossfade_enabled?: boolean,
  streaming_music_crossfade_duration?: number
): Promise<DashboardSettings | null> {
  if (!isDatabaseAvailable()) {
    console.warn('Cannot update dashboard settings: database not available')
    return await getDashboardSettings() // Returns default settings
  }

  try {
    // Build dynamic update query
    const updateFields: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (visibility_mode !== undefined) {
      updateFields.push(`visibility_mode = $${paramCount}`)
      values.push(visibility_mode)
      paramCount++
    }

    if (video_feed_enabled !== undefined) {
      updateFields.push(`video_feed_enabled = $${paramCount}`)
      values.push(video_feed_enabled)
      paramCount++
    }

    if (dashboard_title !== undefined) {
      updateFields.push(`dashboard_title = $${paramCount}`)
      values.push(dashboard_title)
      paramCount++
    }

    if (dashboard_subtitle !== undefined) {
      updateFields.push(`dashboard_subtitle = $${paramCount}`)
      values.push(dashboard_subtitle)
      paramCount++
    }

    if (dashboard_icon_url !== undefined) {
      updateFields.push(`dashboard_icon_url = $${paramCount}`)
      values.push(dashboard_icon_url)
      paramCount++
    }

    if (config_page_enabled !== undefined) {
      updateFields.push(`config_page_enabled = $${paramCount}`)
      values.push(config_page_enabled)
      paramCount++
    }

    if (guestbook_enabled !== undefined) {
      updateFields.push(`guestbook_enabled = $${paramCount}`)
      values.push(guestbook_enabled)
      paramCount++
    }

    if (streaming_music_file !== undefined) {
      updateFields.push(`streaming_music_file = $${paramCount}`)
      values.push(streaming_music_file)
      paramCount++
    }

    if (streaming_music_enabled !== undefined) {
      updateFields.push(`streaming_music_enabled = $${paramCount}`)
      values.push(streaming_music_enabled)
      paramCount++
    }

    if (streaming_music_loop !== undefined) {
      updateFields.push(`streaming_music_loop = $${paramCount}`)
      values.push(streaming_music_loop)
      paramCount++
    }

    if (streaming_music_playlist !== undefined) {
      updateFields.push(`streaming_music_playlist = $${paramCount}`)
      values.push(streaming_music_playlist)
      paramCount++
    }

    if (streaming_music_volume !== undefined) {
      updateFields.push(`streaming_music_volume = $${paramCount}`)
      values.push(streaming_music_volume)
      paramCount++
    }

    if (streaming_music_crossfade_enabled !== undefined) {
      updateFields.push(`streaming_music_crossfade_enabled = $${paramCount}`)
      values.push(streaming_music_crossfade_enabled)
      paramCount++
    }

    if (streaming_music_crossfade_duration !== undefined) {
      updateFields.push(`streaming_music_crossfade_duration = $${paramCount}`)
      values.push(streaming_music_crossfade_duration)
      paramCount++
    }

    if (updateFields.length === 0) {
      // No updates requested, return current settings
      return await getDashboardSettings()
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`)

    const updateQuery = `
      UPDATE dashboard_settings 
      SET ${updateFields.join(', ')}
      WHERE id = (SELECT id FROM dashboard_settings ORDER BY id DESC LIMIT 1)
      RETURNING *
    `

    const results = await query<DashboardSettings>(updateQuery, values)
    return results[0] || null
  } catch (error) {
    console.error('Error updating dashboard settings:', error)
    return await getDashboardSettings() // Return default settings on error
  }
}