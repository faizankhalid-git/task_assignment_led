/*
  # Backfill Non-Delivery Timestamps & Expand KPI to All Task Types

  ## Problems Addressed:
  
  ### Task 1: Missing Timestamps (108 non-delivery tasks)
  - Backfill `completed_at` for completed non-delivery tasks
  - Use `updated_at` as primary source, `start` as fallback
  
  ### Task 2: Expand KPI System to ALL Tasks
  - Remove `is_delivery = true` restriction
  - Track deliveries AND non-deliveries in performance metrics
  - Add comprehensive task type statistics
  
  ## Database Impact:
  - Updates 108 shipment records
  - Expands KPI tracking from 201 to 315 completed tasks
  - Maintains backward compatibility
*/

-- ============================================
-- PART 1: Backfill Missing Timestamps
-- ============================================

UPDATE shipments
SET completed_at = updated_at
WHERE status = 'completed' 
  AND is_delivery = false 
  AND completed_at IS NULL
  AND updated_at IS NOT NULL;

UPDATE shipments
SET completed_at = start
WHERE status = 'completed' 
  AND is_delivery = false 
  AND completed_at IS NULL
  AND start IS NOT NULL;

-- ============================================
-- PART 2: Drop and Recreate Views (Expanded)
-- ============================================

-- Drop dependent views first
DROP VIEW IF EXISTS operator_performance_detail CASCADE;
DROP VIEW IF EXISTS operator_rankings CASCADE;
DROP VIEW IF EXISTS operator_task_distribution CASCADE;
DROP MATERIALIZED VIEW IF EXISTS operator_performance_summary CASCADE;
DROP VIEW IF EXISTS shipment_operator_assignments CASCADE;

-- Recreate base view (unchanged structure, just updated comment)
CREATE VIEW shipment_operator_assignments AS
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

COMMENT ON VIEW shipment_operator_assignments IS 'Unnests assigned_operators array for ALL tasks (deliveries and non-deliveries). Foundation for KPI calculations.';

-- Recreate materialized view with expanded metrics
CREATE MATERIALIZED VIEW operator_performance_summary AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  o.color as operator_color,
  -- Overall metrics
  COALESCE(COUNT(soa.shipment_id), 0) as total_completed_tasks,
  COALESCE(SUM(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  ), 0) as total_score,
  -- Delivery metrics
  COALESCE(COUNT(soa.shipment_id) FILTER (WHERE soa.is_delivery = true), 0) as delivery_tasks,
  COALESCE(SUM(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  ) FILTER (WHERE soa.is_delivery = true), 0) as delivery_score,
  -- Non-delivery metrics
  COALESCE(COUNT(soa.shipment_id) FILTER (WHERE soa.is_delivery = false), 0) as non_delivery_tasks,
  COALESCE(SUM(
    CASE 
      WHEN soa.intensity = 'high' THEN 3
      WHEN soa.intensity = 'medium' THEN 2
      WHEN soa.intensity = 'low' THEN 1
      ELSE 0
    END
  ) FILTER (WHERE soa.is_delivery = false), 0) as non_delivery_score,
  -- Intensity breakdown
  COALESCE(SUM(CASE WHEN soa.intensity = 'high' THEN 1 ELSE 0 END), 0) as high_intensity_count,
  COALESCE(SUM(CASE WHEN soa.intensity = 'medium' THEN 1 ELSE 0 END), 0) as medium_intensity_count,
  COALESCE(SUM(CASE WHEN soa.intensity = 'low' THEN 1 ELSE 0 END), 0) as low_intensity_count,
  -- Temporal
  MIN(soa.completed_at) as first_completion_date,
  MAX(soa.completed_at) as last_completion_date,
  COALESCE(COUNT(DISTINCT DATE(soa.completed_at)), 0) as active_days
FROM operators o
LEFT JOIN shipment_operator_assignments soa ON o.id = soa.operator_id 
  AND soa.status = 'completed' 
  AND soa.completed_at IS NOT NULL
