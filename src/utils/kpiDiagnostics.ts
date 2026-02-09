/**
 * KPI Dashboard Diagnostics Utility
 *
 * Usage in browser console:
 *
 * import { kpiDiagnostics } from './utils/kpiDiagnostics';
 *
 * // Run full diagnostic
 * await kpiDiagnostics.runFullDiagnostic();
 *
 * // Check specific component
 * await kpiDiagnostics.checkPermissions();
 * await kpiDiagnostics.checkDataAvailability();
 * await kpiDiagnostics.checkPerformance();
 */

import { supabase } from '../lib/supabase';

interface DiagnosticResult {
  component: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  details?: any;
  timestamp: Date;
}

class KPIDiagnostics {
  private results: DiagnosticResult[] = [];

  private log(component: string, status: DiagnosticResult['status'], message: string, details?: any) {
    const result: DiagnosticResult = {
      component,
      status,
      message,
      details,
      timestamp: new Date()
    };
    this.results.push(result);

    const emoji = status === 'OK' ? '✅' : status === 'WARNING' ? '⚠️' : status === 'ERROR' ? '❌' : 'ℹ️';
    console.log(`${emoji} [${component}] ${message}`, details || '');

    return result;
  }

  async checkAuthentication() {
    console.group('🔐 Authentication Check');
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        this.log('Authentication', 'ERROR', 'Failed to get user', error);
        console.groupEnd();
        return false;
      }

      if (!user) {
        this.log('Authentication', 'ERROR', 'No authenticated user', null);
        console.groupEnd();
        return false;
      }

