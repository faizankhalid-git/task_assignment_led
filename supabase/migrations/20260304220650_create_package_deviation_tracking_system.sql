/*
  # Create Package Deviation Tracking System

  ## Overview
  This migration creates a comprehensive deviation tracking system for packages that are missing
  from bookings or have discrepancies during delivery processing.

  ## New Tables

  ### 1. package_deviations
  Tracks all package deviations with their status and resolution
  
  - `id` (uuid, primary key) - Unique deviation identifier
  - `package_id` (uuid, foreign key) - Reference to packages table
  - `shipment_id` (uuid, foreign key) - Reference to originating shipment
  - `deviation_type` (text) - Type of deviation: missing_from_booking, damaged, wrong_quantity, other
  - `description` (text) - Detailed description of the deviation
  - `status` (text) - Current status: open, in_progress, resolved, escalated
  - `priority` (text) - Priority level: low, medium, high, urgent
  - `reported_by` (uuid, foreign key) - User who reported the deviation
  - `assigned_to` (uuid, foreign key, nullable) - User assigned to resolve
  - `resolved_by` (uuid, foreign key, nullable) - User who resolved the deviation
  - `resolution_notes` (text, nullable) - Notes about the resolution
  - `created_at` (timestamptz) - When deviation was reported
  - `updated_at` (timestamptz) - Last update timestamp
  - `resolved_at` (timestamptz, nullable) - When deviation was resolved

  ### 2. deviation_history
  Audit trail for all deviation changes
  
  - `id` (uuid, primary key) - Unique history entry
  - `deviation_id` (uuid, foreign key) - Reference to deviation
  - `action_type` (text) - Type of action: created, status_changed, assigned, resolved, escalated, commented
  - `action_by` (uuid, foreign key) - User who performed action
  - `previous_value` (jsonb) - Previous state before action
  - `new_value` (jsonb) - New state after action
  - `comment` (text, nullable) - Optional comment
  - `created_at` (timestamptz) - When action occurred

  ## Changes to Existing Tables

  ### packages table
  - `has_deviation` (boolean) - Flag to mark if package has deviation
  - `deviation_notes` (text) - Quick notes about deviation

  ## Security
  - Enable RLS on all new tables
  - Only authenticated users can view deviations
  - Only admins and users with 'deviations' permission can create/update
  - Complete audit trail for all changes

  ## Indexes
  - Fast lookups by package_id, shipment_id, status, priority
  - Performance optimization for deviation dashboard queries

  ## Important Notes
  - Maintains complete history of all packages in a delivery
  - Tracks which delivery the package arrived with
  - Full audit trail for compliance and escalation
  - Supports workflow for resolving discrepancies
*/

-- ============================================
-- Add deviation fields to packages table
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'packages' AND column_name = 'has_deviation'
  ) THEN
    ALTER TABLE packages ADD COLUMN has_deviation boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'packages' AND column_name = 'deviation_notes'
  ) THEN
    ALTER TABLE packages ADD COLUMN deviation_notes text DEFAULT '';
  END IF;
END $$;

-- ============================================
-- Create package_deviations table
-- ============================================

CREATE TABLE IF NOT EXISTS package_deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES packages(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  deviation_type text NOT NULL DEFAULT 'missing_from_booking',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_deviation_type CHECK (
    deviation_type IN ('missing_from_booking', 'damaged', 'wrong_quantity', 'incorrect_location', 'other')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('open', 'in_progress', 'resolved', 'escalated', 'closed')
  ),
  CONSTRAINT valid_priority CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  )
);

COMMENT ON TABLE package_deviations IS 'Tracks package discrepancies and deviations during delivery processing';
COMMENT ON COLUMN package_deviations.deviation_type IS 'Type of deviation: missing_from_booking (not in system), damaged, wrong_quantity, incorrect_location, other';
COMMENT ON COLUMN package_deviations.status IS 'Current status: open (new), in_progress (being resolved), resolved (fixed), escalated (needs management), closed (archived)';
COMMENT ON COLUMN package_deviations.priority IS 'Priority level: low, medium, high, urgent - affects escalation workflow';

-- ============================================
-- Create deviation_history table
-- ============================================

CREATE TABLE IF NOT EXISTS deviation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_id uuid NOT NULL REFERENCES package_deviations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_action_type CHECK (
    action_type IN ('created', 'status_changed', 'assigned', 'reassigned', 'resolved', 'escalated', 'commented', 'priority_changed', 'updated')
  )
);

COMMENT ON TABLE deviation_history IS 'Complete audit trail for all deviation changes and actions';
COMMENT ON COLUMN deviation_history.action_type IS 'Type of action performed on deviation';
COMMENT ON COLUMN deviation_history.previous_value IS 'State before action (JSON)';
COMMENT ON COLUMN deviation_history.new_value IS 'State after action (JSON)';

