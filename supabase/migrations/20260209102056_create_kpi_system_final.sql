/*
  # Create KPI Performance Tracking System

  ## Overview
  Implements a comprehensive KPI system to track operator performance based on completed tasks with intensity scoring.

  ## 1. New Columns
  ### shipments table:
  - `intensity` (enum): Task intensity level (high=3pts, medium=2pts, low=1pt)

  ## 2. New Materialized Views
  ### operator_performance_summary
  - Aggregated performance metrics per operator
  - Total scores, task counts, category breakdowns
  
  ## 3. New Views
  ### shipment_operator_assignments
  - Helper view to unnest operator assignments
  
  ### operator_task_distribution
  - Shows task distribution across categories for each operator
  
  ### operator_rankings
  - Ranks all operators by total performance score
  
  ### operator_performance_detail  
  - Complete operator performance with category breakdowns
  
  ## 4. New Functions
  ### get_task_category(title)
  - Extracts task category from shipment title prefix
  
  ### refresh_operator_performance()
  - Refreshes materialized view data
  
  ### get_operator_performance()
  - Returns operator performance data (admin only)
  
  ### get_category_statistics()
  - Returns task category statistics (admin only)
  
  ### get_operators_missing_categories()
  - Identifies operators missing task types (admin only)
  
  ## 5. Security
  - Permission checks via can_view_kpi_data() function
  - Only admins and super_admins can view KPI data
  
  ## 6. Important Notes
  - Intensity defaults to 'medium' for existing/new records
  - Task categories determined by title prefix (INCOMING, OUTGOING, OPI, etc.)
  - Performance calculated only on completed deliveries
  - Handles multiple operators per shipment (assigned_operators text array)
  - Operators stored as NAMES in array, joined to operators table by name
  - Historical data preserved for trend analysis
  - Materialized view auto-refreshes on shipment completion
*/

-- Step 1: Add intensity enum type
DO $$ BEGIN
  CREATE TYPE intensity_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add intensity column to shipments table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'intensity'
  ) THEN
    ALTER TABLE shipments 
    ADD COLUMN intensity intensity_level DEFAULT 'medium' NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipments_intensity ON shipments(intensity);
    CREATE INDEX IF NOT EXISTS idx_shipments_completed_at ON shipments(completed_at) WHERE completed_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_shipments_status_delivery ON shipments(status, is_delivery) WHERE status = 'completed' AND is_delivery = true;
  END IF;
END $$;

-- Step 3: Create function to extract task category from title
CREATE OR REPLACE FUNCTION get_task_category(title TEXT)
RETURNS TEXT AS $$
BEGIN
  IF title IS NULL THEN
    RETURN 'OTHER';
  END IF;
  
  -- Extract prefix before first space or hyphen
  IF title ~* '^INCOMING' THEN
    RETURN 'INCOMING';
  ELSIF title ~* '^OUTGOING' THEN
    RETURN 'OUTGOING';
  ELSIF title ~* '^OPI' THEN
    RETURN 'OPI';
  ELSIF title ~* '^DELIVERY' THEN
    RETURN 'DELIVERY';
  ELSIF title ~* '^PICKUP' THEN
    RETURN 'PICKUP';
  ELSIF title ~* '^WAREHOUSE' THEN
    RETURN 'WAREHOUSE';
  ELSIF title ~* '^SORTING' THEN
    RETURN 'SORTING';
  ELSE
    RETURN 'OTHER';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create helper view to unnest operator assignments
-- Note: assigned_operators contains operator NAMES, not IDs
CREATE OR REPLACE VIEW shipment_operator_assignments AS
SELECT 
  s.id as shipment_id,
  s.row_id,
  s.title,
  s.intensity,
  s.status,
  s.is_delivery,
  s.completed_at,
  s.completed_by,
  unnest(s.assigned_operators) as operator_name,
  o.id as operator_id
