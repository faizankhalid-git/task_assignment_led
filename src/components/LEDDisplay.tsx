import { useState, useEffect, useRef } from 'react';
import { supabase, Shipment } from '../lib/supabase';
import { Package, Clock, Truck, Users, AlertCircle, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 4;
const ROTATE_SECONDS = 8;
const REFRESH_MINUTES = 2;

export function LEDDisplay() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadShipments();

    refreshIntervalRef.current = setInterval(() => {
      loadShipments();
    }, REFRESH_MINUTES * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const totalPages = Math.ceil(shipments.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, ROTATE_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [shipments]);

  const getTodayDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      start: today.toISOString(),
      end: tomorrow.toISOString()
    };
  };

  const loadShipments = async () => {
    try {
      const dateRange = getTodayDateRange();

      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('archived', false)
        .neq('status', 'completed')
        .gte('start', dateRange.start)
        .lt('start', dateRange.end)
        .order('status', { ascending: true })
        .order('start', { ascending: true });

      if (error) throw error;

      if (data) {
        const sorted = data.sort((a, b) => {
          const statusOrder = { pending: 0, in_progress: 1, completed: 2 };
          return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
        });
        setShipments(sorted);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to load shipments:', err);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Time TBA';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isArrivingSoon = (dateString: string | null) => {
    if (!dateString) return false;
    const arrival = new Date(dateString);
    const now = new Date();
    const diffMinutes = (arrival.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes > 0 && diffMinutes < 60;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500';
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'PENDING';
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'COMPLETED';
      default: return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading shipments...</div>
      </div>
    );
  }

  const startIdx = currentPage * PAGE_SIZE;
  const visibleShipments = shipments.slice(startIdx, startIdx + PAGE_SIZE);
  const totalPages = Math.ceil(shipments.length / PAGE_SIZE);

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastUpdated.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Shipment Display</h1>
            <p className="text-slate-400 text-lg">
              Showing {visibleShipments.length} of {shipments.length} shipments
              {totalPages > 1 && ` (Page ${currentPage + 1}/${totalPages})`}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Last Updated</span>
            </div>
            <div className="text-xl font-mono text-slate-300">
              {formatLastUpdated()}
            </div>
          </div>
        </div>

        {visibleShipments.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-xl">No shipments to display</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 auto-rows-max">
            {visibleShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-slate-800 rounded-lg p-5 border-t-4 border-slate-700 hover:shadow-xl transition-all"
                style={{ borderTopColor: getStatusColor(shipment.status).replace('bg-', '#') }}
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="w-6 h-6 text-slate-400" />
                      <h3 className="text-3xl font-bold text-white">{shipment.title}</h3>
                    </div>
                    {shipment.sscc_numbers && (
                      <p className="text-slate-300 text-sm ml-9 line-clamp-1">
                        {shipment.sscc_numbers}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400 font-medium">Arrival Time</div>
                        <div className="text-xl font-bold text-white">{formatDate(shipment.start)}</div>
                        {isArrivingSoon(shipment.start) && (
                          <div className="flex items-center gap-1 mt-1 text-amber-300">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-bold text-sm">Arriving Soon</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400 font-medium">Vehicle</div>
                        <div className="text-xl font-bold text-white">{shipment.car_reg_no || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium mb-1">Status</div>
                      <span className={`inline-block px-4 py-2 ${getStatusColor(shipment.status)} text-white rounded-lg font-bold text-base`}>
                        {getStatusText(shipment.status)}
                      </span>
                    </div>
                  </div>

                  {shipment.assigned_operators.length > 0 && (
                    <div className="flex items-start gap-3 pt-3 border-t border-slate-700">
                      <Users className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-400 font-medium mb-1">Assigned Operators</div>
                        <div className="flex flex-wrap gap-1.5">
                          {shipment.assigned_operators.map((op, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold"
                            >
                              {op}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i === currentPage ? 'bg-blue-500 w-8' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
