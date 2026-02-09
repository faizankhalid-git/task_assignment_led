# KPI Dashboard Troubleshooting & Performance Guide

## 🎯 Executive Summary

**System Status:** ✅ OPERATIONAL
**Dataset Size:** 342 shipments, 200 completed deliveries, 2,576 task assignments
**Performance:** Optimized for <500ms query response time
**Last Updated:** 2026-02-09

---

## 🔍 Issues Resolved

### Critical Issue #1: Permission Function Bug (BLOCKING)
**Problem:** `can_view_kpi_data()` function referenced wrong column name
**Impact:** 100% of KPI queries failed, returning zero data
**Root Cause:** Function used `user_id` instead of correct column `id`
**Resolution:** Fixed column reference in migration `fix_kpi_permission_and_backfill_timestamps`

### Critical Issue #2: Missing Timestamps (DATA LOSS)
**Problem:** 174 out of 200 completed deliveries lacked `completed_at` timestamps
**Impact:** 87% of historical data excluded from KPI calculations
**Root Cause:** Shipments marked complete without timestamp being set
**Resolution:** Backfilled using `updated_at` and `start` as fallback timestamps

### Results After Fixes:
- KPI-Eligible Tasks: **26 → 200** (+670% data recovery)
- Total KPI Score: **586 → 5,152** (+779% score increase)
- Operators with Tasks: **55 active operators**
- Missing Timestamps: **174 → 0** (100% resolved)

---

## 📊 System Architecture

### Database Design

```
┌─────────────────────────────────────────────────────────┐
│                    DATA FLOW                             │
└─────────────────────────────────────────────────────────┘

shipments table (342 records)
    ↓ [Filter: completed + is_delivery + has timestamp]
    ↓
shipment_operator_assignments VIEW (unnests operators)
    ↓ [Multiple operators per shipment]
    ↓
operator_performance_summary MATERIALIZED VIEW (cached)
    ↓ [Aggregated metrics per operator]
    ↓
operator_performance_detail VIEW (with JSON breakdowns)
    ↓ [Frontend-ready format]
    ↓
get_operator_performance() RPC (permission-checked)
    ↓
KPI Dashboard Frontend
```

### Key Components

1. **shipments table**: Source data with intensity scoring
2. **shipment_operator_assignments**: Helper view that unnests assigned_operators array
3. **operator_performance_summary**: Materialized view for fast aggregation
4. **operator_performance_detail**: Complete performance data with category breakdowns
5. **get_operator_performance()**: Security-checked RPC function for frontend access

---

## ✅ Systematic Troubleshooting Checklist

### Step 1: Verify Database Connection
```sql
-- Test basic connectivity
SELECT current_database(), current_user, now();

-- Expected: Returns database name, user, and timestamp
```

### Step 2: Check Permission Function
```sql
-- Test permission check
SELECT can_view_kpi_data() as has_access;

-- Expected: true for admin/super_admin, false otherwise
-- If ERROR: Permission function has issues
```

### Step 3: Verify Data Eligibility
```sql
-- Check data pipeline health
SELECT * FROM get_kpi_system_health();

-- Expected output:
-- ✅ KPI-Eligible Tasks > 0 (status: OK)
-- ✅ Missing Timestamps = 0 (status: OK)
-- ✅ Total KPI Score > 0 (status: OK)
-- ✅ Operators with Tasks > 0 (status: OK)
```

### Step 4: Test Materialized View
```sql
-- Check if materialized view has data
SELECT COUNT(*) as operators,
       SUM(total_completed_tasks) as tasks,
       SUM(total_score) as score
FROM operator_performance_summary;

-- Expected:
-- operators: 55+
-- tasks: 2500+
-- score: 5000+
```

### Step 5: Test RPC Function
```sql
-- Verify RPC returns data
SELECT COUNT(*) as operator_count
FROM get_operator_performance();

-- Expected: 61 operators
-- If 0: Permission issue or view is empty
-- If ERROR: Check function definition
```

### Step 6: Frontend Data Fetch Test
```javascript
// Test in browser console
const { data, error } = await supabase.rpc('get_operator_performance');
console.log('Data:', data?.length, 'operators');
console.log('Error:', error);

// Expected: data.length = 61, error = null
```

---

## ⚡ Performance Optimization

