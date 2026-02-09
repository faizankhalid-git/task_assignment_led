/*
  # Add KPI Permission for Super Admins

  1. Changes
    - Adds 'kpi' permission to all existing super_admin users
    - This permission grants access to the Performance KPI Dashboard

  2. Security
    - Only super_admin role users should have this permission
    - KPI data contains sensitive performance metrics

  3. Notes
    - This migration is idempotent and safe to run multiple times
    - Non super_admin users will not be affected
*/

-- Add 'kpi' permission to all existing super_admin users
UPDATE user_profiles
SET permissions = array_append(permissions, 'kpi')
WHERE role = 'super_admin'
  AND NOT ('kpi' = ANY(permissions));