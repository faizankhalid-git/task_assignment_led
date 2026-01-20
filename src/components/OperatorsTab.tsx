import { useState, useEffect } from 'react';
import { supabase, Operator } from '../lib/supabase';
import { Plus, Trash2, UserCheck, UserX, Search, Palette, Edit2, X } from 'lucide-react';
import { notificationService } from '../services/notificationService';

export function OperatorsTab() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorColor, setNewOperatorColor] = useState('#10b981');
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOperators, setSelectedOperators] = useState<Set<string>>(new Set());
  const [bulkColor, setBulkColor] = useState('#10b981');
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  useEffect(() => {
    initializeNotifications();
    loadOperators();
  }, []);

  const initializeNotifications = async () => {
    await notificationService.initialize();
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOperators(operators);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredOperators(
        operators.filter(op => op.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, operators]);

  const loadOperators = async () => {
    const { data } = await supabase
      .from('operators')
      .select('*')
      .order('name');

    if (data) {
      setOperators(data);
      setFilteredOperators(data);
    }
    setLoading(false);
  };

  const addOperator = async () => {
    if (!newOperatorName.trim()) return;

    const { data, error } = await supabase
      .from('operators')
      .insert({ name: newOperatorName.trim(), color: newOperatorColor })
      .select()
      .single();

    if (!error && data) {
      const { data: { user } } = await supabase.auth.getUser();
      await notificationService.notifyOperatorCreated(data.id, data.name);

      setNewOperatorName('');
      setNewOperatorColor('#10b981');
      loadOperators();
    }
  };

  const updateOperatorColor = async (id: string, color: string) => {
    await supabase
      .from('operators')
      .update({ color })
      .eq('id', id);

    setEditingOperator(null);
    loadOperators();
  };

  const toggleSelectOperator = (id: string) => {
    const newSelected = new Set(selectedOperators);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOperators(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOperators.size === filteredOperators.length) {
      setSelectedOperators(new Set());
    } else {
      setSelectedOperators(new Set(filteredOperators.map(op => op.id)));
    }
  };

  const updateBulkColors = async () => {
    const promises = Array.from(selectedOperators).map(id =>
      supabase.from('operators').update({ color: bulkColor }).eq('id', id)
    );

    await Promise.all(promises);
    setSelectedOperators(new Set());
    setShowBulkEdit(false);
    setBulkColor('#10b981');
    loadOperators();
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const operator = operators.find(op => op.id === id);
    if (!operator) return;

    await supabase
      .from('operators')
      .update({ active: !currentActive })
      .eq('id', id);

    const { data: { user } } = await supabase.auth.getUser();

    if (!currentActive) {
      await notificationService.notifyOperatorAssigned(id, operator.name, user?.id);
    } else {
      await notificationService.notifyOperatorRemoved(id, operator.name, user?.id);
    }

    loadOperators();
  };

  const deleteOperator = async (id: string) => {
    if (!confirm('Are you sure you want to delete this operator?')) return;

    await supabase
      .from('operators')
      .delete()
      .eq('id', id);

    loadOperators();
  };

  if (loading) {
    return <div className="text-slate-600">Loading operators...</div>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Operators</h2>

      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newOperatorName}
            onChange={(e) => setNewOperatorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOperator()}
            placeholder="Operator name"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="relative">
            <input
              type="color"
              value={newOperatorColor}
              onChange={(e) => setNewOperatorColor(e.target.value)}
              className="h-full w-16 rounded-lg border border-slate-300 cursor-pointer"
              title="Choose operator color"
            />
            <Palette className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
          </div>
          <button
            onClick={addOperator}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search operators..."
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {selectedOperators.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOperators.size} operator{selectedOperators.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setShowBulkEdit(!showBulkEdit)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <Palette className="w-4 h-4" />
                  Change Colors
                </button>
                <button
                  onClick={() => setSelectedOperators(new Set())}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {showBulkEdit && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select color for all selected operators
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bulkColor}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="h-12 w-24 rounded-lg border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bulkColor}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    placeholder="#10b981"
                  />
                  <button
                    onClick={updateBulkColors}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Apply to {selectedOperators.size} operator{selectedOperators.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={filteredOperators.length > 0 && selectedOperators.size === filteredOperators.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Color</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOperators.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {searchQuery ? 'No operators found' : 'No operators added yet'}
                </td>
              </tr>
            ) : (
              filteredOperators.map((operator) => (
                <tr key={operator.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOperators.has(operator.id)}
                      onChange={() => toggleSelectOperator(operator.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{operator.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded border border-slate-300"
                        style={{ backgroundColor: operator.color }}
                      />
                      <span className="text-xs text-slate-500 font-mono">{operator.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      operator.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {operator.active ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3" />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingOperator(operator)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit color"
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(operator.id, operator.active)}
                        className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                      >
                        {operator.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteOperator(operator.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingOperator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit Operator Color</h3>
              <button
                onClick={() => setEditingOperator(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Operator: {editingOperator.name}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Choose Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingOperator.color}
                    onChange={(e) => setEditingOperator({ ...editingOperator, color: e.target.value })}
                    className="h-12 w-24 rounded-lg border border-slate-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editingOperator.color}
                      onChange={(e) => setEditingOperator({ ...editingOperator, color: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-lg">
                <div
                  className="w-16 h-16 rounded-lg border-2 border-white shadow-lg"
                  style={{ backgroundColor: editingOperator.color }}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Preview</div>
                  <div className="text-xs text-slate-500">This is how it will appear on LED display</div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => updateOperatorColor(editingOperator.id, editingOperator.color)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Color
                </button>
                <button
                  onClick={() => setEditingOperator(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
