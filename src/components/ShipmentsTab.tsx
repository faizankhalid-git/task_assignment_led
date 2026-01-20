import { useState, useEffect } from 'react';
import { supabase, Shipment } from '../lib/supabase';
import { Package, CheckCircle2, Clock, Info, Download, Trash2, Plus, Edit2, X, Search } from 'lucide-react';
import { CompletionModal } from './CompletionModal';
import { PackageManager } from './PackageManager';
import { notificationService } from '../services/notificationService';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEK_NUMBERS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const getCurrentWeekStart = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekdayDate = (weekdayIndex: number) => {
  const weekStart = getCurrentWeekStart();
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + weekdayIndex);
  return date;
};

const formatWeekdayLabel = (weekday: string, index: number) => {
  const date = getWeekdayDate(index);
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `${weekday} ${day} ${month}`;
};

export function ShipmentsTab() {
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [packagesList, setPackagesList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDelivery, setIsDelivery] = useState(true);

  useEffect(() => {
    initializeNotifications();
    loadShipments();
    loadOperators();
    setupRealtimeSubscription();
  }, []);

  const initializeNotifications = async () => {
    await notificationService.initialize();
  };

  useEffect(() => {
    filterShipments();
  }, [selectedDate, selectedStatus, allShipments, searchQuery]);

  const getDateRangeForFilter = (filter: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filter === 'all') {
      return null;
    }

    if (filter === 'today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { start: today, end: tomorrow };
    }

    if (filter.startsWith('Monday') || filter.startsWith('Tuesday') || filter.startsWith('Wednesday') || filter.startsWith('Thursday') || filter.startsWith('Friday')) {
      const weekdayName = filter.split(' ')[0];
      const dayIndex = WEEKDAYS.indexOf(weekdayName);
      if (dayIndex !== -1) {
        const targetDate = getWeekdayDate(dayIndex);
        const nextDay = new Date(targetDate);
        nextDay.setDate(targetDate.getDate() + 1);
        return { start: targetDate, end: nextDay };
      }
    }

    const weekIndex = WEEK_NUMBERS.indexOf(filter);
    if (weekIndex !== -1) {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(monthStart);
      weekStart.setDate(monthStart.getDate() + weekIndex * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      return { start: weekStart, end: weekEnd };
    }

    if (filter === 'monthly') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: monthStart, end: monthEnd };
    }

    return null;
  };

  const filterShipments = () => {
    let filtered = allShipments;

    const dateRange = getDateRangeForFilter(selectedDate);
    if (dateRange) {
      filtered = filtered.filter(s => {
        if (!s.start) return false;
        const shipmentDate = new Date(s.start);
        return shipmentDate >= dateRange.start && shipmentDate < dateRange.end;
      });
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.sscc_numbers?.toLowerCase().includes(query) ||
        s.title?.toLowerCase().includes(query) ||
        s.car_reg_no?.toLowerCase().includes(query)
      );
    }

    setShipments(filtered);
  };

  const loadShipments = async () => {
    const { data } = await supabase
      .from('shipments')
      .select('*')
      .eq('archived', false)
      .order('start', { ascending: true });

    if (data) {
      setAllShipments(data);
      filterShipments();
    }
    setLoading(false);
  };

  const loadOperators = async () => {
    const { data } = await supabase
      .from('operators')
      .select('id, name')
      .eq('active', true)
      .order('name');

    if (data) {
      setOperators(data);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('shipments-changes')
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


  const updateStatus = async (id: string, status: 'pending' | 'in_progress' | 'completed') => {
    if (status === 'completed') {
      const shipment = shipments.find(s => s.id === id);
      if (shipment) {
        setSelectedShipment(shipment);
      }
      return;
    }

    setAllShipments(prevShipments =>
      prevShipments.map(s => s.id === id ? { ...s, status } : s)
    );

    await supabase
      .from('shipments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const exportToCSV = (data: Shipment[], filename: string) => {
    const headers = ['Title', 'SSCC Numbers', 'Arrival Time', 'Vehicle Reg', 'Operators', 'Status', 'Storage Location', 'Notes'];

    const rows = data.map(shipment => [
      shipment.title,
      shipment.sscc_numbers,
      formatDate(shipment.start),
      shipment.car_reg_no,
      shipment.assigned_operators.join('; '),
      shipment.status,
      shipment.storage_location,
      shipment.notes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDailyReport = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `shipments-daily-${dateStr}.csv`;
    exportToCSV(shipments, filename);
  };

  const getWeekRange = (weekNumber: number) => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    if (weekNumber === 1) {
      const firstWeekEnd = new Date(monthStart);
      const daysUntilMonday = (8 - firstWeekEnd.getDay()) % 7;
      firstWeekEnd.setDate(monthStart.getDate() + daysUntilMonday + 6);
      return { start: monthStart, end: firstWeekEnd };
    } else {
      const firstWeekEnd = new Date(monthStart);
      const daysUntilMonday = (8 - firstWeekEnd.getDay()) % 7;
      firstWeekEnd.setDate(monthStart.getDate() + daysUntilMonday + 6);

      const weekStart = new Date(firstWeekEnd);
      weekStart.setDate(firstWeekEnd.getDate() + 1 + (weekNumber - 2) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return { start: weekStart, end: weekEnd };
    }
  };

  const downloadWeekReport = (weekNumber: number) => {
    const { start, end } = getWeekRange(weekNumber);

    const weekShipments = allShipments.filter(s => {
      if (!s.start) return false;
      const shipmentDate = new Date(s.start);
      return shipmentDate >= start && shipmentDate <= end;
    });

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const filename = `shipments-week${weekNumber}-${startStr}-to-${endStr}.csv`;
    exportToCSV(weekShipments, filename);
  };

  const downloadMonthlyReport = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthShipments = allShipments.filter(s => {
      if (!s.start) return false;
      const shipmentDate = new Date(s.start);
      return shipmentDate >= monthStart && shipmentDate <= monthEnd;
    });

    const monthName = monthStart.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const filename = `shipments-${monthName.replace(' ', '-')}.csv`;
    exportToCSV(monthShipments, filename);
  };

  const deleteShipment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this delivery?')) {
      return;
    }

    setDeleting(id);
    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAllShipments(allShipments.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete shipment:', err);
      alert('Failed to delete delivery');
    } finally {
      setDeleting(null);
    }
  };

  const createShipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newShipment = {
      row_id: Math.floor(Math.random() * 1000000),
      title: formData.get('title') as string,
      sscc_numbers: packagesList.length > 0 ? packagesList.join(', ') : '',
      start: formData.get('start') as string,
      car_reg_no: formData.get('car_reg_no') as string,
      status: 'pending',
      archived: false,
      assigned_operators: selectedOperators,
      storage_location: '',
      notes: '',
      is_delivery: isDelivery
    };

    try {
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .insert([newShipment])
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      const packagesData = packagesList.map(sscc => ({
        shipment_id: shipmentData.id,
        sscc_number: sscc,
        status: 'pending'
      }));

      const { error: packagesError } = await supabase
        .from('packages')
        .insert(packagesData);

      if (packagesError) throw packagesError;

      const { data: { user } } = await supabase.auth.getUser();

      for (const operatorId of selectedOperators) {
        const operator = operators.find(op => op.id === operatorId);
        if (operator) {
          await notificationService.notifyOperatorAssigned(
            operatorId,
            operator.name,
            user?.id
          );
        }
      }

      form.reset();
      setSelectedOperators([]);
      setOperatorSearch('');
      setPackagesList([]);
      setIsDelivery(true);
      setShowNewShipment(false);
      loadShipments();
      alert('Delivery created successfully!');
    } catch (err) {
      console.error('Failed to create shipment:', err);
      alert('Failed to create delivery: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const updateShipment = async (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const updates = {
      title: formData.get('title') as string,
      sscc_numbers: formData.get('sscc_numbers') as string,
      start: formData.get('start') as string,
      car_reg_no: formData.get('car_reg_no') as string,
      assigned_operators: selectedOperators,
      updated_at: new Date().toISOString()
    };

    try {
      const currentShipment = allShipments.find(s => s.id === id);
      const previousOperators = currentShipment?.assigned_operators || [];

      const { error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      const addedOperators = selectedOperators.filter(op => !previousOperators.includes(op));
      const removedOperators = previousOperators.filter(op => !selectedOperators.includes(op));

      for (const operatorId of addedOperators) {
        const operator = operators.find(op => op.id === operatorId);
        if (operator) {
          await notificationService.notifyOperatorAssigned(
            operatorId,
            operator.name,
            user?.id
          );
        }
      }

      for (const operatorId of removedOperators) {
        const operator = operators.find(op => op.id === operatorId);
        if (operator) {
          await notificationService.notifyOperatorRemoved(
            operatorId,
            operator.name,
            user?.id
          );
        }
      }

      setEditingId(null);
      setSelectedOperators([]);
      loadShipments();
      alert('Delivery updated successfully!');
    } catch (err) {
      console.error('Failed to update shipment:', err);
      alert('Failed to update delivery');
    }
  };

  const exportToGoogleSheets = async () => {
    try {
      if (allShipments.length === 0) {
        alert('No deliveries to backup');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-to-sheets`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers
      });
      const result = await response.json();

      if (!result.success) {
        alert(`Backup failed: ${result.error}`);
        return;
      }

      const instructions = result.instructions.join('\n');
      const confirmation = window.confirm(
        `📊 Backup Ready\n\n` +
        `Prepared ${result.count} deliveries for backup.\n\n` +
        `${instructions}\n\n` +
        `Download CSV now?`
      );

      if (!confirmation) return;

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `backup-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Backup CSV downloaded successfully!');
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Failed to create backup export: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const clearAllShipments = async () => {
    if (!window.confirm('Are you sure you want to delete ALL deliveries? This cannot be undone!')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('archived', false);

      if (error) throw error;

      setAllShipments([]);
      setShipments([]);
      alert('All deliveries cleared!');
    } catch (err) {
      console.error('Failed to clear shipments:', err);
      alert('Failed to clear deliveries');
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading shipments...</div>;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Shipments</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewShipment(!showNewShipment)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Delivery
            </button>
            <button
              onClick={downloadDailyReport}
              disabled={shipments.length === 0}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Daily
            </button>
            <div className="relative group">
              <button
                disabled={allShipments.length === 0}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Reports
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg py-1 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-slate-200">
                <button
                  onClick={() => downloadWeekReport(1)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Week 1
                </button>
                <button
                  onClick={() => downloadWeekReport(2)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Week 2
                </button>
                <button
                  onClick={() => downloadWeekReport(3)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Week 3
                </button>
                <button
                  onClick={() => downloadWeekReport(4)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Week 4
                </button>
                <div className="border-t border-slate-200 my-1"></div>
                <button
                  onClick={downloadMonthlyReport}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 font-medium"
                >
                  Full Month
                </button>
              </div>
            </div>
            <button
              onClick={exportToGoogleSheets}
              disabled={allShipments.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Backup
            </button>
            <button
              onClick={clearAllShipments}
              disabled={allShipments.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        {showNewShipment && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <form onSubmit={createShipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="title"
                  placeholder="Delivery Title"
                  required
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="datetime-local"
                  name="start"
                  required
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  name="car_reg_no"
                  placeholder="Car Registration"
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 col-span-2"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_delivery"
                  checked={isDelivery}
                  onChange={(e) => setIsDelivery(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_delivery" className="text-sm font-medium text-slate-700 cursor-pointer">
                  This is a delivery (show vehicle icon on LED display)
                </label>
              </div>

              <PackageManager
                packages={packagesList}
                onChange={setPackagesList}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign Operators</label>
                <input
                  type="text"
                  placeholder="Search operators..."
                  value={operatorSearch}
                  onChange={(e) => setOperatorSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <div className="bg-white border border-slate-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                  {selectedOperators.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">Selected ({selectedOperators.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedOperators.map((opName) => (
                          <button
                            key={opName}
                            type="button"
                            onClick={() => setSelectedOperators(selectedOperators.filter(n => n !== opName))}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 flex items-center gap-1"
                          >
                            {opName}
                            <X className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {operators
                      .filter(op => op.name.toLowerCase().includes(operatorSearch.toLowerCase()))
                      .map((op) => (
                        <label
                          key={op.id}
                          className={`flex items-center gap-2 p-2 rounded border-2 cursor-pointer transition-all ${
                            selectedOperators.includes(op.name)
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOperators.includes(op.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOperators([...selectedOperators, op.name]);
                              } else {
                                setSelectedOperators(selectedOperators.filter(n => n !== op.name));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 font-medium">{op.name}</span>
                        </label>
                      ))}
                  </div>
                  {operators.filter(op => op.name.toLowerCase().includes(operatorSearch.toLowerCase())).length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-4">No operators found</div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Delivery
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewShipment(false);
                    setSelectedOperators([]);
                    setOperatorSearch('');
                  }}
                  className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedDate('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedDate('today')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
          {WEEKDAYS.map((day, index) => {
            const label = formatWeekdayLabel(day, index);
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(label)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedDate === label
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
          {WEEK_NUMBERS.map((week) => (
            <button
              key={week}
              onClick={() => setSelectedDate(week)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedDate === week
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {week}
            </button>
          ))}
          <button
            onClick={() => setSelectedDate('monthly')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDate === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Monthly
          </button>
        </div>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SSCC, title, or car registration..."
              className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Filter by Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedStatus === 'all'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedStatus === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setSelectedStatus('in_progress')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedStatus === 'in_progress'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setSelectedStatus('completed')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedStatus === 'completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Automatic Syncing Enabled</p>
            <p>Google Sheets data is automatically synced every 2 minutes. New shipments will appear here automatically.</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">
          Total: <span className="text-lg font-bold text-blue-600">{shipments.length}</span> {shipments.length === 1 ? 'delivery' : 'deliveries'}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Title</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">SSCC/Packages</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Arrival</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Car Reg</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Operators</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {searchQuery ? 'No shipments found matching your search' : 'No shipments found. Click "Sync with Sheet" to import data.'}
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr key={shipment.id} className={editingId === shipment.id ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  {editingId === shipment.id ? (
                    <>
                      <td colSpan={7} className="px-4 py-3">
                        <form onSubmit={(e) => updateShipment(shipment.id, e)} className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            <input
                              type="text"
                              name="title"
                              defaultValue={shipment.title}
                              placeholder="Title"
                              required
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              name="sscc_numbers"
                              defaultValue={shipment.sscc_numbers}
                              placeholder="SSCC"
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                            <input
                              type="datetime-local"
                              name="start"
                              defaultValue={shipment.start ? new Date(shipment.start).toISOString().slice(0, 16) : ''}
                              required
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              name="car_reg_no"
                              defaultValue={shipment.car_reg_no}
                              placeholder="Reg"
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Assign Operators</label>
                            <input
                              type="text"
                              placeholder="Search operators..."
                              value={operatorSearch}
                              onChange={(e) => setOperatorSearch(e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs mb-2 focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="bg-white border border-slate-300 rounded-lg p-2 max-h-40 overflow-y-auto">
                              {selectedOperators.length > 0 && (
                                <div className="mb-2 pb-2 border-b border-slate-200">
                                  <div className="flex flex-wrap gap-1">
                                    {selectedOperators.map((opName) => (
                                      <button
                                        key={opName}
                                        type="button"
                                        onClick={() => setSelectedOperators(selectedOperators.filter(n => n !== opName))}
                                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 flex items-center gap-1"
                                      >
                                        {opName}
                                        <X className="w-3 h-3" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-1">
                                {operators.filter(op => op.name.toLowerCase().includes(operatorSearch.toLowerCase())).map((op) => (
                                  <label
                                    key={op.id}
                                    className={`flex items-center gap-1 p-1 rounded border cursor-pointer text-xs ${
                                      selectedOperators.includes(op.name)
                                        ? 'bg-blue-50 border-blue-500'
                                        : 'bg-white border-slate-200 hover:border-blue-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedOperators.includes(op.name)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedOperators([...selectedOperators, op.name]);
                                        } else {
                                          setSelectedOperators(selectedOperators.filter(n => n !== op.name));
                                        }
                                      }}
                                      className="w-3 h-3 text-blue-600 rounded"
                                    />
                                    <span className="text-slate-700 font-medium">{op.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setSelectedOperators([]);
                              }}
                              className="px-3 py-1 text-sm bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">{shipment.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={shipment.sscc_numbers}>
                        {shipment.sscc_numbers || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(shipment.start)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {shipment.car_reg_no}
                      </td>
                      <td className="px-4 py-3">
                        {shipment.assigned_operators.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {shipment.assigned_operators.map((op, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs"
                              >
                                {op}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                          {shipment.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                          {shipment.status === 'in_progress' && <Clock className="w-3 h-3" />}
                          {shipment.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {shipment.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(shipment.id, 'in_progress')}
                              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                            >
                              Start
                            </button>
                          )}
                          {shipment.status !== 'completed' && (
                            <button
                              onClick={() => updateStatus(shipment.id, 'completed')}
                              className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingId(shipment.id);
                              setSelectedOperators(shipment.assigned_operators || []);
                            }}
                            className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                            title="Edit delivery"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteShipment(shipment.id)}
                            disabled={deleting === shipment.id}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete delivery"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedShipment && (
        <CompletionModal
          shipment={selectedShipment}
          onClose={() => setSelectedShipment(null)}
          onComplete={() => {
            setSelectedShipment(null);
            loadShipments();
          }}
        />
      )}
    </>
  );
}
