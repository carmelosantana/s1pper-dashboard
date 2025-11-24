import { Pool, PoolClient } from 'pg'
import { CameraSettings } from './types'

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

      CREATE TABLE IF NOT EXISTS module_settings (
        id SERIAL PRIMARY KEY,
        module_id VARCHAR(255) NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT false,
        position VARCHAR(50) DEFAULT 'main',
        display_order INTEGER DEFAULT 0,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_module_settings_enabled ON module_settings(enabled);
      CREATE INDEX IF NOT EXISTS idx_module_settings_position ON module_settings(position);
      CREATE INDEX IF NOT EXISTS idx_module_settings_order ON module_settings(display_order);

      INSERT INTO module_settings (module_id, enabled, position, display_order, settings)
      VALUES ('grow-tent', false, 'main', 0, '{"apiUrl": "http://localhost:3000", "refreshInterval": 30000, "showControls": true, "compactView": false}'::jsonb)
      ON CONFLICT (module_id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS dashboard_settings (
        id SERIAL PRIMARY KEY,
        visibility_mode VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility_mode IN ('offline', 'private', 'public')),
        video_feed_enabled BOOLEAN NOT NULL DEFAULT true,
        video_feed_disabled_message TEXT DEFAULT 'Video feed is disabled',
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
        streaming_title_enabled BOOLEAN NOT NULL DEFAULT true,
        selected_camera_uid VARCHAR(255),
        stream_camera_display_mode VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (stream_camera_display_mode IN ('single', 'grid', 'pip')),
        horizontal_stream_camera_display_mode VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (horizontal_stream_camera_display_mode IN ('single', 'grid', 'pip')),
        vertical_stream_camera_display_mode VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (vertical_stream_camera_display_mode IN ('single', 'grid', 'pip')),
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

      CREATE TABLE IF NOT EXISTS camera_settings (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_camera_settings_uid ON camera_settings(uid);
      CREATE INDEX IF NOT EXISTS idx_camera_settings_enabled ON camera_settings(enabled);
      CREATE INDEX IF NOT EXISTS idx_camera_settings_order ON camera_settings(display_order);

      -- Per-view camera settings
      CREATE TABLE IF NOT EXISTS view_camera_settings (
        id SERIAL PRIMARY KEY,
        view_name VARCHAR(50) NOT NULL CHECK (view_name IN ('stream', 'horizontal', 'vertical')),
        camera_uid VARCHAR(255) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(view_name, camera_uid)
      );

      CREATE INDEX IF NOT EXISTS idx_view_camera_view_name ON view_camera_settings(view_name);
      CREATE INDEX IF NOT EXISTS idx_view_camera_uid ON view_camera_settings(camera_uid);
      CREATE INDEX IF NOT EXISTS idx_view_camera_enabled ON view_camera_settings(enabled);
      CREATE INDEX IF NOT EXISTS idx_view_camera_order ON view_camera_settings(display_order);

      -- Add pip main camera fields to dashboard_settings if they don't exist
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='dashboard_settings' 
                      AND column_name='stream_pip_main_camera_uid') THEN
          ALTER TABLE dashboard_settings ADD COLUMN stream_pip_main_camera_uid VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='dashboard_settings' 
                      AND column_name='horizontal_pip_main_camera_uid') THEN
          ALTER TABLE dashboard_settings ADD COLUMN horizontal_pip_main_camera_uid VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='dashboard_settings' 
                      AND column_name='vertical_pip_main_camera_uid') THEN
          ALTER TABLE dashboard_settings ADD COLUMN vertical_pip_main_camera_uid VARCHAR(255);
        END IF;
      END $$;
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
  video_feed_disabled_message?: string
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
  streaming_title_enabled: boolean
  selected_camera_uid: string | null
  stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  horizontal_stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  vertical_stream_camera_display_mode: 'single' | 'grid' | 'pip' | 'offline_video_swap'
  stream_pip_main_camera_uid: string | null
  horizontal_pip_main_camera_uid: string | null
  vertical_pip_main_camera_uid: string | null
  created_at: string
  updated_at: string
}

// View camera settings
export interface ViewCameraSettings {
  id: number
  view_name: 'stream' | 'horizontal' | 'vertical'
  camera_uid: string
  enabled: boolean
  display_order: number
  created_at: string
  updated_at: string
}

/**
 * Module Settings Interface
 */
