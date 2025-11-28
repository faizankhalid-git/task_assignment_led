/*
  # Fix LED Display Access

  1. Changes
    - Add policy to allow anonymous (anon) users to view non-archived, non-completed shipments
    - This allows the LED display to work without authentication

  2. Security
    - Only SELECT permission granted to anon role
    - Limited to non-archived and non-completed shipments only
    - Other operations (INSERT, UPDATE, DELETE) still require authentication
*/

CREATE POLICY "Anonymous users can view active shipments"
  ON shipments
  FOR SELECT
  TO anon
  USING (archived = false AND status != 'completed');
