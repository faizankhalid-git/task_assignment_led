/*
  # Category Management System & Accurate Shipment Statistics

  ## 1. New Tables
    - `task_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Category name (e.g., INCOMING, OUTGOING)
      - `color` (text) - Display color for UI
      - `active` (boolean) - Whether category is currently active
      - `sort_order` (integer) - Display order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Functions Created
    - `get_total_shipment_stats()` - Returns accurate shipment counts
    - `get_category_list()` - Returns all categories with stats
    - `add_task_category()` - Adds new category
    - `update_task_category()` - Updates category details
    - `delete_task_category()` - Deletes category (with validation)
    - `get_filtered_operator_performance()` - Time-filtered performance data

  ## 3. Security
    - RLS enabled on task_categories table
    - Read access for authenticated users
    - Write access only for admins/super_admins

  ## 4. Data
    - Seeds current categories from existing data
    - Maintains backward compatibility
*/

-- ============================================
-- PART 1: Create Task Categories Table
-- ============================================

CREATE TABLE IF NOT EXISTS task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "Anyone can view categories"
  ON task_categories FOR SELECT
  TO authenticated
  USING (true);

-- Write access only for admins
CREATE POLICY "Only admins can insert categories"
  ON task_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Only admins can update categories"
  ON task_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Only admins can delete categories"
  ON task_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_categories_active ON task_categories(active);
CREATE INDEX IF NOT EXISTS idx_task_categories_sort_order ON task_categories(sort_order);

-- ============================================
-- PART 2: Seed Current Categories
-- ============================================

