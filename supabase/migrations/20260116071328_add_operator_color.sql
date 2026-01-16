/*
  # Add Color Field to Operators Table

  1. Changes
    - Add `color` column to operators table with default value of green (#10b981)
    - This color will be used for operator tiles in the LED display

  2. Notes
    - Default color is green to match existing styling
    - Color should be stored as hex code (e.g., #10b981)
*/

-- Add color column to operators table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'color'
  ) THEN
    ALTER TABLE operators ADD COLUMN color text DEFAULT '#10b981' NOT NULL;
  END IF;
END $$;