/*
  # Fix KPI Diagnostic Function Column Ambiguity

  Fixes column name ambiguity in get_kpi_system_health() function by qualifying all table references.
*/

CREATE OR REPLACE FUNCTION get_kpi_system_health()
RETURNS TABLE (
  metric TEXT,
  value BIGINT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT 
      'Total Shipments'::TEXT as metric,
      COUNT(*)::BIGINT as value,
      'INFO'::TEXT as status_col,
      'All shipments in database'::TEXT as details
    FROM shipments
    
    UNION ALL
    
    SELECT 
      'Completed Deliveries'::TEXT as metric,
      COUNT(*)::BIGINT as value,
      CASE 
        WHEN COUNT(*) > 0 THEN 'OK'::TEXT 
        ELSE 'WARNING'::TEXT 
      END as status_col,
      'Deliveries marked as completed'::TEXT as details
    FROM shipments s
    WHERE s.status = 'completed' AND s.is_delivery = true
    
    UNION ALL
    
    SELECT 
      'KPI-Eligible Tasks'::TEXT as metric,
      COUNT(*)::BIGINT as value,
      CASE 
        WHEN COUNT(*) > 0 THEN 'OK'::TEXT 
        ELSE 'ERROR'::TEXT 
      END as status_col,
      'Tasks with timestamp and assigned operators'::TEXT as details
    FROM shipments s
    WHERE s.status = 'completed' 
      AND s.is_delivery = true 
      AND s.completed_at IS NOT NULL
      AND s.assigned_operators IS NOT NULL 
      AND array_length(s.assigned_operators, 1) > 0
    
    UNION ALL
    
    SELECT 
      'Missing Timestamps'::TEXT as metric,
      COUNT(*)::BIGINT as value,
      CASE 
        WHEN COUNT(*) = 0 THEN 'OK'::TEXT 
        ELSE 'WARNING'::TEXT 
      END as status_col,
      'Completed deliveries without completion timestamp'::TEXT as details
    FROM shipments s
    WHERE s.status = 'completed' 
      AND s.is_delivery = true 
      AND s.completed_at IS NULL
    
    UNION ALL
    
    SELECT 
      'Operators with Tasks'::TEXT as metric,
      COUNT(DISTINCT soa.operator_id)::BIGINT as value,
      CASE 
        WHEN COUNT(DISTINCT soa.operator_id) > 0 THEN 'OK'::TEXT 
        ELSE 'WARNING'::TEXT 
      END as status_col,
      'Operators with completed deliveries'::TEXT as details
    FROM shipment_operator_assignments soa
    WHERE soa.status = 'completed' 
      AND soa.is_delivery = true 
      AND soa.completed_at IS NOT NULL
    
    UNION ALL
    
    SELECT 
      'Total KPI Score'::TEXT as metric,
      COALESCE(SUM(ops.total_score), 0)::BIGINT as value,
      CASE 
        WHEN COALESCE(SUM(ops.total_score), 0) > 0 THEN 'OK'::TEXT 
        ELSE 'ERROR'::TEXT 
      END as status_col,
      'Sum of all operator performance scores'::TEXT as details
    FROM operator_performance_summary ops
    
    UNION ALL
    
    SELECT 
      'Materialized View Age (seconds)'::TEXT as metric,
      COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(ops.last_completion_date)))::BIGINT, 0) as value,
      CASE 
        WHEN MAX(ops.last_completion_date) IS NULL THEN 'WARNING'::TEXT
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(ops.last_completion_date))) < 300 THEN 'OK'::TEXT
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(ops.last_completion_date))) < 3600 THEN 'WARNING'::TEXT
        ELSE 'ERROR'::TEXT 
      END as status_col,
      'Time since last data refresh'::TEXT as details
    FROM operator_performance_summary ops
  )
  SELECT m.metric, m.value, m.status_col, m.details 
  FROM metrics m 
  ORDER BY 
    CASE m.status_col 
      WHEN 'ERROR' THEN 1 
      WHEN 'WARNING' THEN 2 
      WHEN 'OK' THEN 3 
      ELSE 4 
    END,
    m.metric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
