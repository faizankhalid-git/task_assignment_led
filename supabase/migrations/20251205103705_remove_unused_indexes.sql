/*
  # Remove Unused Indexes

  1. Security and Performance Improvements
    - Remove unused indexes that consume storage and slow down write operations
    - Unused indexes identified:
      - `idx_shipments_status` on shipments table
      - `idx_operators_active` on operators table  
      - `idx_sync_logs_synced_at` on sync_logs table
      - `idx_packages_status` on packages table
      - `idx_packages_sscc_number` on packages table
    
  2. Benefits
    - Improves INSERT, UPDATE, and DELETE performance
    - Reduces storage costs
    - Simplifies index maintenance
    - Indexes can be recreated later if usage patterns change

  3. Important Notes
    - These indexes were identified as unused through monitoring
    - Removing them will not impact query performance since they're not being utilized
    - The database will continue to function normally without these indexes
*/

-- Remove unused index on shipments status column
DROP INDEX IF EXISTS idx_shipments_status;

-- Remove unused index on operators active column
DROP INDEX IF EXISTS idx_operators_active;

-- Remove unused index on sync_logs synced_at column
DROP INDEX IF EXISTS idx_sync_logs_synced_at;

-- Remove unused index on packages status column
DROP INDEX IF EXISTS idx_packages_status;

-- Remove unused index on packages sscc_number column
DROP INDEX IF EXISTS idx_packages_sscc_number;