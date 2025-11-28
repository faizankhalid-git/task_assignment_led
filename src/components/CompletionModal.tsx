import { useState, useEffect } from 'react';
import { supabase, Shipment, Operator } from '../lib/supabase';
import { X, Loader2 } from 'lucide-react';

type CompletionModalProps = {
  shipment: Shipment;
  onClose: () => void;
  onComplete: () => void;
};

export function CompletionModal({ shipment, onClose, onComplete }: CompletionModalProps) {
  const [storageLocation, setStorageLocation] = useState(shipment.storage_location || '');
  const [selectedOperators, setSelectedOperators] = useState<string[]>(shipment.assigned_operators || []);
  const [notes, setNotes] = useState(shipment.notes || '');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOperators();
  }, []);

  const loadOperators = async () => {
    const { data } = await supabase
      .from('operators')
      .select('*')
      .eq('active', true)
      .order('name');

    if (data) {
      setOperators(data);
    }
  };

  const toggleOperator = (operatorName: string) => {
    if (selectedOperators.includes(operatorName)) {
      setSelectedOperators(selectedOperators.filter(o => o !== operatorName));
    } else {
      setSelectedOperators([...selectedOperators, operatorName]);
    }
  };

  const handleComplete = async () => {
    if (!storageLocation.trim()) {
      setError('Storage location is required');
      return;
    }

    if (selectedOperators.length === 0) {
      setError('At least one operator must be assigned');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        storage_location: storageLocation.trim(),
        assigned_operators: selectedOperators,
        notes: notes.trim(),
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', shipment.id);

    if (updateError) {
      setError('Failed to update shipment');
      setSaving(false);
      return;
    }

    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Complete Shipment</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-slate-900">{shipment.title}</p>
            <p className="text-xs text-slate-600 mt-1">{shipment.car_reg_no}</p>
          </div>

          <div>
            <label htmlFor="storageLocation" className="block text-sm font-medium text-slate-700 mb-1">
              Storage Location <span className="text-red-600">*</span>
            </label>
            <input
              id="storageLocation"
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Warehouse A, Bay 12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assigned Operators <span className="text-red-600">*</span>
            </label>
            <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
              {operators.length === 0 ? (
                <p className="text-sm text-slate-500">No active operators available</p>
              ) : (
                <div className="space-y-2">
                  {operators.map((operator) => (
                    <label
                      key={operator.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOperators.includes(operator.name)}
                        onChange={() => toggleOperator(operator.name)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-900">{operator.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes or comments"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Complete Shipment
          </button>
        </div>
      </div>
    </div>
  );
}
