/*
  # Add is_delivery field to shipments

  1. Changes
    - Add `is_delivery` boolean column to shipments table
    - Default to true for backward compatibility with existing data
    - This allows shipments to be used for multiple purposes (deliveries, meetings, OPI, etc.)
    - When is_delivery=true, vehicle icon shows in LED display
    - When is_delivery=false, no vehicle icon shows in LED display

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Sets default to true so existing shipments are treated as deliveries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'is_delivery'
  ) THEN
    ALTER TABLE shipments ADD COLUMN is_delivery boolean DEFAULT true;
  END IF;
END $$;