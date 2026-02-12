/*
  # Fix Duplicate Categories and Task Counts - Correct Approach

  ## Problem
  Previous attempt had SQL error with type conversion.
  
  ## Solution
  Use subquery to get distinct shipments first, then aggregate properly.
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
  -- Get distinct shipments per operator with their properties
  distinct_operator_shipments AS (
    SELECT DISTINCT ON (fa.operator_id, fa.shipment_id)
      fa.operator_id,
      fa.shipment_id,
      fa.title,
      fa.intensity,
      fa.is_delivery,
      fa.completed_at,
      CASE 
        WHEN fa.intensity = 'high' THEN 3
        WHEN fa.intensity = 'medium' THEN 2
        WHEN fa.intensity = 'low' THEN 1
        ELSE 0
      END as points
    FROM filtered_assignments fa
  ),
  operator_stats AS (
    SELECT 
      o.id as op_id,
      o.name as op_name,
      o.color as op_color,
      o.active as op_active,
      COUNT(*) as total_tasks,
      SUM(dos.points) as total_points,
      COUNT(*) FILTER (WHERE dos.intensity = 'high') as high_count,
      COUNT(*) FILTER (WHERE dos.intensity = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE dos.intensity = 'low') as low_count,
      COUNT(DISTINCT DATE(dos.completed_at)) as days_active,
      MIN(dos.completed_at) as first_date,
      MAX(dos.completed_at) as last_date
    FROM operators o
    LEFT JOIN distinct_operator_shipments dos ON o.id = dos.operator_id
    WHERE EXISTS (
      SELECT 1 FROM distinct_operator_shipments dos2
      WHERE dos2.operator_id = o.id
    )
    GROUP BY o.id, o.name, o.color, o.active
  ),
  -- Aggregate by operator and category (NOT by is_delivery!)
  category_stats AS (
    SELECT 
      o.id as op_id,
      get_task_category(dos.title) as category,
      COUNT(*) as task_count,
      SUM(dos.points) as category_score,
      ROUND(AVG(dos.points)::numeric, 2) as avg_intensity,
      MIN(dos.completed_at) as first_completion,
      MAX(dos.completed_at) as last_completion,
      bool_or(dos.is_delivery) as has_delivery
    FROM operators o
    LEFT JOIN distinct_operator_shipments dos ON o.id = dos.operator_id
    WHERE EXISTS (
      SELECT 1 FROM distinct_operator_shipments dos2
      WHERE dos2.operator_id = o.id
    )
    GROUP BY o.id, get_task_category(dos.title)
  ),
  -- Combine into JSON
  category_data AS (
    SELECT 
      cs.op_id,
      json_agg(
        json_build_object(
          'category', cs.category,
          'is_delivery', cs.has_delivery,
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

COMMENT ON FUNCTION get_filtered_operator_performance IS 'Returns time-filtered operator performance. Counts distinct shipments per operator, removes duplicate categories.';

-- ============================================
-- Fix get_category_statistics
-- ============================================

CREATE OR REPLACE FUNCTION get_category_statistics()
RETURNS TABLE (
  task_category text,
  total_tasks bigint,
  total_score bigint,
  unique_operators bigint,
  avg_tasks_per_operator numeric,
  avg_score_per_task numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH distinct_shipments AS (
    SELECT DISTINCT ON (soa.operator_id, soa.shipment_id)
      soa.operator_id,
      soa.shipment_id,
      soa.title,
      soa.intensity,
      CASE 
        WHEN soa.intensity = 'high' THEN 3
        WHEN soa.intensity = 'medium' THEN 2
        WHEN soa.intensity = 'low' THEN 1
        ELSE 0
      END as points
    FROM shipment_operator_assignments soa
    WHERE soa.status = 'completed'
      AND soa.completed_at IS NOT NULL
  ),
  category_data AS (
    SELECT 
      get_task_category(ds.title) as category,
      COUNT(*) as task_count,
      SUM(ds.points) as score,
      COUNT(DISTINCT ds.operator_id) as operator_count
    FROM distinct_shipments ds
    GROUP BY get_task_category(ds.title)
  )
  SELECT 
    cd.category,
    cd.task_count::bigint,
    cd.score::bigint,
    cd.operator_count::bigint,
    ROUND((cd.task_count::numeric / NULLIF(cd.operator_count, 0))::numeric, 2) as avg_tasks,
    ROUND((cd.score::numeric / NULLIF(cd.task_count, 0))::numeric, 2) as avg_score
  FROM category_data cd
  ORDER BY cd.score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_category_statistics IS 'Returns category statistics counting distinct shipments per operator.';
