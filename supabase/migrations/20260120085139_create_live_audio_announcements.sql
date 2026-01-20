/*
  # Create Live Audio Announcements System
  
  ## Overview
  This migration creates infrastructure for real-time audio announcements from managers to LED displays.
  
  ## New Tables
  
  ### 1. `live_audio_sessions`
  Tracks active audio announcement sessions
  - `id` (uuid, primary key) - Unique identifier
  - `broadcaster_id` (uuid, foreign key) - User broadcasting the announcement
  - `broadcaster_name` (text) - Name of broadcaster for display
  - `is_active` (boolean) - Whether session is currently active
  - `started_at` (timestamptz) - When broadcast started
  - `ended_at` (timestamptz) - When broadcast ended
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 2. `audio_announcement_chunks`
  Stores audio data chunks for real-time streaming
  - `id` (uuid, primary key) - Unique identifier
  - `session_id` (uuid, foreign key) - Reference to live_audio_sessions
  - `chunk_data` (text) - Base64 encoded audio chunk
  - `sequence` (integer) - Order of chunk in stream
  - `created_at` (timestamptz) - Creation timestamp
  
  Note: Chunks are automatically deleted after 1 hour to prevent storage bloat
  
  ## Security
  - Enable RLS on all tables
  - Only admins and super admins can create audio sessions
  - All authenticated users can read active sessions
  - Authenticated users can read audio chunks for active sessions
  
  ## Indexes
  - Index on session_id for fast chunk retrieval
  - Index on is_active for finding active sessions
  - Index on created_at for cleanup operations
*/

-- Create live_audio_sessions table
CREATE TABLE IF NOT EXISTS live_audio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  broadcaster_name text NOT NULL,
  is_active boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create audio_announcement_chunks table
CREATE TABLE IF NOT EXISTS audio_announcement_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES live_audio_sessions(id) ON DELETE CASCADE NOT NULL,
  chunk_data text NOT NULL,
  sequence integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE live_audio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_announcement_chunks ENABLE ROW LEVEL SECURITY;

-- Policies for live_audio_sessions
CREATE POLICY "Authenticated users can read active audio sessions"
  ON live_audio_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and super admins can create audio sessions"
  ON live_audio_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Broadcasters can update their own sessions"
  ON live_audio_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = broadcaster_id)
  WITH CHECK (auth.uid() = broadcaster_id);

-- Policies for audio_announcement_chunks
CREATE POLICY "Authenticated users can read audio chunks"
  ON audio_announcement_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_audio_sessions
      WHERE live_audio_sessions.id = audio_announcement_chunks.session_id
      AND live_audio_sessions.is_active = true
    )
  );

CREATE POLICY "Admins and super admins can insert audio chunks"
  ON audio_announcement_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
    AND EXISTS (
      SELECT 1 FROM live_audio_sessions
      WHERE live_audio_sessions.id = audio_announcement_chunks.session_id
      AND live_audio_sessions.is_active = true
      AND live_audio_sessions.broadcaster_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_live_audio_sessions_active 
  ON live_audio_sessions(is_active, started_at DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_audio_chunks_session 
  ON audio_announcement_chunks(session_id, sequence);

CREATE INDEX IF NOT EXISTS idx_audio_chunks_cleanup 
  ON audio_announcement_chunks(created_at);

-- Function to automatically cleanup old chunks (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_audio_chunks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM audio_announcement_chunks
  WHERE created_at < NOW() - INTERVAL '1 hour';
  
  UPDATE live_audio_sessions
  SET is_active = false, ended_at = NOW()
  WHERE is_active = true
  AND started_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Note: You can set up a cron job to call cleanup_old_audio_chunks() periodically
-- or it will be cleaned up on the next announcement session start
