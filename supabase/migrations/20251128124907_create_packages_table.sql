/*
  # Create Packages Table

  1. New Tables
    - `packages`
      - `id` (uuid, primary key)
      - `shipment_id` (uuid, foreign key to shipments)
      - `sscc_number` (text) - Individual package/pallet SSCC number
      - `storage_location` (text) - Where package is stored
      - `status` (text) - pending | stored | completed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add packages table to track individual packages within each shipment
    - Each package can have its own storage location
    - Foreign key relationship to shipments table

  3. Security
    - Enable RLS on packages table
    - Authenticated users have full access
    - Anonymous users can view packages for active shipments (for LED display)

  4. Important Notes
    - This allows tracking individual SSCC numbers separately
    - Each package can be stored in a different location
    - Status tracking per package for better granularity
*/

CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sscc_number text NOT NULL,
  storage_location text DEFAULT '',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Policies for packages (authenticated users)
CREATE POLICY "Authenticated users can view packages"
  ON packages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert packages"
  ON packages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update packages"
  ON packages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete packages"
  ON packages FOR DELETE
  TO authenticated
  USING (true);

-- Policy for anonymous users (LED display)
CREATE POLICY "Anonymous users can view packages for active shipments"
  ON packages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = packages.shipment_id
      AND shipments.archived = false
      AND shipments.status != 'completed'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_packages_shipment_id ON packages(shipment_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_sscc_number ON packages(sscc_number);
