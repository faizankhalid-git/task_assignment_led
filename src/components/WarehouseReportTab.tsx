import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, AlertTriangle, Download, RefreshCw, Search } from 'lucide-react';

type PackageReport = {
  package_id: string;
  description: string;
  location: string;
  arrival: string;
  expires: string;
  days_left: number;
  total_days: number;
  status: 'Active' | 'Overdue';
  notes: string;
};

export function WarehouseReportTab() {
  const [packages, setPackages] = useState<PackageReport[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<PackageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue'>('all');

  useEffect(() => {
    loadWarehouseReport();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, packages]);

  const loadWarehouseReport = async () => {
    try {
      setLoading(true);

      const { data: packagesData, error } = await supabase
        .from('packages')
        .select(`
          id,
          sscc_number,
          storage_location,
          status,
          created_at,
          shipment_id,
          shipments!inner(
            id,
            title,
            shipment_type,
            start,
            completed_at,
            status,
            notes
          )
        `)
        .eq('status', 'stored')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const report: PackageReport[] = (packagesData || []).map((pkg: any) => {
        const arrivalDate = new Date(pkg.shipments.start || pkg.created_at);
        const expiryDate = new Date(arrivalDate);
        expiryDate.setDate(expiryDate.getDate() + 42);

        const totalDays = Math.floor((now.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const status: 'Active' | 'Overdue' = daysLeft < 0 ? 'Overdue' : 'Active';

        return {
          package_id: pkg.sscc_number,
          description: pkg.shipments.title || '',
          location: pkg.storage_location || '',
          arrival: arrivalDate.toISOString().split('T')[0],
          expires: expiryDate.toISOString().split('T')[0],
          days_left: daysLeft,
          total_days: totalDays,
          status,
          notes: pkg.shipments.notes || '',
        };
      });

      report.sort((a, b) => a.days_left - b.days_left);

      setPackages(report);
    } catch (err) {
      console.error('Failed to load warehouse report:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = packages;

    if (statusFilter === 'active') {
      filtered = filtered.filter(p => p.status === 'Active');
    } else if (statusFilter === 'overdue') {
      filtered = filtered.filter(p => p.status === 'Overdue');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.package_id.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.location.toLowerCase().includes(query)
      );
    }

    setFilteredPackages(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Package ID', 'Description', 'Location', 'Arrival', 'Expires', 'Days Left', 'Total Days', 'Status', 'Notes'];
    const rows = filteredPackages.map(pkg => [
      pkg.package_id,
      pkg.description,
      pkg.location,
      pkg.arrival,
      pkg.expires,
      pkg.days_left.toString(),
      pkg.total_days.toString(),
      pkg.status,
      pkg.notes
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeCount = packages.filter(p => p.status === 'Active').length;
  const overdueCount = packages.filter(p => p.status === 'Overdue').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Warehouse Report</h2>
          <p className="text-sm text-slate-600 mt-1">Track packages currently in warehouse (6-week storage limit)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadWarehouseReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">Total in Warehouse</h3>
          </div>
          <p className="text-3xl font-bold text-blue-700">{packages.length}</p>
          <p className="text-xs text-blue-600 mt-1">Currently stored</p>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-sm font-medium text-green-900">Active</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">{activeCount}</p>
          <p className="text-xs text-green-600 mt-1">Within 6-week limit</p>
        </div>

        <div className="bg-red-50 rounded-lg p-6 border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-sm font-medium text-red-900">Overdue</h3>
          </div>
          <p className="text-3xl font-bold text-red-700">{overdueCount}</p>
          <p className="text-xs text-red-600 mt-1">Beyond 6-week limit</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Package ID, Description, or Location..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({packages.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'overdue'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Overdue ({overdueCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Package ID</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Description</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Location</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Arrival</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Expires</th>
                <th className="text-right py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Days Left</th>
                <th className="text-right py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Total Days</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700 border-r border-slate-300">Status</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    {searchQuery || statusFilter !== 'all' ? 'No packages match your filters' : 'No packages in warehouse'}
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg, index) => (
                  <tr
                    key={pkg.package_id + index}
                    className={`border-b border-slate-200 hover:bg-slate-50 ${
                      pkg.status === 'Overdue' ? 'bg-red-50' : index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <td className="py-3 px-4 text-sm font-mono text-slate-900 border-r border-slate-200">
                      {pkg.package_id}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 border-r border-slate-200">
                      {pkg.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 border-r border-slate-200">
                      {pkg.location || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 border-r border-slate-200">
                      {pkg.arrival}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 border-r border-slate-200">
                      {pkg.expires}
                    </td>
                    <td className={`py-3 px-4 text-sm text-right font-semibold border-r border-slate-200 ${
                      pkg.days_left < 0 ? 'text-red-700' : pkg.days_left <= 7 ? 'text-orange-700' : 'text-green-700'
                    }`}>
                      {pkg.days_left}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-700 border-r border-slate-200">
                      {pkg.total_days}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-200">
                      <span className={`text-sm font-semibold px-3 py-1 rounded ${
                        pkg.status === 'Overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">
                      {pkg.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredPackages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div>
                Showing <strong>{filteredPackages.length}</strong> of <strong>{packages.length}</strong> packages
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                  <span>Overdue</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