GROUP BY o.id, o.name, o.color;

CREATE UNIQUE INDEX idx_operator_performance_summary_operator_id 
ON operator_performance_summary(operator_id);

CREATE INDEX idx_operator_performance_summary_score 
ON operator_performance_summary(total_score DESC NULLS LAST);

COMMENT ON MATERIALIZED VIEW operator_performance_summary IS 'Operator performance for ALL task types with delivery/non-delivery breakdown. Auto-refreshes on task completion.';

-- Recreate task distribution view
CREATE VIEW operator_task_distribution AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  get_task_category(soa.title) as task_category,
  soa.is_delivery,
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
  AND soa.completed_at IS NOT NULL
GROUP BY o.id, o.name, get_task_category(soa.title), soa.is_delivery;

COMMENT ON VIEW operator_task_distribution IS 'Task distribution by category for ALL task types with delivery/non-delivery split.';

-- Recreate rankings view
CREATE VIEW operator_rankings AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY ops.total_score DESC NULLS LAST, ops.total_completed_tasks DESC) as rank,
  ops.*,
  CASE 
    WHEN ops.total_completed_tasks > 0 THEN
      ROUND((ops.total_score::numeric / ops.total_completed_tasks)::numeric, 2)
    ELSE 0
  END as avg_score_per_task,
  CASE 
    WHEN ops.delivery_tasks > 0 THEN
      ROUND((ops.delivery_score::numeric / ops.delivery_tasks)::numeric, 2)
    ELSE 0
  END as avg_delivery_score,
  CASE 
    WHEN ops.non_delivery_tasks > 0 THEN
      ROUND((ops.non_delivery_score::numeric / ops.non_delivery_tasks)::numeric, 2)
    ELSE 0
  END as avg_non_delivery_score
FROM operator_performance_summary ops
ORDER BY rank;

COMMENT ON VIEW operator_rankings IS 'Operators ranked by total score across ALL task types with delivery/non-delivery metrics.';

