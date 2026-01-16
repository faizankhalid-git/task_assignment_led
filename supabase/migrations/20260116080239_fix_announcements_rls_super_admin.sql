/*
  # Fix Announcements RLS Policies for Super Admin

  ## Changes
  - Update all announcements policies to allow both 'admin' and 'super_admin' roles
  - Policies affected: SELECT, INSERT, UPDATE, DELETE

  ## Security
  - Maintains secure access control
  - Only admin and super_admin roles can manage announcements
  - Public can still view active announcements on LED display
*/

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admin users can view all announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can update announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can delete announcements" ON announcements;

-- Recreate policies with super_admin support
CREATE POLICY "Admin users can view all announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can create announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can update announcements"
  ON announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can delete announcements"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );
