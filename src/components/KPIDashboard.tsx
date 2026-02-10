import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { kpiService, OperatorPerformance, CategoryStatistics, OperatorMissingCategories, ShipmentStats, TaskCategory } from '../services/kpiService';
import { TrendingUp, Award, BarChart3, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Calendar, Target, ShieldAlert, Search, X, Plus, Edit2, Trash2, Settings } from 'lucide-react';

type TimeRange = 'today' | 'week' | 'month' | 'all';
type ActiveView = 'rankings' | 'categories' | 'balance' | 'manage-categories';

(window as any).checkKPIAccess = async () => {
  console.group('🔍 Quick KPI Access Diagnostic');
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User:', user?.email || 'Not logged in');

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, permissions')
        .eq('id', user.id)
        .maybeSingle();

      console.log('Profile:', profile);

      const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
      const hasKpiPerm = profile?.permissions?.includes('kpi');

      console.log('Access Check:', {
        isAdmin,
        hasKpiPermission: hasKpiPerm,
        shouldHaveAccess: isAdmin || hasKpiPerm
      });

      const { data: testData, error } = await supabase.rpc('get_operator_performance');
      console.log('Data availability:', {
        recordCount: testData?.length || 0,
        error: error?.message || 'none',
        sample: testData?.slice(0, 2)
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }
  console.groupEnd();
};
console.log('💡 Quick diagnostic available: checkKPIAccess()');

if (import.meta.env.DEV) {
  import('../utils/kpiDiagnostics').then(({ kpiDiagnostics }) => {
    console.log('💡 Full diagnostics available: kpiDiagnostics.runFullDiagnostic()');
  });
}

export function KPIDashboard() {
  const [performance, setPerformance] = useState<OperatorPerformance[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStatistics[]>([]);
  const [missingCategories, setMissingCategories] = useState<OperatorMissingCategories[]>([]);
  const [shipmentStats, setShipmentStats] = useState<ShipmentStats | null>(null);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('rankings');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [balanceSearchQuery, setBalanceSearchQuery] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaskCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6B7280');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [timeRange, hasAccess]);

  const checkAccess = async () => {
    setLoading(true);
    console.group('🔐 KPI Dashboard Access Check');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('❌ Auth error or no user');
        setHasAccess(false);
        setLoading(false);
        console.groupEnd();
        return;
      }

      console.log('✅ User authenticated:', user.email);

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, permissions')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('❌ Profile error or not found');
        setHasAccess(false);
        setLoading(false);
        console.groupEnd();
        return;
      }

      console.log('📋 Profile loaded:', { role: profile.role, permissions: profile.permissions });

      const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
      const hasKpiPermission = profile?.permissions?.includes('kpi');

      console.log('🔍 Access Check:', { isAdmin, hasKpiPermission, willGrantAccess: isAdmin || hasKpiPermission });

      if (isAdmin || hasKpiPermission) {
        console.log('✅ Access GRANTED - Loading KPI data...');
        setHasAccess(true);
        await loadData();
      } else {
        console.warn('⚠️ Access DENIED');
        setHasAccess(false);
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Exception during access check:', error);
      setHasAccess(false);
      setLoading(false);
    }

    console.groupEnd();
  };

  const getDateRangeForFilter = (range: TimeRange): { start: string; end: string } | null => {
    if (range === 'all') return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startDate: Date;
    switch (range) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        break;
      default:
        return null;
    }

    return {
      start: startDate.toISOString(),
      end: new Date().toISOString()
    };
  };

  const loadData = async () => {
    setLoading(true);
    console.group('📊 Loading KPI Data');

    try {
      console.log('🔄 Fetching data from database...');
      const dateRange = getDateRangeForFilter(timeRange);

      const [perfData, catData, missingData, statsData, categoriesData] = await Promise.all([
        dateRange
          ? kpiService.getFilteredOperatorPerformance(dateRange.start, dateRange.end)
          : kpiService.getAllOperatorPerformance(),
        kpiService.getCategoryStatistics(),
        kpiService.getOperatorsMissingCategories(),
        dateRange
          ? kpiService.getShipmentStats(dateRange.start, dateRange.end)
          : kpiService.getShipmentStats(),
        kpiService.getCategoryList()
      ]);

      console.log('✅ Data fetched successfully:', {
        operators: perfData.length,
        categories: catData.length,
        missingCategories: missingData.length,
        stats: statsData
      });

      setPerformance(perfData);
      setCategoryStats(catData);
      setMissingCategories(missingData);
      setShipmentStats(statsData);
      setCategories(categoriesData);

      console.log('✅ State updated successfully');
    } catch (error) {
      console.error('❌ Error loading KPI data:', error);
      showMessage('error', 'Failed to load KPI data');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const handleRefresh = async () => {
    try {
      await kpiService.refreshPerformanceMetrics();
      await loadData();
      showMessage('success', 'Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      showMessage('error', 'Failed to refresh data');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showMessage('error', 'Category name is required');
      return;
    }

    try {
      await kpiService.addCategory(newCategoryName.trim(), newCategoryColor, true);
      setNewCategoryName('');
      setNewCategoryColor('#6B7280');
      setShowCategoryModal(false);
      await loadData();
      showMessage('success', 'Category added successfully');
    } catch (error: any) {
      console.error('Error adding category:', error);
      showMessage('error', error.message || 'Failed to add category');
    }
  };

  const handleUpdateCategory = async (id: string, updates: any) => {
    try {
      await kpiService.updateCategory(id, updates);
      await loadData();
      showMessage('success', 'Category updated successfully');
    } catch (error: any) {
      console.error('Error updating category:', error);
      showMessage('error', error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await kpiService.deleteCategory(id);
      await loadData();
      showMessage('success', 'Category deleted successfully');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showMessage('error', error.message || 'Failed to delete category');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleOperatorExpand = (operatorId: string) => {
    setExpandedOperator(expandedOperator === operatorId ? null : operatorId);
  };

  const getMaxScore = () => {
    return Math.max(...performance.map(p => p.total_score), 1);
  };

  const getRankBadge = (rank: number | null) => {
    if (!rank) return null;

    if (rank === 1) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
          <Award className="w-4 h-4 text-yellow-600" />
          <span className="text-xs font-bold text-yellow-700">#1</span>
        </div>
      );
    }

    if (rank <= 3) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded-full">
          <Award className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-700">#{rank}</span>
        </div>
      );
    }

    return (
      <span className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full">
        #{rank}
      </span>
    );
  };

  const filteredPerformance = performance.filter(op =>
    op.operator_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCategories = categoryStats.filter(cat =>
    cat.task_category.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const filteredMissingCategories = missingCategories.filter(mc =>
    mc.operator_name.toLowerCase().includes(balanceSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading KPI data...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="w-16 h-16 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h3>
          <p className="text-slate-600">
            Performance KPI data is only available to Super Administrators.
            Please contact your system administrator if you need access to this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Operator Performance Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button
                onClick={() => setTimeRange('today')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === 'today'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeRange('week')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === 'week'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === 'month'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === 'all'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveView('rankings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeView === 'rankings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Rankings
            </div>
          </button>
          <button
            onClick={() => setActiveView('categories')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeView === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Categories
            </div>
          </button>
          <button
            onClick={() => setActiveView('balance')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeView === 'balance'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Workload Balance
            </div>
          </button>
          <button
            onClick={() => setActiveView('manage-categories')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeView === 'manage-categories'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Categories
            </div>
          </button>
        </div>

        {activeView === 'rankings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-600 font-medium mb-1">Total Operators</div>
                <div className="text-2xl font-bold text-blue-900">{shipmentStats?.total_operators || 0}</div>
                <div className="text-xs text-blue-600 mt-1">{shipmentStats?.active_operators || 0} active</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-600 font-medium mb-1">Total Shipments</div>
                <div className="text-2xl font-bold text-green-900">{shipmentStats?.completed_shipments || 0}</div>
                <div className="text-xs text-green-600 mt-1">{shipmentStats?.total_operator_tasks || 0} task assignments</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm text-purple-600 font-medium mb-1">Total Points</div>
                <div className="text-2xl font-bold text-purple-900">{shipmentStats?.total_points || 0}</div>
                <div className="text-xs text-purple-600 mt-1">From completed tasks</div>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search operators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {filteredPerformance.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">
                  {searchQuery ? 'No operators match your search' : 'No performance data available'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {searchQuery ? 'Try different search terms' : 'Complete some deliveries to see operator rankings'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPerformance.map((op) => (
                  <div
                    key={op.operator_id}
                    className="border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div
                      onClick={() => toggleOperatorExpand(op.operator_id)}
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <button className="flex-shrink-0">
                          {expandedOperator === op.operator_id ? (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                          )}
                        </button>

                        <div className="flex-shrink-0">
                          {getRankBadge(op.rank)}
                        </div>

                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: op.operator_color || '#64748b' }}
                        >
                          {op.operator_name.charAt(0)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900">{op.operator_name}</span>
                            {!op.active && (
                              <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded">Inactive</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{op.total_completed_tasks} tasks</span>
                            <span className="font-medium text-blue-600">{op.total_score} points</span>
                            <span>{op.avg_score_per_task} avg</span>
                            {op.active_days > 0 && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {op.active_days} days active
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0 w-48">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${(op.total_score / getMaxScore()) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {expandedOperator === op.operator_id && (
                      <div className="px-4 pb-4 pt-0 border-t border-slate-200 bg-slate-50">
                        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <div className="text-xs text-red-600 font-medium mb-1">High Intensity</div>
                            <div className="text-lg font-bold text-red-700">{op.high_intensity_count}</div>
                            <div className="text-xs text-red-600">{op.high_intensity_count * 3} points</div>
                          </div>
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-xs text-yellow-600 font-medium mb-1">Medium Intensity</div>
                            <div className="text-lg font-bold text-yellow-700">{op.medium_intensity_count}</div>
                            <div className="text-xs text-yellow-600">{op.medium_intensity_count * 2} points</div>
                          </div>
                          <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <div className="text-xs text-green-600 font-medium mb-1">Low Intensity</div>
                            <div className="text-lg font-bold text-green-700">{op.low_intensity_count}</div>
                            <div className="text-xs text-green-600">{op.low_intensity_count * 1} points</div>
                          </div>
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-xs text-blue-600 font-medium mb-1">Total Score</div>
                            <div className="text-lg font-bold text-blue-700">{op.total_score}</div>
                            <div className="text-xs text-blue-600">{op.avg_score_per_task} avg/task</div>
                          </div>
                        </div>

                        {op.category_breakdown.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <Target className="w-4 h-4" />
                              Task Categories
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {op.category_breakdown.map((cat) => (
                                <div
                                  key={cat.category}
                                  className="p-3 bg-white border border-slate-200 rounded-lg"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`font-semibold ${kpiService.getCategoryTextColor(cat.category)}`}>
                                      {cat.category}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700">{cat.task_count} tasks</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Score:</span>
                                    <span className="font-bold text-blue-600">{cat.category_score}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Avg Intensity:</span>
                                    <span className="font-medium text-slate-700">{cat.avg_intensity_score}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">About KPI Scoring</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>High intensity tasks: 3 points each</li>
                <li>Medium intensity tasks: 2 points each</li>
                <li>Low intensity tasks: 1 point each</li>
                <li>Rankings based on total points from completed deliveries</li>
                <li>Task categories extracted from shipment title prefixes (INCOMING, OUTGOING, OPI, etc.)</li>
              </ul>
            </div>
          </div>
        )}

        {activeView === 'categories' && (
          <div className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Task Category Overview</h3>
              <p className="text-sm text-slate-600">
                Distribution of tasks across different categories
              </p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {categorySearchQuery && (
                <button
                  onClick={() => setCategorySearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {filteredCategories.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">
                  {categorySearchQuery ? 'No categories match your search' : 'No category data available'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCategories.map((cat) => (
                  <div
                    key={cat.task_category}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${kpiService.getCategoryColor(cat.task_category)}`} />
                        <h4 className="text-lg font-semibold text-slate-900">{cat.task_category}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{cat.total_score}</div>
                        <div className="text-xs text-slate-500">total points</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Total Tasks</div>
                        <div className="text-lg font-semibold text-slate-900">{cat.total_tasks}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Unique Operators</div>
                        <div className="text-lg font-semibold text-slate-900">{cat.unique_operators}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Avg Tasks/Operator</div>
                        <div className="text-lg font-semibold text-slate-900">{cat.avg_tasks_per_operator}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Avg Score/Task</div>
                        <div className="text-lg font-semibold text-slate-900">{cat.avg_score_per_task}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'balance' && (
          <div className="space-y-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Workload Balance Analysis</h3>
              <p className="text-sm text-slate-600">
                Operators missing coverage in specific task categories
              </p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search operators..."
                value={balanceSearchQuery}
                onChange={(e) => setBalanceSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {balanceSearchQuery && (
                <button
                  onClick={() => setBalanceSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {filteredMissingCategories.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">
                  {balanceSearchQuery ? 'No operators match your search' : 'No workload balance data available'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMissingCategories.map((mc) => (
                  <div
                    key={mc.operator_id}
                    className="p-4 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">{mc.operator_name}</h4>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded">
                        {mc.missing_count} missing
                      </span>
                    </div>

                    <div className="mb-2">
                      <div className="text-xs font-medium text-slate-600 mb-1">Completed Categories:</div>
                      <div className="flex flex-wrap gap-2">
                        {mc.completed_categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Missing Categories:</div>
                      <div className="flex flex-wrap gap-2">
                        {mc.missing_categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'manage-categories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Category Management</h3>
                <p className="text-sm text-slate-600">
                  Add, edit, or remove task categories for workload tracking
                </p>
              </div>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>

            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 border border-slate-200 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{cat.name}</div>
                      <div className="text-sm text-slate-600">
                        {cat.usage_count} shipments • Sort: {cat.sort_order}
                      </div>
                    </div>
                    {cat.active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateCategory(cat.id, { active: !cat.active })}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded"
                      title={cat.active ? 'Deactivate' : 'Activate'}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      disabled={!cat.can_delete}
                      className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={cat.can_delete ? 'Delete' : 'Cannot delete category with shipments'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Category</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., WAREHOUSE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setNewCategoryColor('#6B7280');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
