import { useState } from 'react';
import { Search, Package as PackageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Package = {
  id: string;
  sscc_number: string;
  shipment_id: string;
  storage_location: string | null;
  status: string;
  has_deviation: boolean;
  created_at: string;
  updated_at: string;
  shipment?: {
    id: string;
    title: string;
    car_reg_no: string;
    status: string;
    assigned_operators: string[];
    completed_at: string | null;
  };
  deviation?: {
    id: string;
    deviation_type: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
  };
};

type PackageSearchProps = {
  onSelectPackage: (pkg: Package) => void;
};

export function PackageSearch({ onSelectPackage }: PackageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Package[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setSearching(true);
    setSearched(true);

    try {
      const { data: packages, error } = await supabase
        .from('packages')
        .select(`
          *,
          shipment:shipments!packages_shipment_id_fkey(
            id,
            title,
            car_reg_no,
            status,
            assigned_operators,
            completed_at
          )
        `)
        .ilike('sscc_number', `%${searchTerm.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (packages) {
        const packagesWithDeviations = await Promise.all(
          packages.map(async (pkg) => {
            if (pkg.has_deviation) {
              const { data: deviation } = await supabase
                .from('package_deviations')
                .select('id, deviation_type, description, status, priority, created_at')
                .eq('package_id', pkg.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              return { ...pkg, deviation };
            }
            return pkg;
          })
        );

        setResults(packagesWithDeviations);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Package Search</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by SSCC number (e.g., HU6827)"
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchTerm.trim() || searching}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
          >
            {searching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>
      </div>

      {searched && (
        <div className="bg-white rounded-lg border border-slate-200">
          {searching ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-slate-600">Searching packages...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <PackageIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-900 mb-1">No packages found</p>
              <p className="text-xs text-slate-500">
                Try searching with a different SSCC number
              </p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <p className="text-sm font-medium text-slate-700">
                  Found {results.length} package{results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                {results.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => onSelectPackage(pkg)}
                    className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PackageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-semibold text-slate-900">
                            {pkg.sscc_number}
                          </span>
                          {pkg.has_deviation && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              Has Issue
                            </span>
                          )}
                        </div>
                        {pkg.shipment && (
                          <p className="text-sm text-slate-600 truncate">
                            {pkg.shipment.title}
                          </p>
                        )}
                        {pkg.storage_location && (
                          <p className="text-xs text-slate-500 mt-1">
                            Location: {pkg.storage_location}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            pkg.status === 'stored'
                              ? 'bg-green-100 text-green-800'
                              : pkg.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {pkg.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(pkg.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
