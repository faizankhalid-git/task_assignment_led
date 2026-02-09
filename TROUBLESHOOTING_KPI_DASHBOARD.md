# KPI Dashboard Troubleshooting Guide

**Last Updated:** 2026-02-09
**Issue:** Dashboard showing zeros despite having data in database

---

## Quick Diagnostic Steps

### Step 1: Clear Browser Cache & Hard Refresh

**IMPORTANT:** The new code is now deployed, but your browser may be loading the old version.

1. **Open the application**
2. **Hard refresh:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
3. **Or clear cache:**
   - Chrome: `F12` → Application tab → Clear Storage → Clear site data
   - Firefox: `F12` → Storage tab → Clear All
4. **Logout and login again**

---

### Step 2: Run Quick Diagnostic

After refreshing, open browser console (`F12` → Console tab) and run:

```javascript
checkKPIAccess()
```

This will show:
- ✅ Your login status
- ✅ Your role and permissions
- ✅ Whether you should have access
- ✅ If data is available in database

---

### Step 3: Check Console Logs

Navigate to the KPI Dashboard tab and watch the console. You should see:

```
💡 Quick diagnostic available: checkKPIAccess()
🔐 KPI Dashboard Access Check
  ✅ User authenticated: your.email@stegra.com
  📋 Profile loaded: { role: 'admin', permissions: [...] }
  🔍 Access Check: { isAdmin: true, hasKpiPermission: false, willGrantAccess: true }
  ✅ Access GRANTED - Loading KPI data...
📊 Loading KPI Data
  🔄 Fetching data from database...
  ✅ Data fetched successfully: { operators: 56, categories: 8, missingCategories: 0 }
  ✅ State updated successfully
```

---

## Common Issues & Solutions

### Issue 1: Old Code Still Running

**Symptoms:**
- No console logs appearing
- `checkKPIAccess` function not found
- Dashboard still shows zeros

**Solution:**
```bash
# 1. Hard refresh (Ctrl+Shift+R)
# 2. If that doesn't work, clear all site data
# 3. Close all browser tabs with the application
# 4. Reopen in new tab
# 5. Check browser console for the message:
#    "💡 Quick diagnostic available: checkKPIAccess()"
```

---

### Issue 2: Access Denied

**Symptoms:**
Console shows:
```
⚠️ Access DENIED - User is not admin and lacks kpi permission
```

**Solution:**
Your account needs either:
- **Admin role** (admin or super_admin), OR
- **KPI permission** in your permissions array

**Check your permissions:**
```javascript
checkKPIAccess()
```

Look for:
```
Profile: { role: 'operator', permissions: ['led_display', 'shipments'] }
Access Check: { isAdmin: false, hasKpiPermission: false, shouldHaveAccess: false }
```

**Fix:** Contact super admin to:
1. Upgrade your role to admin, OR
2. Add 'kpi' to your permissions

---

### Issue 3: Database Function Error

**Symptoms:**
Console shows:
```
❌ KPI Service: Error fetching operator performance
Error details: { message: 'function get_operator_performance() does not exist', ... }
```

**Solution:**
Database function missing or permission issue.

**Run this in browser console:**
```javascript
// Test database connectivity
const { data, error } = await supabase.rpc('get_operator_performance');
console.log('Test result:', { data: data?.length, error });
```

**If error persists:** Database needs the function created (backend issue).

---

### Issue 4: Empty Data Array

**Symptoms:**
Console shows:
```
✅ Data fetched successfully: { operators: 0, categories: 0, missingCategories: 0 }
```

**Solution:**
Data exists in database but not being returned. Check:

1. **Materialized view needs refresh:**
```javascript
// In console
const { error } = await supabase.rpc('refresh_operator_performance');
console.log('Refresh result:', error || 'Success');
```

2. **Check raw data:**
```javascript
const { data } = await supabase.from('shipments')
  .select('*')
  .eq('status', 'completed')
  .limit(5);
console.log('Completed shipments:', data);
```

---

### Issue 5: Data Shows in Console but Not in UI

**Symptoms:**
- Console logs show data fetched successfully
- Dashboard still shows zeros
- State update appears to work

**Solution:**
React rendering issue. Check:

