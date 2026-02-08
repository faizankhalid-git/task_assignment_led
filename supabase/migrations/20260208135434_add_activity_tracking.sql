/*
  # Add Activity Tracking Fields

  ## Changes
  1. Add activity tracking columns to shipments table
    - `created_by` (uuid, references auth.users)
    - `updated_by` (uuid, references auth.users)
    - `completed_by` (uuid, references auth.users)
    - `completed_at` (timestamptz)

  2. Create helper view to join with user profiles for display names

  ## Purpose
  Track who created, updated, and completed each shipment for audit trail and user feedback.
  Display this information in hover tooltips for transparency.
*/

-- Add activity tracking columns to shipments table
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_created_by ON shipments(created_by);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_by ON shipments(updated_by);
CREATE INDEX IF NOT EXISTS idx_shipments_completed_by ON shipments(completed_by);

-- Create a view that includes user emails for easy display
CREATE OR REPLACE VIEW shipments_with_users AS
SELECT
  s.*,
  creator.email as created_by_email,
  updater.email as updated_by_email,
  completer.email as completed_by_email
FROM shipments s
LEFT JOIN auth.users creator ON s.created_by = creator.id
LEFT JOIN auth.users updater ON s.updated_by = updater.id
LEFT JOIN auth.users completer ON s.completed_by = completer.id;

-- Grant access to the view
GRANT SELECT ON shipments_with_users TO authenticated;
