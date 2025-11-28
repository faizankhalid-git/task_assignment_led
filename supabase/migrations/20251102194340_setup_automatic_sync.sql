/*
  # Setup Automatic Google Sheets Sync

  1. New Tables
    - `sync_logs` - Track sync operations for debugging
      - `id` (uuid, primary key)
      - `imported` (integer) - Number of shipments imported
      - `skipped` (integer) - Number of completed shipments skipped
      - `errors` (integer) - Number of errors
      - `error_details` (text) - Error messages
      - `synced_at` (timestamptz) - When sync happened

  2. Security
    - Enable RLS on `sync_logs` table
    - Add policy for authenticated users to view logs

  3. Notes
    - Automatic syncing is now handled by Supabase Background Tasks
    - The Edge Function 'sync-google-sheets' will run automatically
    - No manual sync needed anymore
*/

CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported integer DEFAULT 0,
  skipped integer DEFAULT 0,
  errors integer DEFAULT 0,
  error_details text DEFAULT '',
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync logs"
  ON sync_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sync_logs_synced_at ON sync_logs(synced_at DESC);