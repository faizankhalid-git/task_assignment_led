/*
  # Create Notification System
  
  ## Overview
  This migration creates a comprehensive notification system for audio alerts and LED screen messages.
  
  ## New Tables
  
  ### 1. `notification_settings`
  Global notification configuration table
  - `id` (uuid, primary key) - Unique identifier
  - `setting_key` (text, unique) - Setting identifier (e.g., 'operator_assigned_sound')
  - `setting_value` (jsonb) - Setting value (sound type, volume, enabled, etc.)
  - `description` (text) - Human-readable description
  - `category` (text) - Category (operator, announcement, system)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `user_notification_preferences`
  Per-user notification preferences
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - Reference to auth.users
  - `notification_type` (text) - Type of notification
  - `sound_enabled` (boolean) - Whether sound is enabled
  - `sound_type` (text) - Sound type (chime, beep, tone, etc.)
  - `volume` (integer) - Volume level (0-100)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. `operator_assignment_history`
  Track operator assignment changes for notifications
  - `id` (uuid, primary key) - Unique identifier
  - `operator_id` (uuid, foreign key) - Reference to operators table
  - `action_type` (text) - Type of action (assigned, reassigned, removed)
  - `action_details` (jsonb) - Additional details about the action
  - `triggered_by` (uuid) - User who triggered the change
  - `notification_sent` (boolean) - Whether notification was sent
  - `created_at` (timestamptz) - When action occurred
  
  ### 4. `led_welcome_messages`
  Store welcome messages displayed on LED screen
  - `id` (uuid, primary key) - Unique identifier
  - `operator_id` (uuid, foreign key) - Reference to operators table
  - `message_template` (text) - Message template
  - `display_duration` (integer) - Duration in seconds
  - `displayed` (boolean) - Whether message was displayed
  - `displayed_at` (timestamptz) - When message was displayed
  - `created_at` (timestamptz) - Creation timestamp
  
  ## Security
  - Enable RLS on all tables
  - Authenticated users can read notification settings
  - Only super admins can modify notification settings
  - Users can manage their own notification preferences
  - Admins can view operator assignment history
  - All users can view LED welcome messages
*/

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  category text NOT NULL DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,
  sound_enabled boolean DEFAULT true,
  sound_type text DEFAULT 'chime-soft',
  volume integer DEFAULT 70 CHECK (volume >= 0 AND volume <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Create operator_assignment_history table
CREATE TABLE IF NOT EXISTS operator_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('assigned', 'reassigned', 'removed', 'created')),
  action_details jsonb DEFAULT '{}'::jsonb,
  triggered_by uuid REFERENCES auth.users(id),
  notification_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create led_welcome_messages table
CREATE TABLE IF NOT EXISTS led_welcome_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  message_template text NOT NULL,
  display_duration integer DEFAULT 10 CHECK (display_duration > 0),
  displayed boolean DEFAULT false,
  displayed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE led_welcome_messages ENABLE ROW LEVEL SECURITY;

-- Policies for notification_settings
CREATE POLICY "Authenticated users can read notification settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert notification settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update notification settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete notification settings"
  ON notification_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Policies for user_notification_preferences
CREATE POLICY "Users can read own notification preferences"
  ON user_notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
  ON user_notification_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for operator_assignment_history
CREATE POLICY "Admins and super admins can read operator assignment history"
  ON operator_assignment_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Authenticated users can insert operator assignment history"
  ON operator_assignment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for led_welcome_messages
CREATE POLICY "Authenticated users can read LED welcome messages"
  ON led_welcome_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert LED welcome messages"
  ON led_welcome_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update LED welcome messages"
  ON led_welcome_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default notification settings
INSERT INTO notification_settings (setting_key, setting_value, description, category)
VALUES
  ('operator_assigned', '{"enabled": true, "soundType": "chime-medium", "volume": 70}'::jsonb, 'Sound when operator is assigned', 'operator'),
  ('operator_reassigned', '{"enabled": true, "soundType": "beep-double", "volume": 75}'::jsonb, 'Sound when operator is reassigned', 'operator'),
  ('operator_removed', '{"enabled": true, "soundType": "tone-descending", "volume": 70}'::jsonb, 'Sound when operator is removed', 'operator'),
  ('announcement_general', '{"enabled": true, "soundType": "chime-soft", "volume": 60}'::jsonb, 'Sound for general announcements', 'announcement'),
  ('announcement_priority', '{"enabled": true, "soundType": "beep-triple", "volume": 80}'::jsonb, 'Sound for priority announcements', 'announcement'),
  ('announcement_emergency', '{"enabled": true, "soundType": "alert-critical", "volume": 90}'::jsonb, 'Sound for emergency announcements', 'announcement'),
  ('welcome_message_enabled', '{"enabled": true, "duration": 10, "template": "Welcome {name}! Today is {date}"}'::jsonb, 'LED welcome message settings', 'system'),
  ('master_volume', '{"volume": 70}'::jsonb, 'Master volume control', 'system')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_operator_assignment_history_operator 
  ON operator_assignment_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_assignment_history_created 
  ON operator_assignment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_led_welcome_messages_displayed 
  ON led_welcome_messages(displayed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user 
  ON user_notification_preferences(user_id);
