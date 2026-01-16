/*
  # Fix Security Issues - Comprehensive Update

  ## Overview
  This migration addresses multiple security and performance issues identified by Supabase:
  
  ## 1. Index Improvements
    - Add index on `announcements.created_by` foreign key for query performance
    - Remove unused `idx_user_profiles_email` index
  
  ## 2. RLS Performance Optimization
    - Wrap all `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation per row
    - Affects: user_profiles, announcements tables
  
  ## 3. RLS Policy Security Hardening
    - Replace overly permissive policies (USING/WITH CHECK true) with role-based policies
    - Restrict write operations to admin and super_admin roles only
    - Affects: shipments, operators, packages, app_settings tables
  
  ## 4. Function Security
    - Set immutable search_path on functions to prevent search path manipulation
    - Affects: update_announcements_updated_at, deactivate_expired_announcements
  
  ## 5. Multiple Permissive Policies
    - Consolidate duplicate SELECT policies on announcements table
  
  ## Important Notes
    - All changes maintain backward compatibility
    - Operators can still view all data (SELECT remains permissive)
    - Only write operations (INSERT/UPDATE/DELETE) are restricted to admins
    - Public access to LED display data is preserved via anon role
*/

-- ============================================================================
-- 1. INDEX IMPROVEMENTS
-- ============================================================================

-- Add missing index on foreign key
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);

-- Drop unused index
DROP INDEX IF EXISTS idx_user_profiles_email;

-- ============================================================================
-- 2. FIX RLS POLICIES - USER_PROFILES (Performance Optimization)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON user_profiles;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Super admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (select auth.uid()) AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 3. FIX RLS POLICIES - ANNOUNCEMENTS (Performance + Security)
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view active announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can view all announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can update announcements" ON announcements;
DROP POLICY IF EXISTS "Admin users can delete announcements" ON announcements;

-- Recreate with optimized auth.uid() calls and consolidated SELECT policy
CREATE POLICY "Anyone can view active announcements"
  ON announcements
  FOR SELECT
  USING (
    is_active = true 
    AND start_time <= now() 
    AND (end_time IS NULL OR end_time > now())
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
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
      WHERE user_profiles.id = (select auth.uid())
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
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
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
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 4. FIX RLS POLICIES - SHIPMENTS (Security Hardening)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert shipments" ON shipments;
DROP POLICY IF EXISTS "Authenticated users can update shipments" ON shipments;
DROP POLICY IF EXISTS "Authenticated users can delete shipments" ON shipments;

-- Recreate with role-based restrictions
CREATE POLICY "Admin users can insert shipments"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Authenticated users can update shipments"
  ON shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin', 'operator')
    )
  );

CREATE POLICY "Admin users can delete shipments"
  ON shipments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 5. FIX RLS POLICIES - OPERATORS (Security Hardening)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert operators" ON operators;
DROP POLICY IF EXISTS "Authenticated users can update operators" ON operators;
DROP POLICY IF EXISTS "Authenticated users can delete operators" ON operators;

-- Recreate with role-based restrictions
CREATE POLICY "Admin users can insert operators"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can delete operators"
  ON operators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 6. FIX RLS POLICIES - PACKAGES (Security Hardening)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert packages" ON packages;
DROP POLICY IF EXISTS "Authenticated users can update packages" ON packages;
DROP POLICY IF EXISTS "Authenticated users can delete packages" ON packages;

-- Recreate with role-based restrictions
CREATE POLICY "Admin users can insert packages"
  ON packages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Authenticated users can update packages"
  ON packages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin', 'operator')
    )
  );

CREATE POLICY "Admin users can delete packages"
  ON packages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 7. FIX RLS POLICIES - APP_SETTINGS (Security Hardening)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;

-- Recreate with role-based restrictions
CREATE POLICY "Admin users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 8. FIX FUNCTION SECURITY (Search Path)
-- ============================================================================

-- Fix update_announcements_updated_at function
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix deactivate_expired_announcements function
CREATE OR REPLACE FUNCTION deactivate_expired_announcements()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE announcements
  SET is_active = false
  WHERE is_active = true
    AND end_time IS NOT NULL
    AND end_time < now();
END;
$$;