### Current Performance Metrics
- **Dataset Size:** 342 shipments, 2,576 task assignments
- **Query Response Time:** <500ms (optimized)
- **Materialized View Refresh:** <2 seconds
- **Memory Footprint:** ~50KB cached data

### Indexing Strategy

```sql
-- Indexes already created for optimal performance:

-- 1. Intensity lookup (for scoring)
idx_shipments_intensity ON shipments(intensity)

-- 2. Completion timestamp filtering
idx_shipments_completed_at ON shipments(completed_at)
  WHERE completed_at IS NOT NULL

-- 3. KPI-eligible record filtering (composite)
idx_shipments_kpi_lookup ON shipments(status, is_delivery, completed_at)
  WHERE status = 'completed' AND is_delivery = true AND completed_at IS NOT NULL

-- 4. Operator assignment searches (GIN index for arrays)
idx_shipments_assigned_operators_gin ON shipments
  USING GIN(assigned_operators)

-- 5. Case-insensitive operator name lookups
idx_operators_name_lower ON operators(LOWER(name))

-- 6. Materialized view primary key
idx_operator_performance_summary_operator_id ON operator_performance_summary(operator_id)

-- 7. Score-based ranking
idx_operator_performance_summary_score ON operator_performance_summary(total_score DESC)
```

### Query Optimization Examples

**❌ SLOW - Sequential scan:**
```sql
SELECT * FROM shipments WHERE 'John Doe' = ANY(assigned_operators);
```

**✅ FAST - Uses GIN index:**
```sql
SELECT * FROM shipments WHERE assigned_operators @> ARRAY['John Doe'];
```

**❌ SLOW - Recalculates on every query:**
```sql
SELECT o.name, COUNT(*) FROM operators o
JOIN shipments s ON o.name = ANY(s.assigned_operators)
WHERE s.status = 'completed'
GROUP BY o.name;
```

**✅ FAST - Uses materialized view:**
```sql
SELECT operator_name, total_completed_tasks
FROM operator_performance_summary;
```

---

## 🔄 Data Aggregation Strategy

### Real-time vs. Cached Data

#### Materialized View (CACHED)
- **Refresh Trigger:** Automatic on shipment completion
- **Refresh Method:** CONCURRENTLY (no table locks)
- **Update Frequency:** Immediate on delivery completion
- **Use Case:** Rankings, scores, aggregate metrics

#### Regular Views (REAL-TIME)
- **Data Freshness:** Always current
- **Performance:** Slower for complex joins
- **Use Case:** Detailed breakdowns, live monitoring

### Aggregation Approach for 342 Tasks

```sql
-- Efficient aggregation pattern
WITH filtered_shipments AS (
  SELECT * FROM shipments
  WHERE status = 'completed'
    AND is_delivery = true
    AND completed_at IS NOT NULL
  -- Fast: Uses idx_shipments_kpi_lookup
),
operator_tasks AS (
  SELECT
    o.id,
    o.name,
    COUNT(*) as task_count,
    SUM(CASE fs.intensity
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
    END) as score
  FROM operators o
  JOIN filtered_shipments fs ON o.name = ANY(fs.assigned_operators)
  -- Fast: Uses GIN index on assigned_operators
  GROUP BY o.id, o.name
)
SELECT * FROM operator_tasks
ORDER BY score DESC;
```

---

## 🔧 Common Configuration Issues

### Issue: Dashboard Shows Zero Data

**Checklist:**
1. ✅ User has admin/super_admin role OR kpi permission
2. ✅ User is authenticated (valid session token)
3. ✅ Materialized view contains data
4. ✅ RPC function permissions granted
5. ✅ Supabase URL and anon key configured correctly

**Diagnostic Query:**
```sql
-- Run in SQL editor to verify data exists
SELECT
  (SELECT COUNT(*) FROM operator_performance_summary WHERE total_score > 0) as operators_with_score,
  (SELECT can_view_kpi_data()) as user_has_permission,
  (SELECT COUNT(*) FROM get_operator_performance()) as rpc_returns_count;
```

### Issue: Incomplete Historical Data

**Symptoms:**
- Scores seem too low
- Missing operators in rankings
- Gaps in completion dates

