/*
  # Fix Nested Aggregate Error in get_filtered_operator_performance

  ## Problem
  The category_data CTE was using nested aggregates (aggregate functions inside json_agg)
  which PostgreSQL doesn't allow.

  ## Solution
  Create a separate aggregation step before using json_agg to combine the results.
*/

CREATE OR REPLACE FUNCTION get_filtered_operator_performance(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_color text,
  active boolean,
  rank bigint,
  total_completed_tasks bigint,
  total_score bigint,
  avg_score_per_task numeric,
  high_intensity_count bigint,
  medium_intensity_count bigint,
  low_intensity_count bigint,
  active_days bigint,
  first_completion_date timestamptz,
  last_completion_date timestamptz,
  category_breakdown json
) AS $$
BEGIN
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view KPI data';
  END IF;

  RETURN QUERY
  WITH filtered_assignments AS (
    SELECT 
      soa.*
    FROM shipment_operator_assignments soa
    WHERE 
      soa.status = 'completed'
      AND soa.completed_at IS NOT NULL
      AND (p_start_date IS NULL OR soa.completed_at >= p_start_date)
      AND (p_end_date IS NULL OR soa.completed_at <= p_end_date)
  ),
  operator_stats AS (
    SELECT 
      o.id as op_id,
      o.name as op_name,
      o.color as op_color,
      o.active as op_active,
      COUNT(*) as total_tasks,
      SUM(
        CASE 
          WHEN fa.intensity = 'high' THEN 3
          WHEN fa.intensity = 'medium' THEN 2
          WHEN fa.intensity = 'low' THEN 1
          ELSE 0
        END
      ) as total_points,
      COUNT(*) FILTER (WHERE fa.intensity = 'high') as high_count,
      COUNT(*) FILTER (WHERE fa.intensity = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE fa.intensity = 'low') as low_count,
      COUNT(DISTINCT DATE(fa.completed_at)) as days_active,
      MIN(fa.completed_at) as first_date,
      MAX(fa.completed_at) as last_date
    FROM operators o
    LEFT JOIN filtered_assignments fa ON o.id = fa.operator_id
    WHERE EXISTS (
      SELECT 1 FROM filtered_assignments fa2 
      WHERE fa2.operator_id = o.id
    )
    GROUP BY o.id, o.name, o.color, o.active
  ),
  -- First aggregate by operator and category
  category_stats AS (
    SELECT 
      o.id as op_id,
      get_task_category(fa.title) as category,
      fa.is_delivery,
      COUNT(*) as task_count,
      SUM(
        CASE 
          WHEN fa.intensity = 'high' THEN 3
          WHEN fa.intensity = 'medium' THEN 2
          WHEN fa.intensity = 'low' THEN 1
          ELSE 0
        END
      ) as category_score,
      ROUND(AVG(
        CASE 
          WHEN fa.intensity = 'high' THEN 3
          WHEN fa.intensity = 'medium' THEN 2
          WHEN fa.intensity = 'low' THEN 1
          ELSE 0
        END
      )::numeric, 2) as avg_intensity,
      MIN(fa.completed_at) as first_completion,
      MAX(fa.completed_at) as last_completion
    FROM operators o
    LEFT JOIN filtered_assignments fa ON o.id = fa.operator_id
    WHERE EXISTS (
      SELECT 1 FROM filtered_assignments fa2 
      WHERE fa2.operator_id = o.id
    )
    GROUP BY o.id, get_task_category(fa.title), fa.is_delivery
  ),
  -- Then combine into JSON
  category_data AS (
    SELECT 
      cs.op_id,
      json_agg(
        json_build_object(
          'category', cs.category,
          'is_delivery', cs.is_delivery,
          'task_count', cs.task_count,
          'category_score', cs.category_score,
          'avg_intensity_score', cs.avg_intensity,
          'first_completion', cs.first_completion,
          'last_completion', cs.last_completion
        ) ORDER BY cs.category_score DESC
      ) as categories
    FROM category_stats cs
    GROUP BY cs.op_id
  )
  SELECT 
    os.op_id,
    os.op_name,
    os.op_color,
    os.op_active,
    ROW_NUMBER() OVER (ORDER BY os.total_points DESC NULLS LAST, os.total_tasks DESC) as rank,
    os.total_tasks::bigint,
    os.total_points::bigint,
    CASE 
      WHEN os.total_tasks > 0 THEN
        ROUND((os.total_points::numeric / os.total_tasks)::numeric, 2)
      ELSE 0
    END as avg_score,
    os.high_count::bigint,
    os.medium_count::bigint,
    os.low_count::bigint,
    os.days_active::bigint,
    os.first_date,
    os.last_date,
    COALESCE(cd.categories, '[]'::json) as breakdown
  FROM operator_stats os
  LEFT JOIN category_data cd ON os.op_id = cd.op_id
  ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_filtered_operator_performance IS 'Returns time-filtered operator performance data. Fixed nested aggregate error. Works with dynamic categories from task_categories table.';