export interface ModuleSettings {
  id: number
  module_id: string
  enabled: boolean
  position: 'main' | 'sidebar' | 'bottom' | 'floating'
  display_order: number
  settings: any // JSONB column
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
      streaming_title_enabled: true,
      selected_camera_uid: null,
      stream_camera_display_mode: 'single',
      horizontal_stream_camera_display_mode: 'single',
      vertical_stream_camera_display_mode: 'single',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  try {
    const results = await query<DashboardSettings>('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1')
    if (results[0]) {
      return results[0]
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
      streaming_title_enabled: true,
      selected_camera_uid: null,
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
  streaming_title_enabled?: boolean,
  selected_camera_uid?: string | null,
  stream_camera_display_mode?: 'single' | 'grid' | 'pip',
  horizontal_stream_camera_display_mode?: 'single' | 'grid' | 'pip',
  vertical_stream_camera_display_mode?: 'single' | 'grid' | 'pip',
  stream_pip_main_camera_uid?: string | null,
  horizontal_pip_main_camera_uid?: string | null,
  vertical_pip_main_camera_uid?: string | null
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

    if (streaming_title_enabled !== undefined) {
      updateFields.push(`streaming_title_enabled = $${paramCount}`)
      values.push(streaming_title_enabled)
      paramCount++
    }

    if (selected_camera_uid !== undefined) {
      updateFields.push(`selected_camera_uid = $${paramCount}`)
      values.push(selected_camera_uid)
      paramCount++
    }

    if (stream_camera_display_mode !== undefined) {
      updateFields.push(`stream_camera_display_mode = $${paramCount}`)
      values.push(stream_camera_display_mode)
      paramCount++
    }

    if (horizontal_stream_camera_display_mode !== undefined) {
      updateFields.push(`horizontal_stream_camera_display_mode = $${paramCount}`)
      values.push(horizontal_stream_camera_display_mode)
      paramCount++
    }

    if (vertical_stream_camera_display_mode !== undefined) {
      updateFields.push(`vertical_stream_camera_display_mode = $${paramCount}`)
      values.push(vertical_stream_camera_display_mode)
      paramCount++
    }

    if (stream_pip_main_camera_uid !== undefined) {
      updateFields.push(`stream_pip_main_camera_uid = $${paramCount}`)
      values.push(stream_pip_main_camera_uid)
      paramCount++
    }

    if (horizontal_pip_main_camera_uid !== undefined) {
      updateFields.push(`horizontal_pip_main_camera_uid = $${paramCount}`)
      values.push(horizontal_pip_main_camera_uid)
      paramCount++
    }

    if (vertical_pip_main_camera_uid !== undefined) {
      updateFields.push(`vertical_pip_main_camera_uid = $${paramCount}`)
      values.push(vertical_pip_main_camera_uid)
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
// Camera settings functions
export async function getCameraSettings(): Promise<CameraSettings[]> {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const results = await query<CameraSettings>('SELECT * FROM camera_settings ORDER BY display_order, name')
    return results
  } catch (error) {
    console.error('Error fetching camera settings:', error)
    return []
  }
}

export async function getCameraSettingByUid(uid: string): Promise<CameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<CameraSettings>('SELECT * FROM camera_settings WHERE uid = $1', [uid])
    return results[0] || null
  } catch (error) {
    console.error('Error fetching camera setting:', error)
    return null
  }
}

export async function upsertCameraSettings(cameras: Array<{ uid: string; name: string }>): Promise<void> {
  if (!isDatabaseAvailable()) {
    return
  }

  try {
    for (const camera of cameras) {
      await query(
        `INSERT INTO camera_settings (uid, name, enabled) 
         VALUES ($1, $2, true) 
         ON CONFLICT (uid) 
         DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP`,
        [camera.uid, camera.name]
      )
    }
  } catch (error) {
    console.error('Error upserting camera settings:', error)
  }
}

export async function updateCameraEnabled(uid: string, enabled: boolean): Promise<CameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<CameraSettings>(
      `UPDATE camera_settings 
       SET enabled = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE uid = $2 
       RETURNING *`,
      [enabled, uid]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error updating camera enabled state:', error)
    return null
  }
}

export async function updateCameraDisplayOrder(uid: string, display_order: number): Promise<CameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<CameraSettings>(
      `UPDATE camera_settings 
       SET display_order = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE uid = $2 
       RETURNING *`,
      [display_order, uid]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error updating camera display order:', error)
    return null
  }
}

// View camera settings functions
export async function getViewCameraSettings(viewName: 'stream' | 'horizontal' | 'vertical'): Promise<ViewCameraSettings[]> {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const results = await query<ViewCameraSettings>(
      'SELECT * FROM view_camera_settings WHERE view_name = $1 ORDER BY display_order, camera_uid',
      [viewName]
    )
    return results
  } catch (error) {
    console.error('Error fetching view camera settings:', error)
    return []
  }
}

export async function getViewCameraSettingByUid(viewName: 'stream' | 'horizontal' | 'vertical', cameraUid: string): Promise<ViewCameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<ViewCameraSettings>(
      'SELECT * FROM view_camera_settings WHERE view_name = $1 AND camera_uid = $2',
      [viewName, cameraUid]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error fetching view camera setting:', error)
    return null
  }
}