FROM shipments s
CROSS JOIN LATERAL unnest(s.assigned_operators) AS operator_name
LEFT JOIN operators o ON o.name = operator_name
WHERE s.assigned_operators IS NOT NULL 
  AND array_length(s.assigned_operators, 1) > 0;

-- Step 5: Create operator performance summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS operator_performance_summary AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  o.color as operator_color,
  COALESCE(COUNT(soa.shipment_id), 0) as total_completed_tasks,
  COALESCE(SUM(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  ), 0) as total_score,
  COALESCE(SUM(CASE WHEN soa.intensity = 'high' THEN 1 ELSE 0 END), 0) as high_intensity_count,
  COALESCE(SUM(CASE WHEN soa.intensity = 'medium' THEN 1 ELSE 0 END), 0) as medium_intensity_count,
  COALESCE(SUM(CASE WHEN soa.intensity = 'low' THEN 1 ELSE 0 END), 0) as low_intensity_count,
  MIN(soa.completed_at) as first_completion_date,
  MAX(soa.completed_at) as last_completion_date,
  COALESCE(COUNT(DISTINCT DATE(soa.completed_at)), 0) as active_days
FROM operators o
LEFT JOIN shipment_operator_assignments soa ON o.id = soa.operator_id 
  AND soa.status = 'completed' 
  AND soa.is_delivery = true
  AND soa.completed_at IS NOT NULL
GROUP BY o.id, o.name, o.color;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_performance_summary_operator_id 
ON operator_performance_summary(operator_id);

CREATE INDEX IF NOT EXISTS idx_operator_performance_summary_score 
ON operator_performance_summary(total_score DESC NULLS LAST);

-- Step 6: Create task category distribution view
CREATE OR REPLACE VIEW operator_task_distribution AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  get_task_category(soa.title) as task_category,
  COUNT(*) as task_count,
  SUM(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  ) as category_score,
  ROUND(AVG(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  )::numeric, 2) as avg_intensity_score,
  MIN(soa.completed_at) as first_completion,
  MAX(soa.completed_at) as last_completion
FROM operators o
INNER JOIN shipment_operator_assignments soa ON o.id = soa.operator_id 
  AND soa.status = 'completed' 
  AND soa.is_delivery = true
  AND soa.completed_at IS NOT NULL
GROUP BY o.id, o.name, get_task_category(soa.title);

-- Step 7: Create operator rankings view
CREATE OR REPLACE VIEW operator_rankings AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY ops.total_score DESC NULLS LAST, ops.total_completed_tasks DESC) as rank,
  ops.*,
  CASE 
    WHEN ops.total_completed_tasks > 0 THEN
      ROUND((ops.total_score::numeric / ops.total_completed_tasks)::numeric, 2)
    ELSE 0
  END as avg_score_per_task
FROM operator_performance_summary ops
ORDER BY rank;

-- Step 8: Create performance detail view with category breakdowns
CREATE OR REPLACE VIEW operator_performance_detail AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  o.color as operator_color,
  o.active,
  COALESCE(ops.total_completed_tasks, 0) as total_completed_tasks,
  COALESCE(ops.total_score, 0) as total_score,
  COALESCE(ops.high_intensity_count, 0) as high_intensity_count,
  COALESCE(ops.medium_intensity_count, 0) as medium_intensity_count,
  COALESCE(ops.low_intensity_count, 0) as low_intensity_count,
  COALESCE(ops.avg_score_per_task, 0) as avg_score_per_task,
  ops.rank,
  COALESCE(ops.active_days, 0) as active_days,
  ops.first_completion_date,
  ops.last_completion_date,
  COALESCE(
    json_agg(
      json_build_object(
        'category', otd.task_category,
        'task_count', otd.task_count,
        'category_score', otd.category_score,
        'avg_intensity_score', otd.avg_intensity_score,
        'first_completion', otd.first_completion,
        'last_completion', otd.last_completion
      ) ORDER BY otd.category_score DESC
    ) FILTER (WHERE otd.task_category IS NOT NULL),
    '[]'::json
  ) as category_breakdown