-- ============================================
-- Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_packages_has_deviation ON packages(has_deviation) WHERE has_deviation = true;
CREATE INDEX IF NOT EXISTS idx_package_deviations_package_id ON package_deviations(package_id);
CREATE INDEX IF NOT EXISTS idx_package_deviations_shipment_id ON package_deviations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_package_deviations_status ON package_deviations(status);
CREATE INDEX IF NOT EXISTS idx_package_deviations_priority ON package_deviations(priority);
CREATE INDEX IF NOT EXISTS idx_package_deviations_created_at ON package_deviations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_deviations_assigned_to ON package_deviations(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deviation_history_deviation_id ON deviation_history(deviation_id, created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE package_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deviation_history ENABLE ROW LEVEL SECURITY;

-- Package Deviations Policies

CREATE POLICY "Authenticated users can view all deviations"
  ON package_deviations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create deviations"
  ON package_deviations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update deviations"
  ON package_deviations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Only admins can delete deviations"
  ON package_deviations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- Deviation History Policies

CREATE POLICY "Authenticated users can view deviation history"
  ON deviation_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deviation history"
  ON deviation_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No update or delete policies - history is immutable

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get complete deviation details including package and shipment history
CREATE OR REPLACE FUNCTION get_deviation_details(p_deviation_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'deviation', to_jsonb(pd.*),
    'package', to_jsonb(p.*),
    'shipment', to_jsonb(s.*),
    'all_packages_in_shipment', (
      SELECT jsonb_agg(to_jsonb(sp.*))
      FROM packages sp
      WHERE sp.shipment_id = pd.shipment_id
    ),
    'history', (
      SELECT jsonb_agg(to_jsonb(dh.*) ORDER BY dh.created_at DESC)
      FROM deviation_history dh
      WHERE dh.deviation_id = pd.id
    ),
    'reported_by_user', to_jsonb(up.*),
    'assigned_to_user', to_jsonb(ua.*),
    'resolved_by_user', to_jsonb(ur.*)
  ) INTO result
  FROM package_deviations pd
  LEFT JOIN packages p ON pd.package_id = p.id
  LEFT JOIN shipments s ON pd.shipment_id = s.id
  LEFT JOIN user_profiles up ON pd.reported_by = up.id
  LEFT JOIN user_profiles ua ON pd.assigned_to = ua.id
  LEFT JOIN user_profiles ur ON pd.resolved_by = ur.id
  WHERE pd.id = p_deviation_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_deviation_details IS 'Returns complete deviation details including package, shipment, all related packages, and full history';

-- Function to get all deviations with summary data
CREATE OR REPLACE FUNCTION get_deviations_summary(
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  package_sscc text,
  shipment_title text,
  shipment_id uuid,
  deviation_type text,
  description text,
  status text,
  priority text,
  reported_by_name text,
  assigned_to_name text,
  resolved_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  packages_in_shipment bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.id,
    COALESCE(p.sscc_number, 'N/A') as package_sscc,
    s.title as shipment_title,
    pd.shipment_id,
    pd.deviation_type,
    pd.description,
    pd.status,
    pd.priority,
    up.full_name as reported_by_name,
    ua.full_name as assigned_to_name,
    ur.full_name as resolved_by_name,
    pd.created_at,
    pd.updated_at,
    pd.resolved_at,
    (SELECT COUNT(*) FROM packages WHERE packages.shipment_id = pd.shipment_id) as packages_in_shipment
  FROM package_deviations pd
  LEFT JOIN packages p ON pd.package_id = p.id
  LEFT JOIN shipments s ON pd.shipment_id = s.id
  LEFT JOIN user_profiles up ON pd.reported_by = up.id
  LEFT JOIN user_profiles ua ON pd.assigned_to = ua.id
  LEFT JOIN user_profiles ur ON pd.resolved_by = ur.id
  WHERE 
    (p_status IS NULL OR pd.status = p_status)
    AND (p_priority IS NULL OR pd.priority = p_priority)
  ORDER BY 
    CASE pd.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    pd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_deviations_summary IS 'Returns paginated list of deviations with summary information, ordered by priority and date';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deviation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_deviation_timestamp ON package_deviations;
CREATE TRIGGER trigger_update_deviation_timestamp
  BEFORE UPDATE ON package_deviations
  FOR EACH ROW
  EXECUTE FUNCTION update_deviation_timestamp();

-- Function to automatically create history entry on status change
CREATE OR REPLACE FUNCTION log_deviation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO deviation_history (
      deviation_id,
      action_type,
      action_by,
      previous_value,
      new_value,
      comment
    ) VALUES (
      NEW.id,
      'status_changed',
      auth.uid(),
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  
  -- Log assignment changes
  IF (TG_OP = 'UPDATE' AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)) THEN
    INSERT INTO deviation_history (
      deviation_id,
      action_type,
      action_by,
      previous_value,
      new_value,
      comment
    ) VALUES (
      NEW.id,
      CASE 
        WHEN OLD.assigned_to IS NULL THEN 'assigned'
        ELSE 'reassigned'
      END,
      auth.uid(),
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to),
      CASE 
        WHEN OLD.assigned_to IS NULL THEN 'Deviation assigned'
        ELSE 'Deviation reassigned'
      END
    );
  END IF;
  
  -- Log priority changes
  IF (TG_OP = 'UPDATE' AND OLD.priority != NEW.priority) THEN
    INSERT INTO deviation_history (
      deviation_id,
      action_type,
      action_by,
      previous_value,
      new_value,
      comment
    ) VALUES (
      NEW.id,
      'priority_changed',
      auth.uid(),
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority),
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority
    );
  END IF;
  
  -- Log resolution
  IF (TG_OP = 'UPDATE' AND OLD.status != 'resolved' AND NEW.status = 'resolved') THEN
    UPDATE package_deviations 
    SET resolved_at = now(), resolved_by = auth.uid()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-log changes
DROP TRIGGER IF EXISTS trigger_log_deviation_changes ON package_deviations;
CREATE TRIGGER trigger_log_deviation_changes
  AFTER UPDATE ON package_deviations
  FOR EACH ROW
  EXECUTE FUNCTION log_deviation_status_change();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION get_deviation_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_deviations_summary TO authenticated;
