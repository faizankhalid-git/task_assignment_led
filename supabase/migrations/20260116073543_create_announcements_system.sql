/*
  # Create Announcements System

  ## Overview
  This migration creates a comprehensive announcement system for the LED display,
  allowing administrators to post, schedule, and manage announcements with priority levels.

  ## 1. New Tables
    - `announcements`
      - `id` (uuid, primary key) - Unique identifier for each announcement
      - `title` (text, required) - Announcement title/heading
      - `message` (text, required) - Main announcement content
      - `priority` (text, required) - Priority level: 'low', 'medium', 'high', 'urgent'
      - `display_duration` (integer, required) - How long to display in seconds (0 = until manually deleted)
      - `start_time` (timestamptz, required) - When the announcement should start displaying
      - `end_time` (timestamptz, nullable) - When the announcement should stop displaying
      - `is_active` (boolean, default true) - Whether announcement is currently active
      - `background_color` (text, default '#1e293b') - Background color for the announcement
      - `text_color` (text, default '#ffffff') - Text color for readability
      - `created_by` (uuid, foreign key) - User who created the announcement
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
    - Enable RLS on `announcements` table
    - Policy: Anyone can view active announcements (for LED display public access)
    - Policy: Authenticated users with admin role can manage all announcements

  ## 3. Indexes
    - Index on `is_active` for fast filtering of active announcements
    - Index on `start_time` and `end_time` for scheduling queries
    - Index on `priority` for ordering announcements

  ## 4. Important Notes
    - Announcements are automatically shown on LED display when active
    - Priority determines display order (urgent > high > medium > low)
    - display_duration of 0 means announcement stays until manually deleted
    - Background and text colors ensure readability on LED displays
*/

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  display_duration integer NOT NULL DEFAULT 0,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  background_color text NOT NULL DEFAULT '#1e293b',
  text_color text NOT NULL DEFAULT '#ffffff',
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_times ON announcements(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

-- Enable Row Level Security
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active announcements (for LED display public access)
CREATE POLICY "Anyone can view active announcements"
  ON announcements
  FOR SELECT
  USING (is_active = true AND start_time <= now() AND (end_time IS NULL OR end_time > now()));

-- Policy: Authenticated users with admin role can view all announcements
CREATE POLICY "Admin users can view all announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Authenticated users with admin role can create announcements
CREATE POLICY "Admin users can create announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Authenticated users with admin role can update announcements
CREATE POLICY "Admin users can update announcements"
  ON announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Authenticated users with admin role can delete announcements
CREATE POLICY "Admin users can delete announcements"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS announcements_updated_at ON announcements;
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- Create function to auto-deactivate expired announcements
CREATE OR REPLACE FUNCTION deactivate_expired_announcements()
RETURNS void AS $$
BEGIN
  UPDATE announcements
  SET is_active = false
  WHERE is_active = true
    AND end_time IS NOT NULL
    AND end_time < now();
END;
$$ LANGUAGE plpgsql;
