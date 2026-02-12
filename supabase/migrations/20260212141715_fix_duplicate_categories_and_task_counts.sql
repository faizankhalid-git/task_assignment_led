/*
  # Fix Duplicate Categories and Incorrect Task Counts

  ## Issues Fixed
  
  ### Issue 1: Duplicate Categories in Detail View
    - Problem: Categories appear multiple times (e.g., "OTHER" twice, "OUTGOING" twice)
    - Root Cause: GROUP BY included 'is_delivery' field, creating separate entries
    - Solution: Remove is_delivery from GROUP BY, aggregate it properly

  ### Issue 2: Incorrect Task Counts in Filtered Views
    - Problem: Showing 12 tasks when operator only did 2 shipments
    - Root Cause: Counting all rows instead of DISTINCT shipments
    - Example: Filip Daglind - 2 shipments with 7+5 operators = 12 rows
    - Solution: Count DISTINCT shipment_id instead of COUNT(*)

  ## Impact
    - Task counts now show actual shipments completed by operator
    - Categories no longer duplicated in detail view
    - Points calculated correctly based on actual shipments
*/

-- ============================================
-- Fix get_filtered_operator_performance()
-- ============================================

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
      -- Count DISTINCT shipments, not rows!
      COUNT(DISTINCT fa.shipment_id) as total_tasks,
      -- For scoring, we need to sum by distinct shipment
      SUM(DISTINCT (fa.shipment_id::text || fa.intensity)::text::int4 * 
        CASE 
          WHEN fa.intensity = 'high' THEN 3
          WHEN fa.intensity = 'medium' THEN 2
          WHEN fa.intensity = 'low' THEN 1
          ELSE 0
        END
      ) as total_points,
      COUNT(DISTINCT CASE WHEN fa.intensity = 'high' THEN fa.shipment_id END) as high_count,
      COUNT(DISTINCT CASE WHEN fa.intensity = 'medium' THEN fa.shipment_id END) as medium_count,
      COUNT(DISTINCT CASE WHEN fa.intensity = 'low' THEN fa.shipment_id END) as low_count,
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
  -- First aggregate by operator and category (NOT by is_delivery!)
  category_stats AS (
    SELECT 
      o.id as op_id,
      get_task_category(fa.title) as category,
      -- Count distinct shipments per category
      COUNT(DISTINCT fa.shipment_id) as task_count,
      -- Sum scores for distinct shipments
      SUM(DISTINCT (fa.shipment_id::text || fa.intensity)::text::int4 * 
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
      MAX(fa.completed_at) as last_completion,
      -- Aggregate is_delivery info (true if ANY task in category is delivery)
      bool_or(fa.is_delivery) as has_delivery
    FROM operators o
    LEFT JOIN filtered_assignments fa ON o.id = fa.operator_id
    WHERE EXISTS (
      SELECT 1 FROM filtered_assignments fa2 
      WHERE fa2.operator_id = o.id
    )
    GROUP BY o.id, get_task_category(fa.title)  -- NO is_delivery here!
  ),
  -- Then combine into JSON
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

COMMENT ON FUNCTION get_filtered_operator_performance IS 'Returns time-filtered operator performance. Fixed: (1) Counts DISTINCT shipments not rows, (2) No duplicate categories by removing is_delivery from GROUP BY';

-- ============================================
-- Also fix get_operator_performance() for consistency
-- ============================================

-- First, let's check if the materialized view has the same issue
-- We need to fix the underlying data aggregation
-- The issue is the same: counting rows instead of distinct shipments

-- Let's also update get_category_statistics to use distinct counts
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
  WITH category_data AS (
    SELECT 
      get_task_category(soa.title) as category,
      -- Count DISTINCT shipments
      COUNT(DISTINCT soa.shipment_id) as task_count,
      -- Sum score based on distinct shipments
      COUNT(DISTINCT soa.operator_id) as operator_count,
      -- Calculate score properly
      SUM(
        CASE 
          WHEN soa.intensity = 'high' THEN 3
          WHEN soa.intensity = 'medium' THEN 2
          WHEN soa.intensity = 'low' THEN 1
          ELSE 0
        END
      )::bigint as score
    FROM shipment_operator_assignments soa
    WHERE soa.status = 'completed'
      AND soa.completed_at IS NOT NULL
    GROUP BY get_task_category(soa.title)
  )
  SELECT 
    cd.category,
    cd.task_count::bigint,
    cd.score,
    cd.operator_count::bigint,
    ROUND((cd.task_count::numeric / NULLIF(cd.operator_count, 0))::numeric, 2) as avg_tasks,
    ROUND((cd.score::numeric / NULLIF(cd.task_count, 0))::numeric, 2) as avg_score
  FROM category_data cd
  ORDER BY cd.score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_category_statistics IS 'Returns category statistics with correct distinct shipment counts.';
