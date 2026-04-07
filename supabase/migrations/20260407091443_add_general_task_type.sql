/*
  # Add General Task Type

  ## Overview
  Adds 'general' as a third shipment_type option for non-shipment warehouse tasks
  like safety walks, maintenance, inventory checks, etc.

  ## Changes

  1. **Update shipment_type constraint**
     - Add 'general' as valid value alongside 'incoming' and 'outgoing'

  2. **Backward compatibility**
     - Existing records remain unchanged
     - Default stays as 'outgoing'

  ## Task Types
  - incoming: Receiving shipments
  - outgoing: Dispatching/delivery tasks
  - general: Non-shipment tasks (safety, maintenance, inventory, etc.)
*/

-- Step 1: Drop the old constraint
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_shipment_type_check;

-- Step 2: Add new constraint with 'general' type
ALTER TABLE shipments ADD CONSTRAINT shipments_shipment_type_check
CHECK (shipment_type IN ('incoming', 'outgoing', 'general'));

-- Step 3: Update index to include general type
DROP INDEX IF EXISTS idx_shipments_type_status_original;
CREATE INDEX idx_shipments_type_status_general
ON shipments(shipment_type, status, start);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN shipments.shipment_type IS 'Task type: incoming (receiving), outgoing (dispatch/delivery), general (maintenance, safety, inventory, etc.)';