export async function upsertViewCameraSettings(viewName: 'stream' | 'horizontal' | 'vertical', cameras: Array<{ uid: string; enabled?: boolean; display_order?: number }>): Promise<void> {
  if (!isDatabaseAvailable()) {
    return
  }

  try {
    for (const camera of cameras) {
      await query(
        `INSERT INTO view_camera_settings (view_name, camera_uid, enabled, display_order) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (view_name, camera_uid) 
         DO UPDATE SET enabled = $3, display_order = $4, updated_at = CURRENT_TIMESTAMP`,
        [viewName, camera.uid, camera.enabled ?? true, camera.display_order ?? 0]
      )
    }
  } catch (error) {
    console.error('Error upserting view camera settings:', error)
  }
}

export async function updateViewCameraEnabled(viewName: 'stream' | 'horizontal' | 'vertical', cameraUid: string, enabled: boolean): Promise<ViewCameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<ViewCameraSettings>(
      `INSERT INTO view_camera_settings (view_name, camera_uid, enabled) 
       VALUES ($1, $2, $3)
       ON CONFLICT (view_name, camera_uid)
       DO UPDATE SET enabled = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [viewName, cameraUid, enabled]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error updating view camera enabled state:', error)
    return null
  }
}

/**
 * Module Settings Functions
 */

/**
 * Get all module settings
 */
export async function getAllModuleSettings(): Promise<ModuleSettings[]> {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const results = await query<ModuleSettings>(
      'SELECT * FROM module_settings ORDER BY display_order, module_id'
    )
    return results
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return []
  }
}

/**
 * Get settings for a specific module
 */
export async function getModuleSettings(moduleId: string): Promise<ModuleSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<ModuleSettings>(
      'SELECT * FROM module_settings WHERE module_id = $1',
      [moduleId]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return null
  }
}

/**
 * Get all enabled modules
 */
export async function getEnabledModules(): Promise<ModuleSettings[]> {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const results = await query<ModuleSettings>(
      'SELECT * FROM module_settings WHERE enabled = true ORDER BY display_order, module_id'
    )
    return results
  } catch (error) {
    console.error('Error fetching enabled modules:', error)
    return []
  }
}

/**
 * Update module settings
 */
export async function updateModuleSettings(
  moduleId: string,
  updates: Partial<Omit<ModuleSettings, 'id' | 'module_id' | 'created_at' | 'updated_at'>>
): Promise<ModuleSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const setClauses: string[] = []
    const values: any[] = [moduleId]
    let paramIndex = 2

    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`)
      values.push(updates.enabled)
    }

    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex++}`)
      values.push(updates.position)
    }

    if (updates.display_order !== undefined) {
      setClauses.push(`display_order = $${paramIndex++}`)
      values.push(updates.display_order)
    }

    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`)
      values.push(JSON.stringify(updates.settings))
    }

    if (setClauses.length === 0) {
      return await getModuleSettings(moduleId)
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP')

    const results = await query<ModuleSettings>(
      `UPDATE module_settings 
       SET ${setClauses.join(', ')}
       WHERE module_id = $1
       RETURNING *`,
      values
    )

    return results[0] || null
  } catch (error) {
    console.error('Error updating module settings:', error)
    return null
  }
}

/**
 * Upsert module settings (create if not exists, update if exists)
 */
export async function upsertModuleSettings(
  moduleId: string,
  enabled: boolean,
  position: 'main' | 'sidebar' | 'bottom' | 'floating',
  displayOrder: number,
  settings: any
): Promise<ModuleSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<ModuleSettings>(
      `INSERT INTO module_settings (module_id, enabled, position, display_order, settings)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (module_id)
       DO UPDATE SET 
         enabled = $2,
         position = $3,
         display_order = $4,
         settings = $5,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [moduleId, enabled, position, displayOrder, JSON.stringify(settings)]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error upserting module settings:', error)
    return null
  }
}

export async function updateViewCameraDisplayOrder(viewName: 'stream' | 'horizontal' | 'vertical', cameraUid: string, display_order: number): Promise<ViewCameraSettings | null> {
  if (!isDatabaseAvailable()) {
    return null
  }

  try {
    const results = await query<ViewCameraSettings>(
      `INSERT INTO view_camera_settings (view_name, camera_uid, display_order) 
       VALUES ($1, $2, $3)
       ON CONFLICT (view_name, camera_uid)
       DO UPDATE SET display_order = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [viewName, cameraUid, display_order]
    )
    return results[0] || null
  } catch (error) {
    console.error('Error updating view camera display order:', error)
    return null
  }
}
