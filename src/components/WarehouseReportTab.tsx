import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Clock, Calendar, TrendingUp, Download, Filter } from 'lucide-react';

type PackageReport = {
  sscc_number: string;
  shipment_title: string;
  shipment_type: 'incoming' | 'outgoing' | 'general';
  status: string;
  arrived_at: string;
  completed_at: string | null;
  duration_hours: number;
  duration_days: number;
  is_still_in_warehouse: boolean;
};

export function WarehouseReportTab() {
  const [packages, setPackages] = useState<PackageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'current' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'duration' | 'arrival'>('duration');
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | '6months' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadPackageReport();
  }, []);

  const loadPackageReport = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select(`
          sscc_number,
          status,
          created_at,
          shipments!inner(
            title,
            shipment_type,
            start,
            completed_at,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const report: PackageReport[] = (data || []).map((pkg: any) => {
        const arrivedAt = new Date(pkg.created_at);
        const shipmentCompleted = pkg.shipments?.completed_at ? new Date(pkg.shipments.completed_at) : null;
        const endTime = shipmentCompleted || new Date();
        const durationMs = endTime.getTime() - arrivedAt.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationDays = Math.floor(durationHours / 24);

        const isStillInWarehouse = pkg.shipments?.status !== 'completed' &&
                                   pkg.status !== 'completed' &&
                                   pkg.status !== 'cancelled';

        return {
          sscc_number: pkg.sscc_number,
          shipment_title: pkg.shipments.title,
          shipment_type: pkg.shipments.shipment_type || 'general',
          status: pkg.status,
          arrived_at: pkg.created_at,
          completed_at: pkg.shipments?.completed_at || null,
          duration_hours: durationHours,
          duration_days: durationDays,
          is_still_in_warehouse: isStillInWarehouse
        };
      });

      setPackages(report);
    } catch (err) {
      console.error('Failed to load package report:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPackages = () => {
    let filtered = packages;

    if (filterStatus === 'current') {
      filtered = filtered.filter(pkg => pkg.is_still_in_warehouse);
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(pkg => !pkg.is_still_in_warehouse);
    }

    const now = new Date();
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(pkg => new Date(pkg.arrived_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(pkg => new Date(pkg.arrived_at) >= monthAgo);
    } else if (dateFilter === '6months') {
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(pkg => new Date(pkg.arrived_at) >= sixMonthsAgo);
    } else if (dateFilter === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(pkg => {
        const date = new Date(pkg.arrived_at);
        return date >= start && date <= end;
      });
    }

    if (sortBy === 'duration') {
      filtered.sort((a, b) => b.duration_hours - a.duration_hours);
    } else {
      filtered.sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime());
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filteredData = getFilteredPackages();
    const headers = ['SSCC Number', 'Shipment', 'Type', 'Status', 'Arrived', 'Completed', 'Days in Warehouse', 'Hours in Warehouse'];
    const rows = filteredData.map(pkg => [
      pkg.sscc_number,
      pkg.shipment_title,
      pkg.shipment_type,
      pkg.status,
      new Date(pkg.arrived_at).toLocaleString(),
      pkg.completed_at ? new Date(pkg.completed_at).toLocaleString() : 'Still in warehouse',
      pkg.duration_days.toString(),
      pkg.duration_hours.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredPackages = getFilteredPackages();
  const currentPackages = packages.filter(p => p.is_still_in_warehouse);
  const avgDuration = currentPackages.length > 0
    ? Math.round(currentPackages.reduce((sum, p) => sum + p.duration_hours, 0) / currentPackages.length)
    : 0;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incoming': return 'bg-blue-100 text-blue-700';
      case 'outgoing': return 'bg-green-100 text-green-700';
      case 'general': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getDurationColor = (hours: number) => {
    if (hours < 24) return 'text-green-600';
    if (hours < 72) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading warehouse report...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Warehouse Report</h2>
          <p className="text-sm text-slate-600 mt-1">Track package warehouse duration and current inventory</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">Current Packages</h3>
          </div>
          <p className="text-3xl font-bold text-blue-700">{currentPackages.length}</p>
          <p className="text-xs text-blue-600 mt-1">Still in warehouse</p>
        </div>

        <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-amber-600" />
            <h3 className="text-sm font-medium text-amber-900">Avg Duration</h3>
          </div>
          <p className="text-3xl font-bold text-amber-700">{avgDuration}h</p>
          <p className="text-xs text-amber-600 mt-1">{Math.floor(avgDuration / 24)} days average</p>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h3 className="text-sm font-medium text-green-900">Total Processed</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">{packages.length}</p>
          <p className="text-xs text-green-600 mt-1">All time packages</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="space-y-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-600" />
              <label className="text-sm font-medium text-slate-700">Status:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('current')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'current'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Current ({currentPackages.length})
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium text-slate-700">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'duration' | 'arrival')}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="duration">Duration (Longest first)</option>
                <option value="arrival">Arrival (Newest first)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600" />
              <label className="text-sm font-medium text-slate-700">Date Range:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateFilter === 'all'
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateFilter === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Last Week
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateFilter === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Last Month
                </button>
                <button
                  onClick={() => setDateFilter('6months')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateFilter === '6months'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Last 6 Months
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateFilter === 'custom'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">SSCC Number</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Shipment</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Arrived</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No packages found
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg) => (
                  <tr key={pkg.sscc_number} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-mono text-slate-900">{pkg.sscc_number}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">{pkg.shipment_title}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getTypeColor(pkg.shipment_type)}`}>
                        {pkg.shipment_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        pkg.status === 'completed' ? 'bg-green-100 text-green-700' :
                        pkg.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {new Date(pkg.arrived_at).toLocaleDateString()} {new Date(pkg.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`text-sm font-semibold ${getDurationColor(pkg.duration_hours)}`}>
                        {pkg.duration_days}d {pkg.duration_hours % 24}h
                      </div>
                      <div className="text-xs text-slate-500">{pkg.duration_hours} hours total</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {pkg.completed_at ? (
                        <>
                          {new Date(pkg.completed_at).toLocaleDateString()}
                        </>
                      ) : (
                        <span className="text-amber-600 font-medium">In warehouse</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
