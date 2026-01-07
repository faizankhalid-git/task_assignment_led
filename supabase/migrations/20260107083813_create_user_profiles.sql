/*
  # Create user profiles table
  
  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key) - References auth.users.id
      - `email` (text) - User email for display
      - `role` (text) - User role: 'super_admin' | 'admin' | 'operator'
      - `full_name` (text) - Optional full name
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on user_profiles
    - Authenticated users can read all profiles
    - Only super admins can insert/update/delete profiles
    - Users can read their own profile
  
  3. Important Notes
    - This table references auth.users with CASCADE delete
    - Role field is constrained to valid values only
    - Indexes added for performance on role and email lookups
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('super_admin', 'admin', 'operator')),
  full_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for SELECT
CREATE POLICY "Authenticated users can view profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Policies for INSERT
CREATE POLICY "Super admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policies for UPDATE
CREATE POLICY "Super admins can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policies for DELETE
CREATE POLICY "Super admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);