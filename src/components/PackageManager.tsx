import { useState } from 'react';
import { Plus, X } from 'lucide-react';

type PackageManagerProps = {
  packages: string[];
  onChange: (packages: string[]) => void;
  disabled?: boolean;
  showLabel?: boolean;
  compact?: boolean;
};

export function PackageManager({
  packages,
  onChange,
  disabled = false,
  showLabel = true,
  compact = false
}: PackageManagerProps) {
  const [newPackage, setNewPackage] = useState('');

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
    onChange(packages.filter((_, i) => i !== index));
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
          <div className="text-xs font-medium text-slate-500 mb-2">
            {packages.length} package{packages.length !== 1 ? 's' : ''} added
          </div>
          <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {packages.map((pkg, index) => (
              <div
                key={index}
                className={`flex items-center justify-between bg-white ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} rounded border border-slate-200 hover:border-slate-300 transition-colors`}
              >
                <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-900`}>{pkg}</span>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