INSERT INTO task_categories (name, color, sort_order, active) VALUES
  ('INCOMING', '#3B82F6', 1, true),
  ('OUTGOING', '#10B981', 2, true),
  ('OPI', '#8B5CF6', 3, true),
  ('DELIVERY', '#F97316', 4, true),
  ('PICKUP', '#06B6D4', 5, true),
  ('WAREHOUSE', '#6366F1', 6, true),
  ('SORTING', '#EC4899', 7, true),
  ('OTHER', '#6B7280', 99, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 3: Shipment Statistics Functions
-- ============================================

-- Get accurate total statistics
CREATE OR REPLACE FUNCTION get_total_shipment_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_shipments', COUNT(DISTINCT s.id),
    'total_operators', COUNT(DISTINCT o.id),
    'active_operators', COUNT(DISTINCT o.id) FILTER (WHERE o.active = true),
    'completed_shipments', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed'),
    'total_operator_tasks', COUNT(*),
    'total_points', COALESCE(SUM(
      CASE 
        WHEN s.intensity = 'high' THEN 3
        WHEN s.intensity = 'medium' THEN 2
        WHEN s.intensity = 'low' THEN 1
        ELSE 0
      END
    ), 0)
  ) INTO result
  FROM shipments s
  LEFT JOIN operators o ON o.name = ANY(s.assigned_operators)
  WHERE 
    (p_start_date IS NULL OR s.completed_at >= p_start_date)
    AND (p_end_date IS NULL OR s.completed_at <= p_end_date)
    AND s.status = 'completed'
    AND s.completed_at IS NOT NULL;
    
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get category list with usage stats
CREATE OR REPLACE FUNCTION get_category_list()
RETURNS TABLE (
  id uuid,
  name text,
  color text,
  active boolean,
  sort_order integer,
  usage_count bigint,
  can_delete boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.name,
    tc.color,
    tc.active,
    tc.sort_order,
    COALESCE(COUNT(DISTINCT s.id), 0)::bigint as usage_count,
    COALESCE(COUNT(DISTINCT s.id), 0) = 0 as can_delete
  FROM task_categories tc
  LEFT JOIN shipments s ON get_task_category(s.title) = tc.name
  GROUP BY tc.id, tc.name, tc.color, tc.active, tc.sort_order
  ORDER BY tc.sort_order, tc.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add new category
CREATE OR REPLACE FUNCTION add_task_category(
  p_name text,
  p_color text DEFAULT '#6B7280',
  p_active boolean DEFAULT true
)
RETURNS uuid AS $$
DECLARE
  v_category_id uuid;
  v_max_sort_order integer;
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins can add categories';
  END IF;

  -- Get max sort order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_max_sort_order
  FROM task_categories;

  -- Insert new category
  INSERT INTO task_categories (name, color, active, sort_order)
  VALUES (UPPER(TRIM(p_name)), p_color, p_active, v_max_sort_order)
  RETURNING id INTO v_category_id;

  RETURN v_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update category
CREATE OR REPLACE FUNCTION update_task_category(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_sort_order integer DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins can update categories';
  END IF;

  UPDATE task_categories
  SET
    name = COALESCE(UPPER(TRIM(p_name)), name),
    color = COALESCE(p_color, color),
    active = COALESCE(p_active, active),
    sort_order = COALESCE(p_sort_order, sort_order),
    updated_at = now()
  WHERE id = p_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete category (with validation)
CREATE OR REPLACE FUNCTION delete_task_category(p_id uuid)
RETURNS boolean AS $$
DECLARE
  v_category_name text;
  v_usage_count integer;
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins can delete categories';
  END IF;

  -- Get category name
  SELECT name INTO v_category_name
  FROM task_categories
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Check if category is in use
  SELECT COUNT(DISTINCT s.id) INTO v_usage_count
  FROM shipments s
  WHERE get_task_category(s.title) = v_category_name;

  IF v_usage_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category with % associated shipments', v_usage_count;
  END IF;

  -- Delete category
  DELETE FROM task_categories WHERE id = p_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: Time-Filtered Performance Functions
-- ============================================

-- Get filtered operator performance
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
      o.id as operator_id,
      o.name as operator_name,
      o.color as operator_color,
      o.active,
      COUNT(*) as total_completed_tasks,
      SUM(
        CASE 
          WHEN fa.intensity = 'high' THEN 3
          WHEN fa.intensity = 'medium' THEN 2
          WHEN fa.intensity = 'low' THEN 1
          ELSE 0
        END
      ) as total_score,
      COUNT(*) FILTER (WHERE fa.intensity = 'high') as high_intensity_count,
      COUNT(*) FILTER (WHERE fa.intensity = 'medium') as medium_intensity_count,
      COUNT(*) FILTER (WHERE fa.intensity = 'low') as low_intensity_count,
      COUNT(DISTINCT DATE(fa.completed_at)) as active_days,
      MIN(fa.completed_at) as first_completion_date,
      MAX(fa.completed_at) as last_completion_date
    FROM operators o
    LEFT JOIN filtered_assignments fa ON o.id = fa.operator_id
    WHERE EXISTS (SELECT 1 FROM filtered_assignments WHERE operator_id = o.id)
    GROUP BY o.id, o.name, o.color, o.active
  ),
  category_data AS (
    SELECT 
      o.id as operator_id,
      json_agg(
        json_build_object(
          'category', get_task_category(fa.title),
          'is_delivery', fa.is_delivery,
          'task_count', COUNT(*),
          'category_score', SUM(
            CASE 
              WHEN fa.intensity = 'high' THEN 3
              WHEN fa.intensity = 'medium' THEN 2
              WHEN fa.intensity = 'low' THEN 1
              ELSE 0
            END
          ),
          'avg_intensity_score', ROUND(AVG(
            CASE 
              WHEN fa.intensity = 'high' THEN 3
              WHEN fa.intensity = 'medium' THEN 2
              WHEN fa.intensity = 'low' THEN 1
              ELSE 0
            END
          )::numeric, 2),
          'first_completion', MIN(fa.completed_at),
          'last_completion', MAX(fa.completed_at)
        ) ORDER BY SUM(
          CASE 
            WHEN fa.intensity = 'high' THEN 3
            WHEN fa.intensity = 'medium' THEN 2
            WHEN fa.intensity = 'low' THEN 1
            ELSE 0
          END
        ) DESC
      ) as category_breakdown
    FROM operators o
    LEFT JOIN filtered_assignments fa ON o.id = fa.operator_id
    WHERE EXISTS (SELECT 1 FROM filtered_assignments WHERE operator_id = o.id)
    GROUP BY o.id
  )
  SELECT 
    os.operator_id,
    os.operator_name,
    os.operator_color,
    os.active,
    ROW_NUMBER() OVER (ORDER BY os.total_score DESC NULLS LAST, os.total_completed_tasks DESC) as rank,
    os.total_completed_tasks::bigint,
    os.total_score::bigint,
    CASE 
      WHEN os.total_completed_tasks > 0 THEN
        ROUND((os.total_score::numeric / os.total_completed_tasks)::numeric, 2)
      ELSE 0
    END as avg_score_per_task,
    os.high_intensity_count::bigint,
    os.medium_intensity_count::bigint,
    os.low_intensity_count::bigint,
    os.active_days::bigint,
    os.first_completion_date,
    os.last_completion_date,
    COALESCE(cd.category_breakdown, '[]'::json) as category_breakdown
  FROM operator_stats os
  LEFT JOIN category_data cd ON os.operator_id = cd.operator_id
  ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant necessary permissions
GRANT SELECT ON task_categories TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

COMMENT ON TABLE task_categories IS 'Manages work balance categories for KPI tracking. Allows dynamic addition/removal of categories.';
COMMENT ON FUNCTION get_total_shipment_stats IS 'Returns accurate shipment statistics including total shipments (not operator assignments).';
COMMENT ON FUNCTION get_filtered_operator_performance IS 'Returns time-filtered operator performance data for KPI dashboard filters.';
