/*
  # Unified Delivery System with 3-Stage Workflow

  ## Overview
  This migration consolidates INCOMING and OUTGOING deliveries into a single unified system
  with a 3-stage status workflow that adapts based on delivery type.

  ## Changes

  1. **New Status Values**
     - Replaces: pending, in_progress, completed
     - With: expected, ready_to_deliver, completed, delivered
     - INCOMING workflow: expected → completed
     - OUTGOING workflow: ready_to_deliver → completed → delivered

  2. **Shipment Type Field**
     - Adds `shipment_type` column: 'incoming' or 'outgoing'
     - Defaults to 'incoming' for backward compatibility
     - Maps existing `is_delivery` field to appropriate type

  3. **Status Migration**
     - Maps old statuses to new ones based on shipment type
     - Preserves all existing data during transition

  ## Migration Strategy
  - Uses conditional logic to map statuses appropriately
  - Adds new columns with defaults before data migration
  - Updates check constraints to allow new status values
*/

-- Step 1: Add new shipment_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'shipment_type'
  ) THEN
    ALTER TABLE shipments
    ADD COLUMN shipment_type text DEFAULT 'incoming' CHECK (shipment_type IN ('incoming', 'outgoing'));
  END IF;
END $$;

-- Step 2: Migrate existing is_delivery data to shipment_type
-- is_delivery = true means OUTGOING (delivery from warehouse to site)
-- is_delivery = false means INCOMING (receiving at warehouse)
UPDATE shipments
SET shipment_type = CASE
  WHEN is_delivery = true THEN 'outgoing'
  ELSE 'incoming'
END
WHERE shipment_type IS NULL OR shipment_type = 'incoming';

-- Step 3: Drop the old status constraint temporarily
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

-- Step 4: Add new status values support
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
CHECK (status IN ('pending', 'in_progress', 'completed', 'expected', 'ready_to_deliver', 'delivered'));

-- Step 5: Migrate existing statuses to new workflow
-- For OUTGOING deliveries:
--   pending → ready_to_deliver (ready to be picked up/loaded)
--   in_progress → completed (loaded/in transit)
--   completed → delivered (delivered to destination)
-- For INCOMING deliveries:
--   pending → expected (waiting to arrive)
--   in_progress → expected (still waiting)
--   completed → completed (received and stored)
UPDATE shipments
SET status = CASE
  WHEN shipment_type = 'outgoing' THEN
    CASE status
      WHEN 'pending' THEN 'ready_to_deliver'
      WHEN 'in_progress' THEN 'completed'
      WHEN 'completed' THEN 'delivered'
      ELSE status
    END
  WHEN shipment_type = 'incoming' THEN
    CASE status
      WHEN 'pending' THEN 'expected'
      WHEN 'in_progress' THEN 'expected'
      WHEN 'completed' THEN 'completed'
      ELSE status
    END
  ELSE status
END
WHERE status IN ('pending', 'in_progress', 'completed');

-- Step 6: Update packages table status to align with new workflow
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_status_check;
ALTER TABLE packages ADD CONSTRAINT packages_status_check
CHECK (status IN ('pending', 'stored', 'completed', 'expected', 'ready_to_deliver', 'delivered'));

-- Step 7: Create index for faster filtering by shipment_type
CREATE INDEX IF NOT EXISTS idx_shipments_type_status
ON shipments(shipment_type, status, start);

-- Step 8: Update the view to include shipment_type
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

-- Step 9: Grant appropriate permissions
GRANT SELECT ON shipments_with_users TO authenticated;
GRANT SELECT ON shipments_with_users TO anon;