FROM operators o
LEFT JOIN operator_rankings ops ON o.id = ops.operator_id
LEFT JOIN operator_task_distribution otd ON o.id = otd.operator_id
GROUP BY 
  o.id, o.name, o.color, o.active,
  ops.total_completed_tasks, ops.total_score,
  ops.high_intensity_count, ops.medium_intensity_count, ops.low_intensity_count,
  ops.avg_score_per_task, ops.rank, ops.active_days,
  ops.first_completion_date, ops.last_completion_date;

-- Step 9: Create function to refresh performance metrics
CREATE OR REPLACE FUNCTION refresh_operator_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY operator_performance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create trigger to auto-refresh performance on completion
CREATE OR REPLACE FUNCTION trigger_refresh_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if a delivery is completed
  IF (NEW.status = 'completed' AND NEW.is_delivery = true AND NEW.completed_at IS NOT NULL) 
     AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Refresh immediately
    PERFORM refresh_operator_performance();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipment_completion_performance_refresh ON shipments;
CREATE TRIGGER shipment_completion_performance_refresh
  AFTER INSERT OR UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_performance();

-- Step 11: Grant access to views
GRANT SELECT ON shipment_operator_assignments TO authenticated;
GRANT SELECT ON operator_performance_summary TO authenticated;
GRANT SELECT ON operator_task_distribution TO authenticated;
GRANT SELECT ON operator_rankings TO authenticated;
GRANT SELECT ON operator_performance_detail TO authenticated;

-- Step 12: Create function to check if user can view KPI data
CREATE OR REPLACE FUNCTION can_view_kpi_data()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE user_id = auth.uid();
  
  RETURN user_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 13: Create helper function to get operator performance
CREATE OR REPLACE FUNCTION get_operator_performance(p_operator_id UUID DEFAULT NULL)
RETURNS TABLE (
  operator_id UUID,
  operator_name TEXT,
  operator_color TEXT,
  active BOOLEAN,
  rank BIGINT,
  total_completed_tasks BIGINT,
  total_score BIGINT,
  avg_score_per_task NUMERIC,
  high_intensity_count BIGINT,
  medium_intensity_count BIGINT,
  low_intensity_count BIGINT,
  active_days BIGINT,
  first_completion_date TIMESTAMPTZ,
  last_completion_date TIMESTAMPTZ,
  category_breakdown JSON
) AS $$
BEGIN
  -- Check permission
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  -- Return data
  RETURN QUERY
  SELECT 
    opd.operator_id,
    opd.operator_name,
    opd.operator_color,
    opd.active,
    opd.rank,
    opd.total_completed_tasks,
    opd.total_score,
    opd.avg_score_per_task,
    opd.high_intensity_count,
    opd.medium_intensity_count,
    opd.low_intensity_count,
    opd.active_days,
    opd.first_completion_date,
    opd.last_completion_date,
    opd.category_breakdown
  FROM operator_performance_detail opd
  WHERE (p_operator_id IS NULL OR opd.operator_id = p_operator_id)
  ORDER BY opd.rank NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 14: Create function to get task category statistics
CREATE OR REPLACE FUNCTION get_category_statistics()
RETURNS TABLE (
  task_category TEXT,
  total_tasks BIGINT,
  total_score BIGINT,
  unique_operators BIGINT,
  avg_tasks_per_operator NUMERIC,
  avg_score_per_task NUMERIC
) AS $$
BEGIN
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  RETURN QUERY
  SELECT 
    otd.task_category,
    SUM(otd.task_count) as total_tasks,
    SUM(otd.category_score) as total_score,
    COUNT(DISTINCT otd.operator_id) as unique_operators,
    ROUND(AVG(otd.task_count)::numeric, 2) as avg_tasks_per_operator,
    ROUND(AVG(otd.avg_intensity_score)::numeric, 2) as avg_score_per_task
  FROM operator_task_distribution otd
  WHERE otd.task_category IS NOT NULL
  GROUP BY otd.task_category
  ORDER BY total_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 15: Create function to identify operators missing task categories
