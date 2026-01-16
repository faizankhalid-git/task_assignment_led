import { useState, useEffect, useRef } from 'react';
import { supabase, Shipment, Operator, Announcement } from '../lib/supabase';
import { Package, Clock, Truck, Users, AlertCircle, RefreshCw, Bell, X } from 'lucide-react';

const PAGE_SIZE = 4;
const REFRESH_SECONDS = 5;

export function LEDDisplay() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rotateSeconds, setRotateSeconds] = useState(3);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const rotationIntervalRef = useRef<NodeJS.Timeout>();
  const previousShipmentCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const defaultSound = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0PUqzm77BdGQs9lt300YIxBSV+zPLYijgIFmS56umhUg4KR6Xh8K9gHQU2jNPy1YU4BhxtwO7lmVENEFCr5O+wXBkLPJbd8tN+MQUmfsvy2Io3CBZkuunooVIOCkek4PCwYRwFNo3T8tWFOAYbbc/u5ZlRDQ9Rq+TwsFwYCz2W3fLTfjEFJn/L8tiKNwgWZLrp6KFSDAZGpeDwsGEcBTaN0/LVhTgGG23P7uWZUQ0PUavk8LBcGAs9lt3y034xBSZ/y/LYijcIFmS66eiVUgwGRqXg8K9hHAU2jdPy1YU4BhttwO7lmVENDlGr5PCwXBgLPZbd8tN+MQUmf8vy2Io3CBdkuunooVILBkak4PCwYR0GNo3T8tWFOAYbbcDu5ZlRDQ5Rq+TwsFwYCz2X3fLTfjEFJn/L8tiKNwgXZLrp6KFSCwdGpODwsGEdBjaN0/LVhTgGG23A7uWZUQ0OUavk8LBcGAs9l93y034xBSZ/y/LYijcIF2S66eiVUgsHRqTg8LBhHQU1jdPy1YU4BhttMO7mmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunqoVILB0ak4PCwYR0FNY3T8tWFOAYbbTDu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6qFSCwdGpODwsGEdBTWN0/LVhTgGG20w7uWYUQ0OUazk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eqhUgsHRqTg8LBhHQU1jdPy1IY4Bhxtwe7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbcHu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG3B7uWYUQ0OUazk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4Bhxtwe7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbcHu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG3B7uWYUQ0OUavk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4BhxtM+7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbTPu5ZhRDQ5Rq+TvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG0z7uWYUQ0OUavk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4BhxtM+7lmFENDlGr5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbTPu5ZhRDQ5Rq+TvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG0z7uWYUQ0OUavk77BdGAs=';

    const loadSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['notification_sound_url', 'led_rotation_seconds']);

      if (data) {
        const settings = Object.fromEntries(data.map(s => [s.key, s.value]));

        const soundUrl = settings.notification_sound_url || defaultSound;
        audioRef.current = new Audio(soundUrl);

        const seconds = parseInt(settings.led_rotation_seconds || '3', 10);
        setRotateSeconds(seconds);
      } else {
        audioRef.current = new Audio(defaultSound);
      }
    };

    loadSettings();
    loadShipments();
    loadOperators();
    loadAnnouncements();
    setupRealtimeSubscription();
    setupSettingsSubscription();

    refreshIntervalRef.current = setInterval(() => {
      loadShipments();
      loadAnnouncements();
    }, REFRESH_SECONDS * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
      }
    };
  }, []);

  const setupRealtimeSubscription = () => {
    const shipmentsChannel = supabase
      .channel('shipments-led-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        () => {
          loadShipments();
        }
      )
      .subscribe();

    const operatorsChannel = supabase
      .channel('operators-led-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operators' },
        () => {
          loadOperators();
        }
      )
      .subscribe();

    const announcementsChannel = supabase
      .channel('announcements-led-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shipmentsChannel);
      supabase.removeChannel(operatorsChannel);
      supabase.removeChannel(announcementsChannel);
    };
  };

  const setupSettingsSubscription = () => {
    const defaultSound = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0PUqzm77BdGQs9lt300YIxBSV+zPLYijgIFmS56umhUg4KR6Xh8K9gHQU2jNPy1YU4BhxtwO7lmVENEFCr5O+wXBkLPJbd8tN+MQUmfsvy2Io3CBZkuunooVIOCkek4PCwYRwFNo3T8tWFOAYbbc/u5ZlRDQ9Rq+TwsFwYCz2W3fLTfjEFJn/L8tiKNwgWZLrp6KFSDAZGpeDwsGEcBTaN0/LVhTgGG23P7uWZUQ0PUavk8LBcGAs9lt3y034xBSZ/y/LYijcIFmS66eiVUgwGRqXg8K9hHAU2jdPy1YU4BhttwO7lmVENDlGr5PCwXBgLPZbd8tN+MQUmf8vy2Io3CBdkuunooVILBkak4PCwYR0GNo3T8tWFOAYbbcDu5ZlRDQ5Rq+TwsFwYCz2X3fLTfjEFJn/L8tiKNwgXZLrp6KFSCwdGpODwsGEdBjaN0/LVhTgGG23A7uWZUQ0OUavk8LBcGAs9l93y034xBSZ/y/LYijcIF2S66eiVUgsHRqTg8LBhHQU1jdPy1YU4BhttMO7mmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunqoVILB0ak4PCwYR0FNY3T8tWFOAYbbTDu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6qFSCwdGpODwsGEdBTWN0/LVhTgGG20w7uWYUQ0OUazk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eqhUgsHRqTg8LBhHQU1jdPy1IY4Bhxtwe7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbcHu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG3B7uWYUQ0OUazk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4Bhxtwe7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbcHu5ZhRDQ5RrOTvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG3B7uWYUQ0OUavk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4BhxtM+7lmFENDlGs5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbTPu5ZhRDQ5Rq+TvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG0z7uWYUQ0OUavk77BdGQs9l93y034xBSZ/y/LXijcIF2S66eihUgsHRqTg8LBhHQU1jdPy1IY4BhxtM+7lmFENDlGr5O+wXRkLPZfd8tN+MQUmf8vy14o3CBdkuunooVILB0ak4PCwYR0FNY3T8tSGOAYcbTPu5ZhRDQ5Rq+TvsF0ZCz2X3fLTfjEFJn/L8teKNwgXZLrp6KFSCwdGpODwsGEdBTWN0/LUhjgGHG0z7uWYUQ0OUavk77BdGAs=';

    const handleSettingsChange = (payload: any) => {
      const { key, value } = payload.new;

      if (key === 'notification_sound_url') {
        const soundUrl = value || defaultSound;
        audioRef.current = new Audio(soundUrl);
        console.log('Notification sound updated:', soundUrl.substring(0, 50) + '...');
      } else if (key === 'led_rotation_seconds') {
        const seconds = parseInt(value || '3', 10);
        setRotateSeconds(seconds);
        console.log('Rotation seconds updated to:', seconds);
      }
    };

    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_settings' },
        handleSettingsChange
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        handleSettingsChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    const totalPages = Math.ceil(shipments.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current);
    }

    rotationIntervalRef.current = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, rotateSeconds * 1000);

    return () => {
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
      }
    };
  }, [shipments, rotateSeconds]);

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

  const loadOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      if (data) {
        console.log('Loaded operators:', data);
        setOperators(data);
      }
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .lte('start_time', now)
        .or(`end_time.is.null,end_time.gt.${now}`)
        .order('priority', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) throw error;
      if (data) {
        setAnnouncements(data);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    }
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

        if (previousShipmentCountRef.current > 0 && sorted.length > previousShipmentCountRef.current) {
          if (audioRef.current) {
            audioRef.current.play().catch(err => console.log('Audio play failed:', err));
          }
        }

        previousShipmentCountRef.current = sorted.length;
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

  const getOperatorColor = (operatorName: string): string => {
    const trimmedName = operatorName.trim();
    const operator = operators.find(op =>
      op.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (operator) {
      console.log(`Color for ${operatorName}: ${operator.color}`);
      return operator.color || '#10b981';
    }

    console.warn(`Operator not found: "${operatorName}". Available operators:`, operators.map(op => op.name));
    return '#10b981';
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
    <div className="min-h-screen bg-slate-900 text-white p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-700 pb-3 md:pb-4 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2">Shipment Display</h1>
            <p className="text-slate-400 text-sm sm:text-base md:text-lg">
              Showing {visibleShipments.length} of {shipments.length} shipments
              {totalPages > 1 && ` (Page ${currentPage + 1}/${totalPages})`}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="flex items-center justify-start sm:justify-end gap-2 mb-1 md:mb-2">
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
              <span className="text-xs sm:text-sm text-slate-400">Last Updated</span>
            </div>
            <div className="text-base sm:text-lg md:text-xl font-mono text-slate-300">
              {formatLastUpdated()}
            </div>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="mb-4 md:mb-6 space-y-3">
            {announcements.map((announcement) => {
              const priorityColors = {
                urgent: { bg: '#dc2626', text: '#ffffff', border: '#991b1b' },
                high: { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
                medium: { bg: '#2563eb', text: '#ffffff', border: '#1e40af' },
                low: { bg: '#475569', text: '#ffffff', border: '#334155' },
              };

              const colors = priorityColors[announcement.priority];
              const bgColor = announcement.background_color || colors.bg;
              const textColor = announcement.text_color || colors.text;

              return (
                <div
                  key={announcement.id}
                  className="rounded-lg shadow-lg border-2 overflow-hidden animate-pulse"
                  style={{
                    backgroundColor: bgColor,
                    borderColor: colors.border,
                    animation: announcement.priority === 'urgent' ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                  }}
                >
                  <div className="p-4 md:p-6">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Bell className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0 mt-1" style={{ color: textColor }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold" style={{ color: textColor }}>
                            {announcement.title}
                          </h2>
                          <span
                            className="px-2 py-1 rounded text-xs font-bold uppercase"
                            style={{ backgroundColor: colors.border, color: '#ffffff' }}
                          >
                            {announcement.priority}
                          </span>
                        </div>
                        <p className="text-base md:text-lg lg:text-xl" style={{ color: textColor }}>
                          {announcement.message}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleShipments.length === 0 ? (
          <div className="flex items-center justify-center py-16 md:py-32">
            <div className="text-center">
              <Package className="w-12 h-12 md:w-16 md:h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-base md:text-xl">No shipments to display</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 pb-20 md:pb-8">
            {visibleShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-slate-800 rounded-lg p-3 sm:p-4 md:p-5 border-l-4 sm:border-l-8 transition-all flex flex-col"
                style={{ borderLeftColor: getStatusColor(shipment.status).replace('bg-', '#') }}
              >
                <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 flex-shrink-0" />
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">{shipment.title}</h3>
                    </div>
                    <span className={`px-2 sm:px-3 py-1 ${getStatusColor(shipment.status)} text-white rounded-lg font-bold text-xs whitespace-nowrap flex-shrink-0`}>
                      {getStatusText(shipment.status)}
                    </span>
                  </div>

                  {shipment.sscc_numbers && (
                    <p className="text-slate-300 text-xs sm:text-sm font-medium line-clamp-1">
                      {shipment.sscc_numbers}
                    </p>
                  )}

                  <div className="flex flex-col gap-2 sm:gap-3 py-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400 font-medium">Arrival Time</div>
                        <div className="text-sm sm:text-base md:text-lg font-bold text-white">{formatDate(shipment.start)}</div>
                        {shipment.is_delivery && isArrivingSoon(shipment.start) && (
                          <div className="flex items-center gap-1 mt-0.5 text-amber-300">
                            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="font-bold text-xs">Arriving Soon</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {shipment.is_delivery && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-slate-400 font-medium">Vehicle</div>
                          <div className="text-sm sm:text-base md:text-lg font-bold text-white">{shipment.car_reg_no || 'N/A'}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {shipment.assigned_operators.length > 0 && (
                    <div className="flex items-start gap-2 pt-3 border-t border-slate-700">
                      <Users className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-400 font-medium mb-1.5">Assigned Operators</div>
                        <div className="flex flex-wrap gap-1.5">
                          {shipment.assigned_operators.map((op, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-white rounded text-xs font-semibold text-center truncate shadow-lg"
                              style={{ backgroundColor: getOperatorColor(op) }}
                              title={op}
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
          <div className="mt-6 md:mt-8 flex justify-center gap-2 pb-4">
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${
                  i === currentPage ? 'bg-blue-500 w-6 sm:w-8' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
