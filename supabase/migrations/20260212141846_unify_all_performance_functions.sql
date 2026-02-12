/*
  # Unify All Performance Functions

  ## Problem
  - get_operator_performance() uses materialized view with same counting issue
  - Different codepaths lead to inconsistent results

  ## Solution
  - Make get_operator_performance() call get_filtered_operator_performance(NULL, NULL)
  - Ensures all views use same logic: distinct shipments, no duplicate categories
  - Materialized view kept for backwards compatibility but not used
*/

-- Drop and recreate get_operator_performance
DROP FUNCTION IF EXISTS get_operator_performance(uuid);
DROP FUNCTION IF EXISTS get_operator_performance();

CREATE FUNCTION get_operator_performance(p_operator_id uuid DEFAULT NULL)
RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_color text,
  active boolean,
  rank bigint,
  total_completed_tasks bigint,
  total_score bigint,
  avg_score_per_task numeric,
  delivery_tasks bigint,
  delivery_score bigint,
  avg_delivery_score numeric,
  non_delivery_tasks bigint,
  non_delivery_score bigint,
  avg_non_delivery_score numeric,
  high_intensity_count bigint,
  medium_intensity_count bigint,
  low_intensity_count bigint,
  active_days bigint,
  first_completion_date timestamptz,
  last_completion_date timestamptz,
  category_breakdown json
) AS $$
BEGIN
  -- Check permissions
  IF NOT can_view_kpi_data() THEN
    RAISE EXCEPTION 'Permission denied: Only admins and users with kpi permission can view KPI data';
  END IF;

  -- Use the filtered function with NULL dates (= all time)
  -- This ensures consistent logic: distinct shipments, no duplicate categories
  IF p_operator_id IS NOT NULL THEN
    -- Return single operator
    RETURN QUERY
    SELECT 
      gfop.operator_id,
      gfop.operator_name,
      gfop.operator_color,
      gfop.active,
      gfop.rank,
      gfop.total_completed_tasks,
      gfop.total_score,
      gfop.avg_score_per_task,
      0::bigint as delivery_tasks,
      0::bigint as delivery_score,
      0::numeric as avg_delivery_score,
      0::bigint as non_delivery_tasks,
      0::bigint as non_delivery_score,
      0::numeric as avg_non_delivery_score,
      gfop.high_intensity_count,
      gfop.medium_intensity_count,
      gfop.low_intensity_count,
      gfop.active_days,
      gfop.first_completion_date,
      gfop.last_completion_date,
      gfop.category_breakdown
    FROM get_filtered_operator_performance(NULL, NULL) gfop
    WHERE gfop.operator_id = p_operator_id;
  ELSE
    -- Return all operators
    RETURN QUERY
    SELECT 
      gfop.operator_id,
      gfop.operator_name,
      gfop.operator_color,
      gfop.active,
      gfop.rank,
      gfop.total_completed_tasks,
      gfop.total_score,
      gfop.avg_score_per_task,
      0::bigint as delivery_tasks,
      0::bigint as delivery_score,
      0::numeric as avg_delivery_score,
      0::bigint as non_delivery_tasks,
      0::bigint as non_delivery_score,
      0::numeric as avg_non_delivery_score,
      gfop.high_intensity_count,
      gfop.medium_intensity_count,
      gfop.low_intensity_count,
      gfop.active_days,
      gfop.first_completion_date,
      gfop.last_completion_date,
      gfop.category_breakdown
    FROM get_filtered_operator_performance(NULL, NULL) gfop;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_operator_performance IS 'Returns all-time operator performance. Now uses get_filtered_operator_performance for consistency. Counts distinct shipments, no duplicate categories.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_operator_performance TO authenticated;
