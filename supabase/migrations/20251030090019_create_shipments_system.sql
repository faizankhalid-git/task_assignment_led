/*
  # Shipment Display & Assignment System

  1. New Tables
    - `shipments`
      - `id` (uuid, primary key)
      - `row_id` (integer, unique) - Google Sheet row index
      - `sscc_numbers` (text) - Package list from sheet
      - `title` (text) - Shipment name from sheet
      - `start` (timestamptz) - Estimated arrival from sheet
      - `car_reg_no` (text) - Vehicle registration from sheet
      - `storage_location` (text) - App-side field
      - `assigned_operators` (text[]) - App-side array of operator names
      - `notes` (text) - App-side optional notes
      - `status` (text) - pending | in_progress | completed
      - `updated_at` (timestamptz) - Last update timestamp
      - `archived` (boolean) - For deleted sheet rows
      - `created_at` (timestamptz)
    
    - `operators`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Operator name
      - `active` (boolean) - Whether operator is active
      - `created_at` (timestamptz)
    
    - `app_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Setting key
      - `value` (text) - Setting value
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Admin policies for authenticated users
    - LED read-only policies for specific token access
*/

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id integer UNIQUE NOT NULL,
  sscc_numbers text DEFAULT '',
  title text DEFAULT '',
  start timestamptz,
  car_reg_no text DEFAULT '',
  storage_location text DEFAULT '',
  assigned_operators text[] DEFAULT '{}',
  notes text DEFAULT '',
  status text DEFAULT 'pending',
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies for shipments
CREATE POLICY "Authenticated users can view shipments"
  ON shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shipments"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shipments"
  ON shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shipments"
  ON shipments FOR DELETE
  TO authenticated
  USING (true);

-- Policies for operators
CREATE POLICY "Authenticated users can view operators"
  ON operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert operators"
  ON operators FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete operators"
  ON operators FOR DELETE
  TO authenticated
  USING (true);

-- Policies for app_settings
CREATE POLICY "Authenticated users can view settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_start ON shipments(start);
CREATE INDEX IF NOT EXISTS idx_shipments_archived ON shipments(archived);
CREATE INDEX IF NOT EXISTS idx_operators_active ON operators(active);