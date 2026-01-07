/*
  # Add User Permissions System

  1. Changes
    - Add `permissions` column to `user_profiles` table
      - Stores array of permission strings
      - Default permissions based on role
    
  2. Permissions
    - `led_display`: Can view LED display
    - `shipments`: Can view and manage shipments
    - `operators`: Can view and manage operators
    - `settings`: Can view and manage settings
    - `users`: Can manage users (super admin only)
  
  3. Default Permissions by Role
    - super_admin: All permissions
    - admin: All except users management
    - operator: Only led_display and shipments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN permissions text[] DEFAULT ARRAY['led_display', 'shipments'];
  END IF;
END $$;

-- Update existing users with appropriate permissions based on their role
UPDATE user_profiles
SET permissions = CASE
  WHEN role = 'super_admin' THEN ARRAY['led_display', 'shipments', 'operators', 'settings', 'users']
  WHEN role = 'admin' THEN ARRAY['led_display', 'shipments', 'operators', 'settings']
  WHEN role = 'operator' THEN ARRAY['led_display', 'shipments']
  ELSE ARRAY['led_display']
END
WHERE permissions = ARRAY['led_display', 'shipments'];