CREATE OR REPLACE FUNCTION get_operators_missing_categories()
RETURNS TABLE (
  operator_id UUID,
  operator_name TEXT,
  missing_categories TEXT[],
  completed_categories TEXT[],
  missing_count INTEGER
) AS $$
BEGIN
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  RETURN QUERY
  WITH all_categories AS (
    SELECT DISTINCT task_category 
    FROM operator_task_distribution 
    WHERE task_category IS NOT NULL AND task_category != 'OTHER'
  ),
  operator_categories AS (
    SELECT 
      o.id,
      o.name,
      COALESCE(
        array_agg(DISTINCT otd.task_category) FILTER (WHERE otd.task_category IS NOT NULL), 
        ARRAY[]::TEXT[]
      ) as completed
    FROM operators o
    LEFT JOIN operator_task_distribution otd ON o.id = otd.operator_id
    WHERE o.active = true
    GROUP BY o.id, o.name
  )
  SELECT 
    oc.id as operator_id,
    oc.name as operator_name,
    ARRAY(
      SELECT ac.task_category 
      FROM all_categories ac 
      WHERE NOT (ac.task_category = ANY(oc.completed))
      ORDER BY ac.task_category
    ) as missing_categories,
    oc.completed as completed_categories,
    (SELECT COUNT(*) FROM all_categories ac WHERE NOT (ac.task_category = ANY(oc.completed)))::INTEGER as missing_count
  FROM operator_categories oc
  WHERE EXISTS (
    SELECT 1 FROM all_categories ac WHERE NOT (ac.task_category = ANY(oc.completed))
  )
  ORDER BY missing_count DESC, oc.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 16: Initialize materialized view with current data
REFRESH MATERIALIZED VIEW operator_performance_summary;

-- Step 17: Add helpful comments
COMMENT ON COLUMN shipments.intensity IS 'Task intensity level: high=3 points, medium=2 points, low=1 point. Used for KPI calculations.';
COMMENT ON VIEW shipment_operator_assignments IS 'Helper view that unnests the assigned_operators array to create one row per operator assignment. Joins operator names to operator IDs.';
COMMENT ON MATERIALIZED VIEW operator_performance_summary IS 'Aggregated operator performance metrics for KPI tracking. Refreshes automatically when deliveries are completed.';
COMMENT ON VIEW operator_rankings IS 'Operators ranked by total performance score (highest to lowest). Includes average score per task.';
COMMENT ON VIEW operator_task_distribution IS 'Task distribution by category for each operator. Shows how operators perform across different task types.';
COMMENT ON VIEW operator_performance_detail IS 'Complete operator performance data with category breakdowns in JSON format. Main view for KPI dashboard.';
COMMENT ON FUNCTION get_task_category IS 'Extracts task category from shipment title prefix (INCOMING, OUTGOING, OPI, etc.). Returns OTHER for unrecognized patterns.';
COMMENT ON FUNCTION refresh_operator_performance IS 'Manually refreshes the operator performance materialized view. Called automatically by trigger on completion.';
COMMENT ON FUNCTION can_view_kpi_data IS 'Permission check: Returns true if current user is admin or super_admin, false otherwise.';
COMMENT ON FUNCTION get_operator_performance IS 'Returns detailed performance data for one or all operators. Admin only. Includes rankings, scores, and category breakdowns.';
COMMENT ON FUNCTION get_category_statistics IS 'Returns aggregate statistics across all task categories. Admin only. Shows total tasks, scores, and operator distribution.';
COMMENT ON FUNCTION get_operators_missing_categories IS 'Identifies operators who have not completed certain task categories. Admin only. Useful for ensuring balanced workload distribution.';