-- Recreate detail view
CREATE VIEW operator_performance_detail AS
SELECT 
  o.id as operator_id,
  o.name as operator_name,
  o.color as operator_color,
  o.active,
  COALESCE(ops.total_completed_tasks, 0) as total_completed_tasks,
  COALESCE(ops.total_score, 0) as total_score,
  COALESCE(ops.delivery_tasks, 0) as delivery_tasks,
  COALESCE(ops.delivery_score, 0) as delivery_score,
  COALESCE(ops.non_delivery_tasks, 0) as non_delivery_tasks,
  COALESCE(ops.non_delivery_score, 0) as non_delivery_score,
  COALESCE(ops.high_intensity_count, 0) as high_intensity_count,
  COALESCE(ops.medium_intensity_count, 0) as medium_intensity_count,
  COALESCE(ops.low_intensity_count, 0) as low_intensity_count,
  COALESCE(ops.avg_score_per_task, 0) as avg_score_per_task,
  COALESCE(ops.avg_delivery_score, 0) as avg_delivery_score,
  COALESCE(ops.avg_non_delivery_score, 0) as avg_non_delivery_score,
  ops.rank,
  COALESCE(ops.active_days, 0) as active_days,
  ops.first_completion_date,
  ops.last_completion_date,
  COALESCE(
    json_agg(
      json_build_object(
        'category', otd.task_category,
        'is_delivery', otd.is_delivery,
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
  ops.delivery_tasks, ops.delivery_score,
  ops.non_delivery_tasks, ops.non_delivery_score,
  ops.high_intensity_count, ops.medium_intensity_count, ops.low_intensity_count,
  ops.avg_score_per_task, ops.avg_delivery_score, ops.avg_non_delivery_score,
  ops.rank, ops.active_days,
  ops.first_completion_date, ops.last_completion_date;

COMMENT ON VIEW operator_performance_detail IS 'Complete operator performance with category breakdowns for ALL task types.';

-- ============================================
-- PART 3: New KPI Functions
-- ============================================

-- Task type statistics
CREATE OR REPLACE FUNCTION get_task_type_statistics()
RETURNS TABLE (
  task_type TEXT,
  total_tasks BIGINT,
  completed_tasks BIGINT,
  pending_tasks BIGINT,
  completion_rate NUMERIC,
  total_score BIGINT,
  avg_score_per_task NUMERIC
) AS $$
BEGIN
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  RETURN QUERY
  SELECT 
    CASE WHEN s.is_delivery THEN 'Delivery' ELSE 'Non-Delivery' END as task_type,
    COUNT(*)::BIGINT as total_tasks,
    COUNT(*) FILTER (WHERE s.status = 'completed')::BIGINT as completed_tasks,
    COUNT(*) FILTER (WHERE s.status != 'completed')::BIGINT as pending_tasks,
    ROUND(
      (COUNT(*) FILTER (WHERE s.status = 'completed')::numeric / NULLIF(COUNT(*), 0)::numeric * 100),
      2
    ) as completion_rate,
    COALESCE(SUM(
      CASE 
        WHEN s.intensity = 'high' AND s.status = 'completed' THEN 3
        WHEN s.intensity = 'medium' AND s.status = 'completed' THEN 2
        WHEN s.intensity = 'low' AND s.status = 'completed' THEN 1
        ELSE 0
      END
    ), 0)::BIGINT as total_score,
    ROUND(
      COALESCE(
        SUM(
          CASE 
            WHEN s.intensity = 'high' AND s.status = 'completed' THEN 3
            WHEN s.intensity = 'medium' AND s.status = 'completed' THEN 2
            WHEN s.intensity = 'low' AND s.status = 'completed' THEN 1
            ELSE 0
          END
        ) / NULLIF(COUNT(*) FILTER (WHERE s.status = 'completed'), 0)::numeric,
        0
      ),
      2
    ) as avg_score_per_task
  FROM shipments s
  WHERE s.archived = false
  GROUP BY s.is_delivery
  ORDER BY task_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_task_type_statistics() TO authenticated;

COMMENT ON FUNCTION get_task_type_statistics IS 'Compares delivery vs non-delivery task performance. Admin only.';

-- Enhanced category statistics
CREATE OR REPLACE FUNCTION get_category_statistics_by_type()
RETURNS TABLE (
  task_category TEXT,
  task_type TEXT,
  total_tasks BIGINT,
  total_score BIGINT,
  unique_operators BIGINT,
  avg_score_per_task NUMERIC
) AS $$
BEGIN
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  RETURN QUERY
  SELECT 
    otd.task_category,
    CASE WHEN otd.is_delivery THEN 'Delivery' ELSE 'Non-Delivery' END as task_type,
    SUM(otd.task_count)::BIGINT as total_tasks,
    SUM(otd.category_score)::BIGINT as total_score,
    COUNT(DISTINCT otd.operator_id)::BIGINT as unique_operators,
    ROUND(AVG(otd.avg_intensity_score)::numeric, 2) as avg_score_per_task
  FROM operator_task_distribution otd
  WHERE otd.task_category IS NOT NULL
  GROUP BY otd.task_category, otd.is_delivery
  ORDER BY total_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_category_statistics_by_type() TO authenticated;

COMMENT ON FUNCTION get_category_statistics_by_type IS 'Category statistics split by delivery/non-delivery type. Admin only.';

-- ============================================
-- PART 4: Refresh Materialized View
-- ============================================

REFRESH MATERIALIZED VIEW operator_performance_summary;

-- Grant permissions
GRANT SELECT ON shipment_operator_assignments TO authenticated;
GRANT SELECT ON operator_performance_summary TO authenticated;
GRANT SELECT ON operator_task_distribution TO authenticated;
GRANT SELECT ON operator_rankings TO authenticated;
GRANT SELECT ON operator_performance_detail TO authenticated;
