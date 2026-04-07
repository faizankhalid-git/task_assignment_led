/*
  # Restore Shipment Type with Original Status Flow

  ## Overview
  This migration restores the shipment_type column (incoming/outgoing) while keeping
  the original 3-status workflow (pending → in_progress → completed).

  ## Changes

  1. **Add shipment_type Column Back**
     - Values: incoming, outgoing
     - Default: outgoing (for backward compatibility)

  2. **Keep Original Status Values**
     - pending, in_progress, completed (NO CHANGES to status)

  3. **Maintain is_delivery Field**
     - Works independently of shipment_type
     - Controls LED display vehicle icon

  ## Strategy
  - Add shipment_type back to support task categorization
  - Keep all existing status workflow unchanged
  - Backward compatible: defaults to 'outgoing' for existing records
*/

-- Step 1: Add shipment_type column back
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS shipment_type TEXT DEFAULT 'outgoing';

-- Step 2: Add constraint for shipment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shipments_shipment_type_check'
  ) THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_shipment_type_check
    CHECK (shipment_type IN ('incoming', 'outgoing'));
  END IF;
END $$;

-- Step 3: Set default based on is_delivery for better accuracy
-- Assumption: is_delivery=true typically means outgoing, false means incoming
UPDATE shipments 
SET shipment_type = CASE 
  WHEN is_delivery = true THEN 'outgoing'
  ELSE 'incoming'
END
WHERE shipment_type = 'outgoing';

-- Step 4: Create index for filtering by type and status
CREATE INDEX IF NOT EXISTS idx_shipments_type_status_original
ON shipments(shipment_type, status, start);

-- Step 5: Recreate the view with shipment_type
DROP VIEW IF EXISTS shipments_with_users;
CREATE VIEW shipments_with_users AS
SELECT
  s.*,
  creator.email as created_by_email,
  updater.email as updated_by_email,
  completer.email as completed_by_email
FROM shipments s
LEFT JOIN auth.users creator ON s.created_by = creator.id
LEFT JOIN auth.users updater ON s.updated_by = updater.id
LEFT JOIN auth.users completer ON s.completed_by = completer.id;

-- Step 6: Grant permissions
GRANT SELECT ON shipments_with_users TO authenticated;
GRANT SELECT ON shipments_with_users TO anon;