```javascript
// After page loads, check component state
// Look for the performance state in React DevTools
// Or add temporary logging in the render function
```

**Workaround:**
Click the "Refresh" button on the dashboard.

---

## Expected Console Output (Success)

When everything works, you should see:

```
💡 Quick diagnostic available: checkKPIAccess()
💡 Full diagnostics available: kpiDiagnostics.runFullDiagnostic()

🔐 KPI Dashboard Access Check
  ✅ User authenticated: your.email@stegra.com
  📋 Profile loaded: { role: 'admin', permissions: ['led_display', 'shipments', 'operators', 'settings'] }
  🔍 Access Check: { isAdmin: true, hasKpiPermission: false, willGrantAccess: true }
  ✅ Access GRANTED - Loading KPI data...

📊 Loading KPI Data
  🔄 Fetching data from database...
  🔄 KPI Service: Fetching all operator performance...
  ✅ KPI Service: Fetched 56 operators
  ✅ Data fetched successfully: { operators: 56, categories: 8, missingCategories: 0 }
  📈 Operator data sample: [
    { operator_name: 'Joakim Jaako', total_score: 352, total_completed_tasks: 176, ... },
    { operator_name: 'Lakmal Perera', total_score: 326, total_completed_tasks: 163, ... },
    { operator_name: 'Tim Öberg', total_score: 326, total_completed_tasks: 163, ... }
  ]
  ✅ State updated successfully
```

And the dashboard should display:
- **Total Operators:** 56
- **Total Tasks Completed:** 4,749
- **Total Points:** 9,499
- List of operators with rankings

---

## Advanced Diagnostics

If basic steps don't work, gather detailed information:

### 1. Run Full Diagnostic (if available)

```javascript
// If loaded
kpiDiagnostics.runFullDiagnostic()
```

### 2. Manual Database Check

```javascript
// Check if you can query the database at all
const { data: operators } = await supabase.from('operators').select('*').limit(5);
console.log('Operators:', operators);

// Check if completed shipments exist
const { data: shipments } = await supabase.from('shipments')
  .select('*')
  .eq('status', 'completed')
  .limit(5);
console.log('Completed shipments:', shipments);

// Check if performance view has data
const { data: perfView } = await supabase
  .from('operator_performance_summary')
  .select('*')
  .limit(5);
console.log('Performance summary:', perfView);
```

### 3. Check Permissions Function

```javascript
// Test the backend permission function
const { data, error } = await supabase.rpc('can_view_kpi_data');
console.log('Permission check:', { canView: data, error });
```

### 4. Network Tab Check

1. Open DevTools → Network tab
2. Refresh the dashboard
3. Look for requests to `get_operator_performance`
4. Check response status and data

---

## What Changed in the Fix

### Before (Broken):
```typescript
// Only checked for 'kpi' permission
if (profile?.permissions?.includes('kpi')) {
  setHasAccess(true);
}
// Result: Admins without 'kpi' permission were blocked
```

### After (Fixed):
```typescript
// Check admin role OR kpi permission
const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
const hasKpiPermission = profile?.permissions?.includes('kpi');

if (isAdmin || hasKpiPermission) {
  setHasAccess(true);
}
// Result: All admins have access (matches backend logic)
```

---

## Still Having Issues?

### Information to Provide

1. **Console output** from `checkKPIAccess()`
2. **Browser and version** (Chrome 120, Firefox 121, etc.)
3. **User email** and role
4. **Any error messages** from console
5. **Network tab** showing failed requests (if any)

### Emergency Workaround

If dashboard still doesn't work, access data directly via console:

```javascript
// Get all performance data
const { data } = await supabase.rpc('get_operator_performance');
console.table(data.map(d => ({
  name: d.operator_name,
  tasks: d.total_completed_tasks,
  score: d.total_score,
  rank: d.rank
})));
```

---

## Contact Support

If all steps fail, the issue may be:
- **Database connectivity problem**
- **RLS policy blocking access**
- **Function missing or corrupted**
- **Browser compatibility issue**

Provide full console output and network logs for investigation.

---

**Status:** Enhanced diagnostics deployed
**Build Version:** Latest (includes comprehensive logging)
**Next Steps:** Clear cache → Run checkKPIAccess() → Review console logs