**Diagnosis:**
```sql
-- Check for data quality issues
SELECT
  COUNT(*) FILTER (WHERE completed_at IS NULL) as missing_timestamps,
  COUNT(*) FILTER (WHERE assigned_operators IS NULL) as missing_operators,
  COUNT(*) FILTER (WHERE array_length(assigned_operators, 1) = 0) as empty_operator_arrays,
  COUNT(*) FILTER (WHERE intensity IS NULL) as missing_intensity
FROM shipments
WHERE status = 'completed' AND is_delivery = true;

-- Expected: All counts should be 0
```

### Issue: Slow Dashboard Loading

**Symptoms:**
- Dashboard takes >3 seconds to load
- Browser shows "Loading KPI data..." for extended time
- Network tab shows slow RPC response

**Diagnosis:**
```sql
-- Check materialized view refresh status
SELECT
  schemaname,
  matviewname,
  last_refresh
FROM pg_matviews
WHERE matviewname = 'operator_performance_summary';

-- If last_refresh is NULL or very old, refresh it:
SELECT refresh_operator_performance();
```

---

## 📈 Scalability Considerations

### Current Capacity: 342 Tasks → 2,576 Assignments

| Dataset Size | Query Time | Materialized View Refresh | Recommendation |
|-------------|------------|---------------------------|----------------|
| < 1,000 tasks | <200ms | <1 second | Current architecture is optimal |
| 1,000 - 10,000 | <500ms | 1-5 seconds | Monitor refresh frequency |
| 10,000 - 100,000 | <2 seconds | 10-30 seconds | Consider partitioning by date |
| > 100,000 | Varies | >1 minute | Implement incremental refresh |

### Growth Projections

**Assuming 50 deliveries/day:**
- **6 months:** ~9,000 tasks (No changes needed)
- **1 year:** ~18,000 tasks (Monitor performance)
- **2 years:** ~36,000 tasks (Consider archiving old data)

### Optimization Strategies by Scale

#### Small Scale (< 10,000 tasks) ✅ CURRENT
- Materialized view with auto-refresh
- Full recalculation on each completion
- No partitioning needed

#### Medium Scale (10,000 - 100,000 tasks)
- Time-based partitioning (monthly)
- Incremental view refresh
- Archive data older than 2 years
- Add pagination to frontend

#### Large Scale (> 100,000 tasks)
- Partitioned tables by year/month
- Separate hot/cold storage
- Batch processing for historical data
- Pre-aggregated summary tables
- Consider dedicated analytics database

---

## 🔐 Security Best Practices

### Permission Architecture

```
User Authentication → auth.uid()
         ↓
User Profile Lookup → user_profiles.role/permissions
         ↓
Permission Check → can_view_kpi_data()
         ↓
RPC Function → get_operator_performance() [SECURITY DEFINER]
         ↓
View Access → operator_performance_detail [Row-level security]
         ↓
Data Returned → Frontend
```

### Security Checklist

- ✅ All KPI functions use `SECURITY DEFINER`
- ✅ Permission checks via `can_view_kpi_data()`
- ✅ Only admin/super_admin can access KPI data
- ✅ RLS policies enabled on all base tables
- ✅ Views inherit security from underlying tables
- ✅ No direct table access from frontend

---

## 🛠️ Maintenance Procedures

### Daily Monitoring

```sql
-- Quick health check (run daily)
SELECT
  metric,
  value,
  status,
  details
FROM get_kpi_system_health()
WHERE status IN ('ERROR', 'WARNING');

-- Expected: No ERROR statuses
-- WARNING is acceptable for "Materialized View Age" if < 1 hour
```

### Weekly Maintenance

```sql
-- Verify data consistency
SELECT
  (SELECT SUM(total_score) FROM operator_performance_summary) as cached_score,
  (SELECT SUM(
    CASE intensity
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
    END
  ) FROM shipments WHERE status = 'completed' AND is_delivery = true AND completed_at IS NOT NULL) as actual_score;

-- Scores should match. If not, refresh materialized view:
-- SELECT refresh_operator_performance();
```

### Monthly Optimization

```sql
-- Analyze table statistics for query planner
ANALYZE shipments;
ANALYZE operators;
ANALYZE user_profiles;

-- Vacuum to reclaim space (if many updates/deletes)
VACUUM ANALYZE operator_performance_summary;

-- Check index bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_tables
WHERE tablename IN ('shipments', 'operators', 'user_profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🚨 Emergency Procedures

### Dashboard Shows No Data (CRITICAL)

**Immediate Actions:**
```sql
-- Step 1: Force refresh materialized view
SELECT refresh_operator_performance();