      this.log('Authentication', 'OK', `User authenticated: ${user.email}`, { userId: user.id });
      console.groupEnd();
      return true;
    } catch (error) {
      this.log('Authentication', 'ERROR', 'Exception during auth check', error);
      console.groupEnd();
      return false;
    }
  }

  async checkPermissions() {
    console.group('🔑 Permissions Check');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.log('Permissions', 'ERROR', 'Not authenticated', null);
        console.groupEnd();
        return false;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, permissions')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        this.log('Permissions', 'ERROR', 'Failed to fetch user profile', error);
        console.groupEnd();
        return false;
      }

      if (!profile) {
        this.log('Permissions', 'ERROR', 'User profile not found', null);
        console.groupEnd();
        return false;
      }

      const hasAccess = profile.role === 'admin' ||
                       profile.role === 'super_admin' ||
                       profile.permissions?.includes('kpi');

      if (hasAccess) {
        this.log('Permissions', 'OK', 'User has KPI access', {
          role: profile.role,
          permissions: profile.permissions
        });
      } else {
        this.log('Permissions', 'ERROR', 'User lacks KPI permissions', {
          role: profile.role,
          permissions: profile.permissions,
          required: 'admin, super_admin, or kpi permission'
        });
      }

      console.groupEnd();
      return hasAccess;
    } catch (error) {
      this.log('Permissions', 'ERROR', 'Exception during permission check', error);
      console.groupEnd();
      return false;
    }
  }

  async checkDatabaseHealth() {
    console.group('🏥 Database Health Check');
    try {
      const { data, error } = await supabase.rpc('get_kpi_system_health');

      if (error) {
        this.log('Database Health', 'ERROR', 'Failed to fetch system health', error);
        console.groupEnd();
        return false;
      }

      if (!data || data.length === 0) {
        this.log('Database Health', 'WARNING', 'No health metrics returned', null);
        console.groupEnd();
        return false;
      }

      console.table(data);

      let hasErrors = false;
      let hasWarnings = false;

      data.forEach((metric: any) => {
        if (metric.status === 'ERROR') {
          hasErrors = true;
          this.log('Database Health', 'ERROR', `${metric.metric}: ${metric.details}`, {
            value: metric.value
          });
        } else if (metric.status === 'WARNING') {
          hasWarnings = true;
          this.log('Database Health', 'WARNING', `${metric.metric}: ${metric.details}`, {
            value: metric.value
          });
        }
      });

      if (!hasErrors && !hasWarnings) {
        this.log('Database Health', 'OK', 'All health checks passed', null);
      }

      console.groupEnd();
      return !hasErrors;
    } catch (error) {
      this.log('Database Health', 'ERROR', 'Exception during health check', error);
      console.groupEnd();
      return false;
    }
  }

  async checkDataAvailability() {
    console.group('📊 Data Availability Check');
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.rpc('get_operator_performance');
      const loadTime = performance.now() - startTime;

      if (error) {
        this.log('Data Availability', 'ERROR', 'Failed to fetch KPI data', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        console.groupEnd();
        return false;
      }

      if (!data || data.length === 0) {
        this.log('Data Availability', 'WARNING', 'No operator performance data available', {
          hint: 'Complete some deliveries with assigned operators'
        });
        console.groupEnd();
        return false;
      }

      const operatorsWithTasks = data.filter((op: any) => op.total_completed_tasks > 0).length;
      const totalTasks = data.reduce((sum: number, op: any) => sum + op.total_completed_tasks, 0);
      const totalScore = data.reduce((sum: number, op: any) => sum + op.total_score, 0);

      this.log('Data Availability', 'OK', 'KPI data loaded successfully', {
        loadTime: `${loadTime.toFixed(2)}ms`,
        totalOperators: data.length,
        operatorsWithTasks,
        totalTasks,
        totalScore
      });

      console.groupEnd();
      return true;
    } catch (error) {
      this.log('Data Availability', 'ERROR', 'Exception during data fetch', error);
      console.groupEnd();
      return false;
    }
  }

  async checkPerformance() {
    console.group('⚡ Performance Check');
    try {
      const tests = [
        { name: 'Get Operator Performance', rpc: 'get_operator_performance' },
        { name: 'Get Category Statistics', rpc: 'get_category_statistics' },
        { name: 'Get Missing Categories', rpc: 'get_operators_missing_categories' }
      ];

      const results = [];

      for (const test of tests) {
        const startTime = performance.now();
        const { data, error } = await supabase.rpc(test.rpc as any);
        const loadTime = performance.now() - startTime;

        if (error) {
          this.log('Performance', 'ERROR', `${test.name} failed`, { error, loadTime });
          results.push({ test: test.name, status: 'ERROR', time: loadTime });
        } else {
          const status = loadTime < 500 ? 'OK' : loadTime < 2000 ? 'WARNING' : 'ERROR';
          this.log('Performance', status as any, `${test.name}: ${loadTime.toFixed(2)}ms`, {
            recordCount: data?.length || 0
          });
          results.push({ test: test.name, status, time: loadTime });
        }
      }

      console.table(results);
      console.groupEnd();

      return results.every(r => r.status !== 'ERROR');
    } catch (error) {
      this.log('Performance', 'ERROR', 'Exception during performance test', error);
      console.groupEnd();
      return false;
    }
  }

  async checkCategoryDistribution() {
    console.group('📈 Category Distribution Check');
    try {
      const { data, error } = await supabase.rpc('get_category_statistics');

      if (error) {
        this.log('Category Distribution', 'ERROR', 'Failed to fetch category stats', error);
        console.groupEnd();
        return false;
      }

      if (!data || data.length === 0) {
        this.log('Category Distribution', 'WARNING', 'No category data available', null);
        console.groupEnd();
        return false;
      }

      console.table(data);

      this.log('Category Distribution', 'OK', `Found ${data.length} task categories`, {
        categories: data.map((c: any) => c.task_category).join(', ')
      });

      console.groupEnd();
      return true;
    } catch (error) {
      this.log('Category Distribution', 'ERROR', 'Exception during category check', error);
      console.groupEnd();
      return false;
    }
  }

  async testMaterializeViewFreshness() {
    console.group('🔄 Materialized View Freshness');
    try {
      const { data, error } = await supabase
        .from('operator_performance_summary')
        .select('last_completion_date')
        .order('last_completion_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        this.log('View Freshness', 'ERROR', 'Failed to check view freshness', error);
        console.groupEnd();
        return false;
      }

      if (!data || !data.last_completion_date) {
        this.log('View Freshness', 'WARNING', 'No completion data in materialized view', null);
        console.groupEnd();
        return false;
      }

      const lastUpdate = new Date(data.last_completion_date);
      const ageSeconds = (Date.now() - lastUpdate.getTime()) / 1000;
      const ageMinutes = Math.floor(ageSeconds / 60);

      let status: DiagnosticResult['status'];
      if (ageSeconds < 300) {
        status = 'OK';
      } else if (ageSeconds < 3600) {
        status = 'WARNING';
      } else {
        status = 'ERROR';
      }

      this.log('View Freshness', status, `Last refresh: ${ageMinutes} minutes ago`, {
        lastCompletionDate: lastUpdate.toISOString(),
        ageSeconds: Math.floor(ageSeconds),
        recommendation: status !== 'OK' ? 'Consider running refresh_operator_performance()' : null
      });

      console.groupEnd();
      return status !== 'ERROR';
    } catch (error) {
      this.log('View Freshness', 'ERROR', 'Exception checking view freshness', error);
      console.groupEnd();
      return false;
    }
  }

  async runFullDiagnostic() {
    console.clear();
    console.log('%c🔍 KPI DASHBOARD DIAGNOSTIC TOOL', 'font-size: 20px; font-weight: bold; color: #3B82F6;');
    console.log('Running comprehensive system diagnostic...\n');

    this.results = [];
    const startTime = performance.now();

    const checks = [
      { name: 'Authentication', fn: () => this.checkAuthentication() },
      { name: 'Permissions', fn: () => this.checkPermissions() },
      { name: 'Database Health', fn: () => this.checkDatabaseHealth() },
      { name: 'Data Availability', fn: () => this.checkDataAvailability() },
      { name: 'Performance', fn: () => this.checkPerformance() },
      { name: 'Category Distribution', fn: () => this.checkCategoryDistribution() },
      { name: 'View Freshness', fn: () => this.testMaterializeViewFreshness() }
    ];

    const checkResults = [];

    for (const check of checks) {
      const result = await check.fn();
      checkResults.push({ check: check.name, passed: result });
    }

    const totalTime = performance.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('%c📋 DIAGNOSTIC SUMMARY', 'font-size: 16px; font-weight: bold; color: #10B981;');
    console.log('='.repeat(60));

    console.table(checkResults);

    const passed = checkResults.filter(r => r.passed).length;
    const total = checkResults.length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;

    console.log('\n%cRESULTS:', 'font-weight: bold;');
    console.log(`  Checks Passed: ${passed}/${total}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);

    if (errors === 0 && warnings === 0) {
      console.log('\n%c✅ ALL SYSTEMS OPERATIONAL', 'font-size: 14px; font-weight: bold; color: #10B981;');
    } else if (errors === 0) {
      console.log('\n%c⚠️ SYSTEM OPERATIONAL WITH WARNINGS', 'font-size: 14px; font-weight: bold; color: #F59E0B;');
    } else {
      console.log('\n%c❌ SYSTEM HAS CRITICAL ERRORS', 'font-size: 14px; font-weight: bold; color: #EF4444;');
    }

    console.log('\n💡 Tip: Access detailed results with: kpiDiagnostics.getResults()');
    console.log('='.repeat(60) + '\n');

    return {
      passed,
      total,
      errors,
      warnings,
      checkResults,
      totalTime,
      results: this.results
    };
  }

  getResults() {
    return this.results;
  }

  async quickCheck() {
    console.log('🔍 Running quick KPI health check...\n');

    const auth = await this.checkAuthentication();
    if (!auth) {
      console.log('❌ Authentication failed. Cannot proceed.');
      return false;
    }

    const perms = await this.checkPermissions();
    if (!perms) {
      console.log('❌ Permission check failed. User does not have KPI access.');
      return false;
    }

    const data = await this.checkDataAvailability();
    if (!data) {
      console.log('❌ Data availability check failed.');
      return false;
    }

    console.log('✅ Quick check passed! KPI dashboard should be functional.\n');
    return true;
  }

  async refreshMaterializedView() {
    console.log('🔄 Refreshing materialized view...');
    try {
      const { error } = await supabase.rpc('refresh_operator_performance');

      if (error) {
        console.error('❌ Failed to refresh:', error);
        return false;
      }

      console.log('✅ Materialized view refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception during refresh:', error);
      return false;
    }
  }
}

// Export singleton instance
export const kpiDiagnostics = new KPIDiagnostics();

// Make available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).kpiDiagnostics = kpiDiagnostics;
  console.log('💡 KPI Diagnostics available: kpiDiagnostics.runFullDiagnostic()');
}
