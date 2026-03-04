import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Calendar,
  TrendingUp,
  FileText,
  X,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  deviationService,
  DeviationSummary,
  DeviationDetails,
  DeviationStatus,
  DeviationPriority,
  DeviationType
} from '../services/deviationService';

const DEVIATION_TYPE_LABELS: Record<DeviationType, string> = {
  missing_from_booking: 'Missing from Booking',
  damaged: 'Damaged',
  wrong_quantity: 'Wrong Quantity',
  incorrect_location: 'Incorrect Location',
  other: 'Other'
};

const STATUS_COLORS: Record<DeviationStatus, string> = {
  open: 'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  escalated: 'bg-purple-100 text-purple-800 border-purple-200',
  closed: 'bg-slate-100 text-slate-800 border-slate-200'
};

const PRIORITY_COLORS: Record<DeviationPriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

export function DeviationsTab() {
  const [deviations, setDeviations] = useState<DeviationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<DeviationStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<DeviationPriority | 'all'>('all');
  const [stats, setStats] = useState<{
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    escalated: number;
  }>({ total: 0, open: 0, in_progress: 0, resolved: 0, escalated: 0 });
  const [newComment, setNewComment] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDeviations();
    loadStats();
    const unsubscribe = deviationService.subscribeToDeviations(() => {
      loadDeviations();
      loadStats();
    });
    return unsubscribe;
  }, [filterStatus, filterPriority]);

  const loadDeviations = async () => {
    setLoading(true);
    const result = await deviationService.getDeviations({
      status: filterStatus === 'all' ? undefined : filterStatus,
      priority: filterPriority === 'all' ? undefined : filterPriority
    });

    if (result.success && result.deviations) {
      setDeviations(result.deviations);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const result = await deviationService.getDeviationStats();
    if (result.success && result.stats) {
      setStats(result.stats);
    }
  };

  const viewDetails = async (deviationId: string) => {
    const result = await deviationService.getDeviationDetails(deviationId);
    if (result.success && result.details) {
      setSelectedDeviation(result.details);
      setShowDetails(true);
    }
  };

  const updateStatus = async (deviationId: string, newStatus: DeviationStatus) => {
    const notes = newStatus === 'resolved' ? resolutionNotes : undefined;
    const result = await deviationService.updateDeviationStatus(deviationId, newStatus, notes);
    if (result.success) {
      loadDeviations();
      if (showDetails) {
        viewDetails(deviationId);
      }
      setResolutionNotes('');
    }
  };

  const updatePriority = async (deviationId: string, newPriority: DeviationPriority) => {
    const result = await deviationService.updateDeviationPriority(deviationId, newPriority);
    if (result.success) {
      loadDeviations();
      if (showDetails && selectedDeviation) {
        viewDetails(selectedDeviation.deviation.id);
      }
    }
  };

  const addComment = async () => {
    if (!selectedDeviation || !newComment.trim()) return;

    const result = await deviationService.addComment(selectedDeviation.deviation.id, newComment);
    if (result.success) {
      setNewComment('');
      viewDetails(selectedDeviation.deviation.id);
    }
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Package Deviations</h2>
          <p className="text-sm text-slate-600 mt-1">Track and resolve package discrepancies</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
            <Package className="w-4 h-4" />
            Total
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            Open
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.open}</div>
        </div>
        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            In Progress
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
        </div>
        <div className="bg-white rounded-lg border border-purple-200 p-4">
          <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Escalated
          </div>
          <div className="text-2xl font-bold text-purple-600">{stats.escalated}</div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Resolved
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as DeviationStatus | 'all')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as DeviationPriority | 'all')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deviations List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading deviations...</div>
        ) : deviations.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-lg font-medium">No deviations found</p>
            <p className="text-sm mt-1">All packages are in order!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {deviations.map((deviation) => {
              const isExpanded = expandedRows.has(deviation.id);
              return (
                <div key={deviation.id} className="hover:bg-slate-50 transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => toggleRowExpand(deviation.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[deviation.status]}`}>
                            {deviation.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLORS[deviation.priority]}`}>
                            {deviation.priority.toUpperCase()}
                          </span>
                          <span className="text-sm text-slate-500">
                            {DEVIATION_TYPE_LABELS[deviation.deviation_type]}
                          </span>
                        </div>

                        <div className="ml-8">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{deviation.package_sscc}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-sm text-slate-600">{deviation.shipment_title}</span>
                          </div>

                          <p className="text-sm text-slate-700 mb-2">{deviation.description}</p>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>Reported by: {deviation.reported_by_name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(deviation.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              <span>{deviation.packages_in_shipment} packages in shipment</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewDetails(deviation.id)}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          View Details
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 ml-8 pl-4 border-l-2 border-slate-200">
                        <div className="space-y-3">
                          {deviation.assigned_to_name && (
                            <div className="text-sm">
                              <span className="text-slate-500">Assigned to:</span>
                              <span className="ml-2 font-medium text-slate-900">{deviation.assigned_to_name}</span>
                            </div>
                          )}
                          {deviation.resolved_by_name && (
                            <div className="text-sm">
                              <span className="text-slate-500">Resolved by:</span>
                              <span className="ml-2 font-medium text-slate-900">{deviation.resolved_by_name}</span>
                              <span className="ml-2 text-slate-400">on {formatDate(deviation.resolved_at)}</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            {deviation.status !== 'resolved' && deviation.status !== 'closed' && (
                              <>
                                <select
                                  value={deviation.status}
                                  onChange={(e) => updateStatus(deviation.id, e.target.value as DeviationStatus)}
                                  className="px-3 py-1.5 border border-slate-300 rounded text-sm"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="escalated">Escalated</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                                <select
                                  value={deviation.priority}
                                  onChange={(e) => updatePriority(deviation.id, e.target.value as DeviationPriority)}
                                  className="px-3 py-1.5 border border-slate-300 rounded text-sm"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && selectedDeviation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Deviation Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Deviation Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-slate-600">Package SSCC</span>
                      <p className="font-medium text-slate-900">{selectedDeviation.package?.sscc_number || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600">Shipment</span>
                      <p className="font-medium text-slate-900">{selectedDeviation.shipment.title}</p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600">Status</span>
                      <p className={`inline-block px-2 py-1 rounded text-xs font-medium border mt-1 ${STATUS_COLORS[selectedDeviation.deviation.status]}`}>
                        {selectedDeviation.deviation.status.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-600">Priority</span>
                      <p className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${PRIORITY_COLORS[selectedDeviation.deviation.priority]}`}>
                        {selectedDeviation.deviation.priority.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-slate-600">Description</span>
                    <p className="text-slate-900 mt-1">{selectedDeviation.deviation.description}</p>
                  </div>
                </div>

                {/* All Packages in Shipment */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    All Packages in This Delivery ({selectedDeviation.all_packages_in_shipment.length})
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {selectedDeviation.all_packages_in_shipment.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`flex items-center justify-between p-3 rounded border ${
                            pkg.has_deviation
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {pkg.has_deviation && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                            <span className="font-medium text-slate-900">{pkg.sscc_number}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">{pkg.storage_location || 'No location'}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              pkg.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {pkg.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Resolution */}
                {selectedDeviation.deviation.status !== 'resolved' && selectedDeviation.deviation.status !== 'closed' && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Resolve Deviation</h4>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Enter resolution notes..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-24"
                    />
                    <button
                      onClick={() => updateStatus(selectedDeviation.deviation.id, 'resolved')}
                      disabled={!resolutionNotes.trim()}
                      className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      Mark as Resolved
                    </button>
                  </div>
                )}

                {/* History */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    History
                  </h4>
                  <div className="space-y-3">
                    {selectedDeviation.history.map((entry) => (
                      <div key={entry.id} className="flex gap-3 text-sm">
                        <div className="text-slate-400 whitespace-nowrap">{formatDate(entry.created_at)}</div>
                        <div className="flex-1">
                          <span className="font-medium text-slate-900">{entry.action_type.replace('_', ' ')}</span>
                          {entry.comment && <p className="text-slate-600 mt-1">{entry.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Comment */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Add Comment</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type a comment..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addComment()}
                    />
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