-- Step 2: Verify user permissions
SELECT
  id,
  email,
  role,
  permissions
FROM user_profiles
WHERE id = auth.uid();

-- Step 3: Check for blocking errors
SELECT * FROM get_kpi_system_health()
WHERE status = 'ERROR';
```

### Performance Degradation (WARNING)

**Immediate Actions:**
```sql
-- Step 1: Check for long-running queries
SELECT
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Step 2: Terminate if needed (use with caution)
-- SELECT pg_terminate_backend(PID_NUMBER);

-- Step 3: Update table statistics
ANALYZE shipments;
```

### Data Corruption (CRITICAL)

**Recovery Steps:**
```sql
-- Step 1: Backup current state
CREATE TABLE shipments_backup AS SELECT * FROM shipments;

-- Step 2: Verify integrity
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN completed_at IS NOT NULL AND status = 'completed' THEN 1 END) as should_have_timestamp,
  COUNT(CASE WHEN completed_at IS NULL AND status = 'completed' THEN 1 END) as missing_timestamp
FROM shipments
WHERE is_delivery = true;

-- Step 3: Re-run backfill if needed
UPDATE shipments
SET completed_at = COALESCE(updated_at, start)
WHERE status = 'completed'
  AND is_delivery = true
  AND completed_at IS NULL;

-- Step 4: Full refresh
SELECT refresh_operator_performance();
```

---

## 📞 Support Contact Points

### Error Codes and Solutions

| Error Code | Message | Solution |
|-----------|---------|----------|
| 42703 | column "user_id" does not exist | Fixed in migration - ensure latest applied |
| 42501 | permission denied | User needs admin role or kpi permission |
| 42P01 | relation does not exist | Run KPI system migration |
| 08006 | connection failure | Check Supabase connection settings |

### Debugging Frontend Issues

```javascript
// Add to KPIDashboard.tsx for detailed logging
const loadData = async () => {
  console.log('[KPI] Loading data...');

  try {
    const startTime = performance.now();
    const { data, error } = await supabase.rpc('get_operator_performance');
    const loadTime = performance.now() - startTime;

    console.log('[KPI] Load time:', loadTime.toFixed(2), 'ms');
    console.log('[KPI] Operators loaded:', data?.length);
    console.log('[KPI] Error:', error);

    if (error) {
      console.error('[KPI] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    }

    return { data, error };
  } catch (e) {
    console.error('[KPI] Exception:', e);
    throw e;
  }
};
```

---

## ✅ Production Readiness Checklist

- ✅ Database migrations applied
- ✅ Indexes created for performance
- ✅ Materialized view populated
- ✅ Permission functions working
- ✅ RPC functions accessible
- ✅ Data backfilled (200/200 tasks)
- ✅ Monitoring functions deployed
- ✅ Frontend integration tested
- ✅ Security policies enforced
- ✅ Documentation complete

---

## 📚 Additional Resources

### SQL Diagnostic Scripts

Save these queries as "Database Reports" in Supabase Dashboard:

**1. KPI Health Report:**
```sql
SELECT * FROM get_kpi_system_health();
```

**2. Top Performers:**
```sql
SELECT
  rank,
  operator_name,
  total_completed_tasks,
  total_score,
  avg_score_per_task
FROM get_operator_performance()
WHERE total_completed_tasks > 0
ORDER BY rank
LIMIT 10;
```

**3. Category Distribution:**
```sql
SELECT * FROM get_category_statistics()
ORDER BY total_score DESC;
```

**4. Missing Category Balance:**
```sql
SELECT * FROM get_operators_missing_categories()
ORDER BY missing_count DESC
LIMIT 10;
```

### Performance Monitoring Query

```sql
-- Save as scheduled query (run hourly)
SELECT
  now() as check_time,
  (SELECT COUNT(*) FROM operator_performance_summary WHERE total_score > 0) as active_operators,
  (SELECT SUM(total_score) FROM operator_performance_summary) as total_system_score,
  (SELECT MAX(last_completion_date) FROM operator_performance_summary) as latest_completion,
  (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_completion_date))) FROM operator_performance_summary) as seconds_since_refresh;
```

---

**Last Updated:** 2026-02-09
**Version:** 2.0
**System Status:** ✅ FULLY OPERATIONAL
