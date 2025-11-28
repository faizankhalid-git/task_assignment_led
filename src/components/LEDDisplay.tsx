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
    setupRealtimeSubscription();

    refreshIntervalRef.current = setInterval(() => {
      loadShipments();
    }, REFRESH_MINUTES * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('shipments-led-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        () => {
          loadShipments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

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
          <div className="grid grid-cols-2 gap-6">
            {visibleShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-slate-800 rounded-lg p-6 border-l-8 hover:shadow-2xl transition-all h-full flex flex-col"
                style={{ borderLeftColor: getStatusColor(shipment.status).replace('bg-', '#') }}
              >
                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="w-8 h-8 text-slate-400" />
                      <h3 className="text-4xl font-bold text-white">{shipment.title}</h3>
                    </div>
                    <span className={`px-4 py-2 ${getStatusColor(shipment.status)} text-white rounded-lg font-bold text-sm`}>
                      {getStatusText(shipment.status)}
                    </span>
                  </div>

                  {shipment.sscc_numbers && (
                    <p className="text-slate-300 text-base font-medium line-clamp-2">
                      {shipment.sscc_numbers}
                    </p>
                  )}

                  <div className="flex-1 flex flex-col justify-center gap-4 py-2">
                    <div className="flex items-center gap-3">
                      <Clock className="w-6 h-6 text-slate-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-slate-400 font-medium">Arrival Time</div>
                        <div className="text-2xl font-bold text-white">{formatDate(shipment.start)}</div>
                        {isArrivingSoon(shipment.start) && (
                          <div className="flex items-center gap-1 mt-1 text-amber-300">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-bold text-base">Arriving Soon</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Truck className="w-6 h-6 text-slate-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-slate-400 font-medium">Vehicle</div>
                        <div className="text-2xl font-bold text-white">{shipment.car_reg_no || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {shipment.assigned_operators.length > 0 && (
                    <div className="flex items-start gap-3 pt-4 border-t border-slate-700">
                      <Users className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm text-slate-400 font-medium mb-2">Assigned Operators</div>
                        <div className="flex flex-wrap gap-2">
                          {shipment.assigned_operators.slice(0, 4).map((op, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-slate-700 text-slate-100 rounded-lg text-sm font-semibold"
                            >
                              {op}
                            </span>
                          ))}
                          {shipment.assigned_operators.length > 4 && (
                            <span className="px-3 py-1.5 bg-slate-600 text-slate-300 rounded-lg text-sm font-semibold">
                              +{shipment.assigned_operators.length - 4} more
                            </span>
                          )}
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
