import { useState } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';

export interface PackageWithDeviation {
  sscc: string;
  hasDeviation: boolean;
  deviationNotes?: string;
}

type PackageManagerProps = {
  packages: string[];
  onChange: (packages: string[]) => void;
  disabled?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  enableDeviationTracking?: boolean;
  packagesWithDeviations?: PackageWithDeviation[];
  onDeviationChange?: (packages: PackageWithDeviation[]) => void;
};

export function PackageManager({
  packages,
  onChange,
  disabled = false,
  showLabel = true,
  compact = false,
  enableDeviationTracking = false,
  packagesWithDeviations = [],
  onDeviationChange
}: PackageManagerProps) {
  const [newPackage, setNewPackage] = useState('');
  const [deviationStates, setDeviationStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    packagesWithDeviations.forEach(pkg => {
      initial[pkg.sscc] = pkg.hasDeviation;
    });
    return initial;
  });
  const [deviationNotes, setDeviationNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    packagesWithDeviations.forEach(pkg => {
      if (pkg.deviationNotes) {
        initial[pkg.sscc] = pkg.deviationNotes;
      }
    });
    return initial;
  });

  const addPackage = () => {
    const trimmed = newPackage.trim();
    if (!trimmed) return;

    if (packages.includes(trimmed)) {
      alert('This SSCC number is already added');
      return;
    }

    onChange([...packages, trimmed]);
    setNewPackage('');
  };

  const removePackage = (index: number) => {
    const removedPkg = packages[index];
    onChange(packages.filter((_, i) => i !== index));

    if (enableDeviationTracking && onDeviationChange) {
      const newDeviationStates = { ...deviationStates };
      const newDeviationNotes = { ...deviationNotes };
      delete newDeviationStates[removedPkg];
      delete newDeviationNotes[removedPkg];
      setDeviationStates(newDeviationStates);
      setDeviationNotes(newDeviationNotes);

      const updatedPackages = packages
        .filter((_, i) => i !== index)
        .map(sscc => ({
          sscc,
          hasDeviation: newDeviationStates[sscc] || false,
          deviationNotes: newDeviationNotes[sscc]
        }));
      onDeviationChange(updatedPackages);
    }
  };

  const toggleDeviation = (sscc: string) => {
    if (!enableDeviationTracking || !onDeviationChange) return;

    const newState = !deviationStates[sscc];
    const newDeviationStates = { ...deviationStates, [sscc]: newState };
    setDeviationStates(newDeviationStates);

    const updatedPackages = packages.map(pkg => ({
      sscc: pkg,
      hasDeviation: newDeviationStates[pkg] || false,
      deviationNotes: deviationNotes[pkg]
    }));
    onDeviationChange(updatedPackages);
  };

  const updateDeviationNote = (sscc: string, note: string) => {
    if (!enableDeviationTracking || !onDeviationChange) return;

    const newDeviationNotes = { ...deviationNotes, [sscc]: note };
    setDeviationNotes(newDeviationNotes);

    const updatedPackages = packages.map(pkg => ({
      sscc: pkg,
      hasDeviation: deviationStates[pkg] || false,
      deviationNotes: newDeviationNotes[pkg]
    }));
    onDeviationChange(updatedPackages);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPackage();
    }
  };

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {showLabel && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          SSCC Numbers / Packages
        </label>
      )}

      <div className={`flex gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <input
          type="text"
          value={newPackage}
          onChange={(e) => setNewPackage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter SSCC number (e.g., HU6827)"
          disabled={disabled}
          className={`flex-1 ${compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100`}
        />
        <button
          type="button"
          onClick={addPackage}
          disabled={disabled || !newPackage.trim()}
          className={`${compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors`}
        >
          <Plus className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          Add
        </button>
      </div>

      {packages.length > 0 && (
        <div className={`bg-slate-50 border border-slate-200 rounded-lg ${compact ? 'p-2 max-h-36' : 'p-3 max-h-48'} overflow-y-auto`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-slate-500">
              {packages.length} package{packages.length !== 1 ? 's' : ''} added
            </div>
            {enableDeviationTracking && (
              <div className="text-xs text-orange-600 font-medium">
                {Object.values(deviationStates).filter(Boolean).length} with deviation
              </div>
            )}
          </div>
          <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {packages.map((pkg, index) => {
              const hasDeviation = deviationStates[pkg] || false;
              const note = deviationNotes[pkg] || '';
              return (
                <div
                  key={index}
                  className={`bg-white rounded border transition-colors ${
                    hasDeviation
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`flex items-center justify-between ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                    <div className="flex items-center gap-2 flex-1">
                      {enableDeviationTracking && !disabled && (
                        <button
                          type="button"
                          onClick={() => toggleDeviation(pkg)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            hasDeviation
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={hasDeviation ? 'Mark as normal' : 'Mark as deviation'}
                        >
                          <AlertTriangle className={`w-3 h-3 ${hasDeviation ? 'text-orange-600' : 'text-slate-400'}`} />
                          {hasDeviation ? 'Has Issue' : 'OK'}
                        </button>
                      )}
                      <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium ${hasDeviation ? 'text-orange-900' : 'text-slate-900'}`}>
                        {pkg}
                      </span>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removePackage(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                        title="Remove package"
                      >
                        <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                      </button>
                    )}
                  </div>
                  {hasDeviation && enableDeviationTracking && !disabled && (
                    <div className={`border-t border-orange-200 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => updateDeviationNote(pkg, e.target.value)}
                        placeholder="Describe the issue (e.g., damaged, missing items, wrong location...)"
                        className="w-full px-2 py-1.5 text-xs border border-orange-300 rounded bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-slate-400"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
