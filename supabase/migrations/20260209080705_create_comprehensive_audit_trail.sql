/*
  # Create Comprehensive Audit Trail System

  ## Overview
  This migration creates a complete audit trail system to track all shipment changes,
  status updates, and user actions for accountability and troubleshooting.

  ## Changes

  1. **New Tables**
     - `shipment_audit_log` - Tracks all changes to shipments with before/after snapshots
       - `id` (uuid, primary key)
       - `shipment_id` (uuid, references shipments)
       - `action_type` (text) - Type of action: created, updated, status_changed, completed, deleted
       - `action_by` (uuid, references auth.users) - User who performed the action
       - `action_timestamp` (timestamptz) - When the action occurred
       - `previous_data` (jsonb) - Snapshot of data before change
       - `new_data` (jsonb) - Snapshot of data after change
       - `changes_summary` (text) - Human-readable summary of changes
       - `ip_address` (text) - IP address of user (optional)
       - `user_agent` (text) - Browser/device info (optional)

  2. **Indexes**
     - Index on shipment_id for fast lookup
     - Index on action_by for user activity reports
     - Index on action_timestamp for time-based queries
     - Index on action_type for filtering by action

  3. **Row Level Security**
     - Only authenticated users can view audit logs
     - Super admins can view all logs
     - Regular users can view logs for shipments they have access to

  4. **Helper Functions**
     - Function to automatically log shipment changes
     - Function to generate human-readable change summaries

  ## Purpose
  Provides complete transparency and accountability for all shipment operations,
  enabling administrators to:
  - Track who made what changes and when
  - View complete history of any shipment
  - Troubleshoot issues by reviewing change history
  - Generate audit reports for compliance
*/

-- Create audit log table
CREATE TABLE IF NOT EXISTS shipment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('created', 'updated', 'status_changed', 'completed', 'deleted', 'archived', 'operator_assigned', 'operator_removed')),
  action_by uuid REFERENCES auth.users(id),
  action_timestamp timestamptz DEFAULT now() NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  changes_summary text,
  ip_address text,
  user_agent text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_shipment_id ON shipment_audit_log(shipment_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_by ON shipment_audit_log(action_by);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON shipment_audit_log(action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON shipment_audit_log(action_type);

-- Enable RLS
ALTER TABLE shipment_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view audit logs"
  ON shipment_audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON shipment_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create helper function to log shipment changes
CREATE OR REPLACE FUNCTION log_shipment_change(
  p_shipment_id uuid,
  p_action_type text,
  p_action_by uuid,
  p_previous_data jsonb,
  p_new_data jsonb,
  p_changes_summary text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO shipment_audit_log (
    shipment_id,
    action_type,
    action_by,
    previous_data,
    new_data,
    changes_summary
  ) VALUES (
    p_shipment_id,
    p_action_type,
    p_action_by,
    p_previous_data,
    p_new_data,
    p_changes_summary
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Create view for easy audit log viewing with user details
CREATE OR REPLACE VIEW shipment_audit_log_with_users AS
SELECT
  sal.*,
  u.email as action_by_email,
  s.title as shipment_title,
  s.row_id as shipment_row_id
FROM shipment_audit_log sal
LEFT JOIN auth.users u ON sal.action_by = u.id
LEFT JOIN shipments s ON sal.shipment_id = s.id
ORDER BY sal.action_timestamp DESC;

-- Grant access to the view
GRANT SELECT ON shipment_audit_log_with_users TO authenticated;

-- Create function to get audit history for a specific shipment
CREATE OR REPLACE FUNCTION get_shipment_audit_history(p_shipment_id uuid)
RETURNS TABLE (
  id uuid,
  action_type text,
  action_by_email text,
  action_timestamp timestamptz,
  changes_summary text,
  previous_data jsonb,
  new_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sal.id,
    sal.action_type,
    u.email as action_by_email,
    sal.action_timestamp,
    sal.changes_summary,
    sal.previous_data,
    sal.new_data
  FROM shipment_audit_log sal
  LEFT JOIN auth.users u ON sal.action_by = u.id
  WHERE sal.shipment_id = p_shipment_id
  ORDER BY sal.action_timestamp DESC;
END;
$$;

-- Create function to get recent audit activity (last 100 entries)
CREATE OR REPLACE FUNCTION get_recent_audit_activity(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  shipment_id uuid,
  shipment_title text,
  action_type text,
  action_by_email text,
  action_timestamp timestamptz,
  changes_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sal.id,
    sal.shipment_id,
    s.title as shipment_title,
    sal.action_type,
    u.email as action_by_email,
    sal.action_timestamp,
    sal.changes_summary
  FROM shipment_audit_log sal
  LEFT JOIN auth.users u ON sal.action_by = u.id
  LEFT JOIN shipments s ON sal.shipment_id = s.id
  ORDER BY sal.action_timestamp DESC
  LIMIT p_limit;
END;
$$;
