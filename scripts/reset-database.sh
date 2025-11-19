#!/bin/bash

# Reset Database Script
# This script drops and recreates the database tables
# WARNING: This will delete ALL data!

echo "⚠️  WARNING: This will delete ALL database data!"
echo "This script will:"
echo "  1. Drop existing tables (guestbook_entries, dashboard_settings)"
echo "  2. Recreate tables with the latest schema"
echo "  3. Insert default settings"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Reset cancelled"
  exit 0
fi

echo ""
echo "🗑️  Dropping existing tables..."

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Run SQL commands using psql
psql $DATABASE_URL << EOF
-- Drop existing tables
DROP TABLE IF EXISTS guestbook_entries CASCADE;
DROP TABLE IF EXISTS dashboard_settings CASCADE;

-- Create guestbook_entries table
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

-- Create dashboard_settings table
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

CREATE INDEX IF NOT EXISTS idx_dashboard_settings_visibility ON dashboard_settings(visibility_mode);

-- Insert default settings
INSERT INTO dashboard_settings (
  visibility_mode, 
  video_feed_enabled, 
  dashboard_title, 
  dashboard_subtitle,
  config_page_enabled,
  guestbook_enabled,
  streaming_music_enabled,
  streaming_music_loop,
  streaming_music_volume,
  streaming_music_crossfade_enabled,
  streaming_music_crossfade_duration
)
VALUES (
  'public', 
  true, 
  's1pper''s Dashboard', 
  'A dashboard for s1pper, the Ender 3 S1 Pro', 
  true, 
  true, 
  false, 
  true,
  50,
  false,
  3.0
);
EOF

if [ $? -eq 0 ]; then
  echo "✅ Database reset successfully!"
  echo ""
  echo "Tables created:"
  echo "  - guestbook_entries"
  echo "  - dashboard_settings"
  echo ""
  echo "You can now start the development server with: pnpm dev"
else
  echo "❌ Error resetting database"
  exit 1
fi
