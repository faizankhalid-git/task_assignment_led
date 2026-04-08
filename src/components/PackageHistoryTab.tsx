import { useState, useEffect } from 'react';
import { Search, Package, Calendar, MapPin, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PackageHistory = {
  id: string;
  sscc_number: string;
  storage_location: string;
  status: 'stored' | 'pending';
  created_at: string;
  updated_at: string;
  has_deviation: boolean;
  deviation_notes: string | null;
  incoming_shipment: {
    id: string;
    title: string;
    start: string;
    completed_at: string | null;
    created_by_name: string;
  } | null;
  outgoing_shipment: {
    id: string;
    title: string;
    start: string;
    completed_at: string | null;
    created_by_name: string;
  } | null;
};

export function PackageHistoryTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [packages, setPackages] = useState<PackageHistory[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<PackageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'stored' | 'delivered'>('all');

  useEffect(() => {
    loadPackageHistory();
  }, []);

  useEffect(() => {
    filterPackages();
  }, [searchQuery, packages, statusFilter]);

  const loadPackageHistory = async () => {
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
          updated_at,
          has_deviation,
          deviation_notes,
          shipment_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get all shipments
      const { data: shipmentsData } = await supabase
        .from('shipments')
        .select(`
          id,
          title,
          start,
          completed_at,
          shipment_type,
          sscc_numbers,
          created_by
        `);

      // Get user profiles for names
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('user_id, full_name');

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      // Build history
      const history: PackageHistory[] = [];

      for (const pkg of packagesData || []) {
        const incomingShipment = shipmentsData?.find(
          s => s.shipment_type === 'incoming' &&
          (s.id === pkg.shipment_id || s.sscc_numbers?.includes(pkg.sscc_number))
        );

        const outgoingShipment = shipmentsData?.find(
          s => s.shipment_type === 'outgoing' &&
          s.sscc_numbers?.includes(pkg.sscc_number)
        );

        history.push({
          id: pkg.id,
          sscc_number: pkg.sscc_number,
          storage_location: pkg.storage_location || '-',
          status: pkg.status,
          created_at: pkg.created_at,
          updated_at: pkg.updated_at,
          has_deviation: pkg.has_deviation || false,
          deviation_notes: pkg.deviation_notes,
          incoming_shipment: incomingShipment ? {
            id: incomingShipment.id,
            title: incomingShipment.title || 'Incoming',
            start: incomingShipment.start,
            completed_at: incomingShipment.completed_at,
            created_by_name: profileMap.get(incomingShipment.created_by) || 'Unknown',
          } : null,
          outgoing_shipment: outgoingShipment ? {
            id: outgoingShipment.id,
            title: outgoingShipment.title || 'Outgoing',
            start: outgoingShipment.start,
            completed_at: outgoingShipment.completed_at,
            created_by_name: profileMap.get(outgoingShipment.created_by) || 'Unknown',
          } : null,
        });
      }

      setPackages(history);
    } catch (err) {
      console.error('Error loading package history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterPackages = () => {
    let filtered = packages;

    // Status filter
    if (statusFilter === 'stored') {
      filtered = filtered.filter(p => p.status === 'stored');
    } else if (statusFilter === 'delivered') {
      filtered = filtered.filter(p => p.status === 'pending' || p.outgoing_shipment);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.sscc_number.toLowerCase().includes(query) ||
        p.storage_location.toLowerCase().includes(query)
      );
    }

    setFilteredPackages(filtered);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Same day';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-8 h-8 text-blue-600" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">Package History & Tracking</h2>
            <p className="text-sm text-slate-600 mt-1">Complete lifecycle of all packages</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SSCC number or location..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('stored')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'stored'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              In Warehouse
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'delivered'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Delivered
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-slate-600 text-sm font-medium mb-1">Total Packages</div>
            <div className="text-2xl font-bold text-slate-900">{packages.length}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-600 text-sm font-medium mb-1">In Warehouse</div>
            <div className="text-2xl font-bold text-green-900">
              {packages.filter(p => p.status === 'stored').length}
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-purple-600 text-sm font-medium mb-1">Delivered</div>
            <div className="text-2xl font-bold text-purple-900">
              {packages.filter(p => p.outgoing_shipment).length}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-orange-600 text-sm font-medium mb-1">With Deviations</div>
            <div className="text-2xl font-bold text-orange-900">
              {packages.filter(p => p.has_deviation).length}
            </div>
          </div>
        </div>

        {/* Package List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading package history...</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No packages found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`border-2 rounded-lg p-4 transition-colors ${
                  pkg.has_deviation
                    ? 'border-orange-300 bg-orange-50'
                    : pkg.status === 'stored'
                    ? 'border-green-300 bg-green-50'
                    : 'border-purple-300 bg-purple-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      pkg.has_deviation
                        ? 'bg-orange-200'
                        : pkg.status === 'stored'
                        ? 'bg-green-200'
                        : 'bg-purple-200'
                    }`}>
                      <Package className={`w-5 h-5 ${
                        pkg.has_deviation
                          ? 'text-orange-700'
                          : pkg.status === 'stored'
                          ? 'text-green-700'
                          : 'text-purple-700'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{pkg.sscc_number}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">{pkg.storage_location}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    pkg.has_deviation
                      ? 'bg-orange-200 text-orange-800'
                      : pkg.status === 'stored'
                      ? 'bg-green-200 text-green-800'
                      : 'bg-purple-200 text-purple-800'
                  }`}>
                    {pkg.has_deviation ? 'Has Deviation' : pkg.status === 'stored' ? 'In Warehouse' : 'Delivered'}
                  </div>
                </div>

                {/* Timeline */}
                <div className="grid grid-cols-2 gap-4 pl-11">
                  {/* Incoming */}
                  {pkg.incoming_shipment ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-slate-900">Arrival</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(pkg.incoming_shipment.start)}
                        </div>
                        <div className="text-slate-500">{pkg.incoming_shipment.title}</div>
                        <div className="text-slate-500">By: {pkg.incoming_shipment.created_by_name}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-sm text-slate-500">No arrival data</div>
                    </div>
                  )}

                  {/* Outgoing */}
                  {pkg.outgoing_shipment ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-slate-900">Delivery</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(pkg.outgoing_shipment.start)}
                        </div>
                        <div className="text-slate-500">{pkg.outgoing_shipment.title}</div>
                        <div className="text-slate-500">By: {pkg.outgoing_shipment.created_by_name}</div>
                        {pkg.incoming_shipment && (
                          <div className="flex items-center gap-1 text-orange-600 font-medium">
                            <Clock className="w-3 h-3" />
                            Storage: {calculateDuration(pkg.incoming_shipment.start, pkg.outgoing_shipment.start)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : pkg.status === 'stored' ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        Currently in warehouse
                        {pkg.incoming_shipment && (
                          <span className="text-green-600 font-medium">
                            ({calculateDuration(pkg.incoming_shipment.start, null)})
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-sm text-slate-500">No delivery data</div>
                    </div>
                  )}
                </div>

                {/* Deviation Notes */}
                {pkg.has_deviation && pkg.deviation_notes && (
                  <div className="mt-3 pl-11 bg-orange-100 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-orange-900 mb-1">Deviation Notes:</div>
                        <div className="text-xs text-orange-800">{pkg.deviation_notes}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
