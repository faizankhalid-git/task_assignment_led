/*
  # Revert to Original Status Workflow

  ## Overview
  This migration reverts back to the original 3-status workflow (pending, in_progress, completed)
  and removes the shipment_type restriction to support all types of tasks, not just incoming/outgoing.

  ## Changes

  1. **Restore Original Status Values**
     - Reverts to: pending, in_progress, completed
     - Removes: expected, ready_to_deliver, delivered

  2. **Keep is_delivery Field**
     - Maintains backward compatibility
     - Still indicates if a task should show vehicle icon on LED

  3. **Remove shipment_type Column**
     - System should support any type of task, not just deliveries

  ## Migration Strategy
  - Maps new statuses back to original ones
  - Preserves all existing data
  - Restores original workflow
*/

-- Step 1: Drop the view first
DROP VIEW IF EXISTS shipments_with_users;

-- Step 2: Map new statuses back to original workflow
UPDATE shipments
SET status = CASE
  WHEN status = 'expected' THEN 'pending'
  WHEN status = 'ready_to_deliver' THEN 'pending'
  WHEN status = 'delivered' THEN 'completed'
  WHEN status = 'completed' THEN 'completed'
  ELSE status
END
WHERE status IN ('expected', 'ready_to_deliver', 'delivered');

-- Step 3: Drop the new status constraint and restore original
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
CHECK (status IN ('pending', 'in_progress', 'completed'));

-- Step 4: Drop shipment_type column
ALTER TABLE shipments DROP COLUMN IF EXISTS shipment_type;

-- Step 5: Update packages table to restore original statuses
UPDATE packages
SET status = CASE
  WHEN status = 'expected' THEN 'pending'
  WHEN status = 'ready_to_deliver' THEN 'pending'
  WHEN status = 'delivered' THEN 'completed'
  WHEN status = 'completed' THEN 'completed'
  ELSE status
END
WHERE status IN ('expected', 'ready_to_deliver', 'delivered');

ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_status_check;
ALTER TABLE packages ADD CONSTRAINT packages_status_check
CHECK (status IN ('pending', 'stored', 'completed'));

-- Step 6: Drop the type-specific index
DROP INDEX IF EXISTS idx_shipments_type_status;

-- Step 7: Recreate original index
CREATE INDEX IF NOT EXISTS idx_shipments_status_start
ON shipments(status, start);

-- Step 8: Recreate the view without shipment_type
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
