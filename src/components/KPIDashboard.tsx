import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { kpiService, OperatorPerformance, CategoryStatistics, OperatorMissingCategories } from '../services/kpiService';
import { TrendingUp, Award, BarChart3, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Calendar, Target, ShieldAlert } from 'lucide-react';

type TimeRange = 'today' | 'week' | 'month' | 'all';

export function KPIDashboard() {
  const [allPerformance, setAllPerformance] = useState<OperatorPerformance[]>([]);
  const [performance, setPerformance] = useState<OperatorPerformance[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStatistics[]>([]);
  const [missingCategories, setMissingCategories] = useState<OperatorMissingCategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'rankings' | 'categories' | 'balance'>('rankings');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    filterDataByTimeRange();
  }, [timeRange, allPerformance]);

  const checkAccess = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('permissions')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.permissions?.includes('kpi')) {
        setHasAccess(true);
        await loadData();
      } else {
        setHasAccess(false);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
      setLoading(false);
    }
  };

  const getDateRangeForFilter = (range: TimeRange) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return { start: weekStart, end: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(today.getDate() - 30);
        return { start: monthStart, end: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
      case 'all':
      default:
        return null;
    }
  };

  const filterDataByTimeRange = () => {
    if (timeRange === 'all' || allPerformance.length === 0) {
      setPerformance(allPerformance);
      return;
    }

    const dateRange = getDateRangeForFilter(timeRange);
    if (!dateRange) {
      setPerformance(allPerformance);
      return;
    }

    const filtered = allPerformance.map(operator => {
      const filteredCategories = operator.category_breakdown.filter(cat => {
        const lastCompletion = new Date(cat.last_completion);
        return lastCompletion >= dateRange.start && lastCompletion <= dateRange.end;
      });

      const totalScore = filteredCategories.reduce((sum, cat) => sum + cat.category_score, 0);
      const totalTasks = filteredCategories.reduce((sum, cat) => sum + cat.task_count, 0);

      return {
        ...operator,
        category_breakdown: filteredCategories,
        total_score: totalScore,
        total_completed_tasks: totalTasks,
        avg_score_per_task: totalTasks > 0 ? totalScore / totalTasks : 0
      };
    }).filter(op => op.total_completed_tasks > 0);

    const sorted = filtered.sort((a, b) => b.total_score - a.total_score);
    const ranked = sorted.map((op, index) => ({ ...op, rank: index + 1 }));

    setPerformance(ranked);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [perfData, catData, missingData] = await Promise.all([
        kpiService.getAllOperatorPerformance(),
        kpiService.getCategoryStatistics(),
        kpiService.getOperatorsMissingCategories()
      ]);

      setAllPerformance(perfData);
      setPerformance(perfData);
      setCategoryStats(catData);
      setMissingCategories(missingData);
    } catch (error) {
      console.error('Error loading KPI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await kpiService.refreshPerformanceMetrics();
      await loadData();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    }
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
        </div>

        {activeView === 'rankings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-600 font-medium mb-1">Total Operators</div>
                <div className="text-2xl font-bold text-blue-900">{performance.length}</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-600 font-medium mb-1">Total Tasks Completed</div>
                <div className="text-2xl font-bold text-green-900">
                  {performance.reduce((sum, p) => sum + p.total_completed_tasks, 0)}
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm text-purple-600 font-medium mb-1">Total Points</div>
                <div className="text-2xl font-bold text-purple-900">
                  {performance.reduce((sum, p) => sum + p.total_score, 0)}
                </div>
              </div>
            </div>

            {performance.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No performance data available</p>
                <p className="text-sm text-slate-500 mt-1">Complete some deliveries to see operator rankings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {performance.map((op) => (
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

            {categoryStats.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No category data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryStats.map((cat) => (
                  <div
                    key={cat.task_category}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-3 h-3 rounded-full ${kpiService.getCategoryColor(cat.task_category)}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-semibold ${kpiService.getCategoryTextColor(cat.task_category)}`}>
                            {cat.task_category}
                          </h4>
                          <span className="text-sm font-medium text-slate-700">{cat.total_tasks} tasks</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Total Score:</span>
                            <span className="ml-2 font-bold text-blue-600">{cat.total_score}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Operators:</span>
                            <span className="ml-2 font-medium text-slate-700">{cat.unique_operators}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Avg Tasks/Op:</span>
                            <span className="ml-2 font-medium text-slate-700">{cat.avg_tasks_per_operator}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Avg Intensity:</span>
                            <span className="ml-2 font-medium text-slate-700">{cat.avg_score_per_task}</span>
                          </div>
                        </div>
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
                Operators who haven't performed certain task categories
              </p>
            </div>

            {missingCategories.length === 0 ? (
              <div className="text-center py-12 bg-green-50 border border-green-200 rounded-lg">
                <Award className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-green-700 font-medium">Perfect Balance!</p>
                <p className="text-sm text-green-600 mt-1">All active operators have experience in all task categories</p>
              </div>
            ) : (
              <div className="space-y-3">
                {missingCategories.map((op) => (
                  <div
                    key={op.operator_id}
                    className="p-4 border border-orange-200 bg-orange-50 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-900">{op.operator_name}</span>
                          <span className="text-sm text-orange-700 font-medium">
                            Missing {op.missing_count} {op.missing_count === 1 ? 'category' : 'categories'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-slate-600 font-medium">Not yet performed:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {op.missing_categories.map((cat) => (
                                <span
                                  key={cat}
                                  className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-300 rounded"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-slate-600 font-medium">Completed categories:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {op.completed_categories.length > 0 ? (
                                op.completed_categories.map((cat) => (
                                  <span
                                    key={cat}
                                    className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded"
                                  >
                                    {cat}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500 italic">None</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">About KPI Scoring</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>High intensity tasks: 3 points each</li>
            <li>Medium intensity tasks: 2 points each</li>
            <li>Low intensity tasks: 1 point each</li>
            <li>Rankings based on total points from completed deliveries</li>
            <li>Task categories extracted from shipment title prefixes (INCOMING, OUTGOING, OPI, etc.)</li>
            <li>Performance metrics update automatically when deliveries are completed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
