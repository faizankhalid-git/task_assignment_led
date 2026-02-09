import { useState, useEffect } from 'react';
import { auditService, AuditLogEntry } from '../services/auditService';
import { Clock, User, FileText, Filter, Search, ChevronDown, ChevronRight, History } from 'lucide-react';

export function AuditLogTab() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    loadAuditLogs();
  }, [limit]);

  const loadAuditLogs = async () => {
    setLoading(true);
    const logs = await auditService.getRecentActivity(limit);
    setAuditLogs(logs);
    setLoading(false);
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action_type === filterAction;
    const matchesSearch = !searchQuery ||
      log.shipment_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action_by_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.changes_summary?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesAction && matchesSearch;
  });

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'updated':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'status_changed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'operator_assigned':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'operator_removed':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'deleted':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Created';
      case 'updated': return 'Updated';
      case 'status_changed': return 'Status Changed';
      case 'completed': return 'Completed';
      case 'operator_assigned': return 'Operator Assigned';
      case 'operator_removed': return 'Operator Removed';
      case 'deleted': return 'Deleted';
      default: return action;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Audit Log</h2>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Complete history of all shipment operations, showing who did what and when.
        </p>

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shipment, user, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="status_changed">Status Changed</option>
                <option value="completed">Completed</option>
                <option value="operator_assigned">Operator Assigned</option>
                <option value="operator_removed">Operator Removed</option>
              </select>
            </div>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={250}>Last 250</option>
              <option value={500}>Last 500</option>
            </select>

            <button
              onClick={loadAuditLogs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No audit logs found</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery || filterAction !== 'all'
                ? 'Try adjusting your filters'
                : 'Audit logs will appear here when actions are performed'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-slate-600">
                Showing {filteredLogs.length} of {auditLogs.length} entries
              </p>
            </div>

            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <button className="mt-1 flex-shrink-0">
                      {expandedId === log.id ? (
                        <ChevronDown className="w-5 h-5 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action_type)}`}>
                              {getActionLabel(log.action_type)}
                            </span>
                            {log.shipment_row_id && (
                              <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                #{log.shipment_row_id}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-slate-900">
                            {log.shipment_title || 'Unknown Shipment'}
                          </p>
                          {log.changes_summary && (
                            <p className="text-sm text-slate-600 mt-1">{log.changes_summary}</p>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="whitespace-nowrap">{formatTimestamp(log.action_timestamp)}</span>
                          </div>
                          {log.action_by_email && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <User className="w-4 h-4" />
                              <span className="whitespace-nowrap">{log.action_by_email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedId === log.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-200 bg-slate-50">
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {log.previous_data && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Previous Data</h4>
                          <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                            {JSON.stringify(log.previous_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.new_data && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">New Data</h4>
                          <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                            {JSON.stringify(log.new_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {!log.previous_data && !log.new_data && (
                        <div className="col-span-2">
                          <p className="text-sm text-slate-600 italic">No detailed data available for this action.</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                        <div>
                          <span className="font-semibold">Action ID:</span> {log.id}
                        </div>
                        <div>
                          <span className="font-semibold">Shipment ID:</span> {log.shipment_id}
                        </div>
                        {log.action_by && (
                          <div>
                            <span className="font-semibold">User ID:</span> {log.action_by}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">About Audit Logs</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>All shipment operations are automatically tracked</li>
            <li>Logs include user information, timestamps, and detailed changes</li>
            <li>Expand any entry to view complete before/after data</li>
            <li>Use filters and search to find specific actions quickly</li>
            <li>Logs are retained permanently for compliance and troubleshooting</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
