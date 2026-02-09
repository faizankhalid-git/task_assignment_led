import { useState, useEffect } from 'react';
import { supabase, Shipment, Operator, Package as PackageType } from '../lib/supabase';
import { X, Loader2, Package, Search } from 'lucide-react';
import { PackageManager } from './PackageManager';
import { auditService } from '../services/auditService';

type CompletionModalProps = {
  shipment: Shipment;
  onClose: () => void;
  onComplete: () => void;
};

export function CompletionModal({ shipment, onClose, onComplete }: CompletionModalProps) {
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [newPackagesList, setNewPackagesList] = useState<string[]>([]);
  const [packageLocations, setPackageLocations] = useState<Record<string, string>>({});
  const [selectedOperators, setSelectedOperators] = useState<string[]>(shipment.assigned_operators || []);
  const [notes, setNotes] = useState(shipment.notes || '');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorAssignments, setOperatorAssignments] = useState<Record<string, string[]>>({});
  const [operatorSearch, setOperatorSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    loadOperators();
    loadPackages();
    loadOperatorAssignments();
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

  const loadOperatorAssignments = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, title, assigned_operators, status, start')
      .eq('archived', false)
      .neq('status', 'completed')
      .gte('start', todayISO)
      .lt('start', tomorrowISO);

    if (shipments) {
      const assignments: Record<string, string[]> = {};

      shipments
        .filter(s => s.id !== shipment.id && s.assigned_operators && s.assigned_operators.length > 0)
        .forEach(s => {
          s.assigned_operators.forEach((operatorName: string) => {
            if (!assignments[operatorName]) {
              assignments[operatorName] = [];
            }
            assignments[operatorName].push(s.title);
          });
        });

      setOperatorAssignments(assignments);
    }
  };

  const loadPackages = async () => {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('created_at');

    if (error) {
      console.error('Failed to load packages:', error);
      setLoadingPackages(false);
      return;
    }

    if (data) {
      setPackages(data);
      const locations: Record<string, string> = {};
      data.forEach(pkg => {
        locations[pkg.id] = pkg.storage_location || '';
      });
      setPackageLocations(locations);
    }
    setLoadingPackages(false);
  };

  const toggleOperator = (operatorName: string) => {
    if (selectedOperators.includes(operatorName)) {
      setSelectedOperators(selectedOperators.filter(o => o !== operatorName));
    } else {
      setSelectedOperators([...selectedOperators, operatorName]);
    }
  };

  const handleComplete = async () => {
    if (newPackagesList.length > 0) {
      setError('Please save new packages before completing. All new packages need storage locations.');
      return;
    }

    if (packages.length > 0) {
      const missingLocations = packages.filter(pkg => !packageLocations[pkg.id]?.trim());
      if (missingLocations.length > 0) {
        setError(`Please specify storage location for all packages (${missingLocations.length} missing)`);
        return;
      }
    }

    if (selectedOperators.length === 0) {
      setError('At least one operator must be assigned');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const completedAt = new Date().toISOString();

      for (const pkg of packages) {
        const { error: pkgError } = await supabase
          .from('packages')
          .update({
            storage_location: packageLocations[pkg.id].trim(),
            status: 'stored',
            updated_at: completedAt
          })
          .eq('id', pkg.id);

        if (pkgError) throw pkgError;
      }

      const allPackageNumbers = packages.map(p => p.sscc_number);
      const allLocations = packages.length > 0
        ? packages.map(pkg => `${pkg.sscc_number}: ${packageLocations[pkg.id]}`).join('; ')
        : '';

      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          sscc_numbers: allPackageNumbers.join(', '),
          storage_location: allLocations,
          assigned_operators: selectedOperators,
          notes: notes.trim(),
          status: 'completed',
          updated_at: completedAt,
          completed_by: user?.id,
          completed_at: completedAt
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      await auditService.logShipmentCompletion(
        shipment.id,
        user?.id || null,
        {
          title: shipment.title,
          previous_status: shipment.status,
          packages_count: packages.length,
          operators: selectedOperators
        }
      );

      setSaving(false);
      onComplete();
    } catch (err) {
      setError('Failed to update shipment');
      setSaving(false);
    }
  };

  const handleSaveNewPackages = async () => {
    if (newPackagesList.length === 0) {
      return;
    }

    try {
      const packagesData = newPackagesList.map(sscc => ({
        shipment_id: shipment.id,
        sscc_number: sscc,
        status: 'pending'
      }));

      const { data, error } = await supabase
        .from('packages')
        .insert(packagesData)
        .select();

      if (error) throw error;

      if (data) {
        setPackages([...packages, ...data]);
        const newLocations = { ...packageLocations };
        data.forEach(pkg => {
          newLocations[pkg.id] = '';
        });
        setPackageLocations(newLocations);
      }

      setNewPackagesList([]);
      setError('');
    } catch (err) {
      setError('Failed to add new packages');
    }
  };

  const handleRemovePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to remove this package?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', packageId);

      if (error) throw error;

      setPackages(packages.filter(p => p.id !== packageId));
      const newLocations = { ...packageLocations };
      delete newLocations[packageId];
      setPackageLocations(newLocations);
    } catch (err) {
      setError('Failed to remove package');
    }
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
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Add/Remove Packages
            </label>
            <div className="border border-slate-300 rounded-lg p-3 bg-white">
              <PackageManager
                packages={newPackagesList}
                onChange={setNewPackagesList}
                showLabel={false}
                compact={false}
              />
              {newPackagesList.length > 0 && (
                <button
                  onClick={handleSaveNewPackages}
                  className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm"
                >
                  Save {newPackagesList.length} New Package{newPackagesList.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Packages Storage Locations <span className="text-red-600">*</span>
            </label>
            {loadingPackages ? (
              <div className="text-sm text-slate-500 py-4 text-center">Loading packages...</div>
            ) : packages.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">No packages found</div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-900">{pkg.sscc_number}</span>
                      </div>
                      <button
                        onClick={() => handleRemovePackage(pkg.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                        title="Remove package"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={packageLocations[pkg.id] || ''}
                      onChange={(e) => setPackageLocations({ ...packageLocations, [pkg.id]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="e.g., Warehouse A, Bay 12"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assigned Operators <span className="text-red-600">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search operators..."
                value={operatorSearch}
                onChange={(e) => setOperatorSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
              {operators.length === 0 ? (
                <p className="text-sm text-slate-500">No active operators available</p>
              ) : (
                <div className="space-y-2">
                  {operators
                    .filter(op => op.name.toLowerCase().includes(operatorSearch.toLowerCase()))
                    .map((operator) => {
                      const hasAssignments = operatorAssignments[operator.name] && operatorAssignments[operator.name].length > 0;
                      const assignmentTooltip = hasAssignments
                        ? `Currently assigned to: ${operatorAssignments[operator.name].join(', ')}`
                        : '';

                      return (
                        <label
                          key={operator.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                          title={assignmentTooltip}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOperators.includes(operator.name)}
                            onChange={() => toggleOperator(operator.name)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span
                            className="text-sm font-medium"
                            style={{ color: hasAssignments ? '#17a34a' : '#0f172a' }}
                          >
                            {operator.name}
                          </span>
                        </label>
                      );
                    })}
                  {operators.filter(op => op.name.toLowerCase().includes(operatorSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-2">No operators found</p>
                  )}
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
            disabled={saving || loadingPackages}
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
