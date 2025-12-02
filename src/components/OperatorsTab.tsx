import { useState, useEffect } from 'react';
import { supabase, Operator } from '../lib/supabase';
import { Plus, Trash2, UserCheck, UserX, Search } from 'lucide-react';

export function OperatorsTab() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOperators();
  }, []);

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

    const { error } = await supabase
      .from('operators')
      .insert({ name: newOperatorName.trim() });

    if (!error) {
      setNewOperatorName('');
      loadOperators();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase
      .from('operators')
      .update({ active: !currentActive })
      .eq('id', id);

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
    <div className="max-w-2xl">
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
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOperators.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  {searchQuery ? 'No operators found' : 'No operators added yet'}
                </td>
              </tr>
            ) : (
              filteredOperators.map((operator) => (
                <tr key={operator.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">{operator.name}</td>
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
    </div>
  );
}
