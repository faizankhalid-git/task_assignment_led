/*
  # Fix Type Mismatch in get_category_statistics Function

  The function returns NUMERIC for averages but was declared to return BIGINT.
  This fix changes the return types to match the actual data types.
*/

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
