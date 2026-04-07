/*
  # Categorize Existing Tasks by Title Pattern

  ## Overview
  Updates existing shipments to properly categorize them based on their title:
  - Titles starting with "INCOMING" → shipment_type = 'incoming', is_delivery = true
  - Titles starting with "OUTGOING" → shipment_type = 'outgoing', is_delivery = true
  - All other titles → shipment_type = 'general', is_delivery = false

  ## Changes

  1. **Update INCOMING tasks**
     - Set shipment_type to 'incoming'
     - Set is_delivery to true

  2. **Update OUTGOING tasks**
     - Set shipment_type to 'outgoing'
     - Set is_delivery to true

  3. **Update GENERAL tasks**
     - Set shipment_type to 'general'
     - Set is_delivery to false

  ## Data Safety
  - Uses pattern matching on title field
  - Only updates existing records
  - No data is deleted
*/

-- Step 1: Update tasks with titles starting with "INCOMING"
UPDATE shipments
SET 
  shipment_type = 'incoming',
  is_delivery = true
WHERE title ILIKE 'INCOMING%';

-- Step 2: Update tasks with titles starting with "OUTGOING"
UPDATE shipments
SET 
  shipment_type = 'outgoing',
  is_delivery = true
WHERE title ILIKE 'OUTGOING%';

-- Step 3: Update all other tasks to be general tasks
UPDATE shipments
SET 
  shipment_type = 'general',
  is_delivery = false
WHERE title NOT ILIKE 'INCOMING%' 
  AND title NOT ILIKE 'OUTGOING%';

-- Step 4: Add comment for documentation
COMMENT ON COLUMN shipments.is_delivery IS 'Auto-set based on shipment_type: true for incoming/outgoing (shows vehicle icon on LED), false for general tasks';
