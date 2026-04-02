import { useEffect, useState } from 'react';
import {
  X,
  Package as PackageIcon,
  MapPin,
  Truck,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Circle,
  History
} from 'lucide-react';
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
    start: string;
  };
  deviation?: {
    id: string;
    deviation_type: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
  };
};

type PackageDetailsModalProps = {
  packageData: Package;
  onClose: () => void;
};

export function PackageDetailsModal({ packageData, onClose }: PackageDetailsModalProps) {
  const [pkg, setPkg] = useState(packageData);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFullDetails();
  }, [packageData.id]);

  const loadFullDetails = async () => {
    setLoading(true);
    try {
      const { data: fullPackage, error: pkgError } = await supabase
        .from('packages')
        .select(`
          *,
          shipment:shipments!packages_shipment_id_fkey(
            id,
            title,
            car_reg_no,
            status,
            assigned_operators,
            completed_at,
            start
          )
        `)
        .eq('id', packageData.id)
        .single();

      if (pkgError) throw pkgError;

      if (fullPackage.has_deviation) {
        const { data: deviation } = await supabase
          .from('package_deviations')
          .select('*')
          .eq('package_id', fullPackage.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        fullPackage.deviation = deviation;
      }

      setPkg(fullPackage);

      if (fullPackage.shipment_id) {
        const { data: shipmentPackages } = await supabase
          .from('packages')
          .select('*')
          .eq('shipment_id', fullPackage.shipment_id)
          .order('sscc_number');

        if (shipmentPackages) {
          setAllPackages(shipmentPackages);
        }
      }
    } catch (error) {
      console.error('Error loading package details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'stored':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Circle className="w-5 h-5 text-yellow-600" />;
      default:
        return <XCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getDeviationStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'escalated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <PackageIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Package Details</h2>
              <p className="text-sm text-slate-600">{pkg.sscc_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-slate-600">Loading package details...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <PackageIcon className="w-4 h-4" />
                  Package Information
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-slate-600">SSCC Number</span>
                    <span className="text-sm font-medium text-slate-900">
                      {pkg.sscc_number}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-slate-600">Status</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(pkg.status)}
                      <span className="text-sm font-medium text-slate-900 capitalize">
                        {pkg.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-slate-600">Has Issues</span>
                    <span
                      className={`text-sm font-medium ${
                        pkg.has_deviation ? 'text-orange-700' : 'text-green-700'
                      }`}
                    >
                      {pkg.has_deviation ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-slate-600">Created</span>
                    <span className="text-sm text-slate-900">
                      {new Date(pkg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-slate-600">Last Updated</span>
                    <span className="text-sm text-slate-900">
                      {new Date(pkg.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Storage Location
                </h3>
                {pkg.storage_location ? (
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <p className="text-sm font-medium text-slate-900">
                      {pkg.storage_location}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 italic">No storage location recorded</p>
                )}
              </div>
            </div>

            {pkg.shipment && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4" />
                  Shipment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Shipment Title</p>
                    <p className="text-sm font-medium text-slate-900">{pkg.shipment.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Vehicle Registration</p>
                    <p className="text-sm font-medium text-slate-900">{pkg.shipment.car_reg_no}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Shipment Status</p>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium capitalize ${
                        pkg.shipment.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : pkg.shipment.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {pkg.shipment.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Delivery Date</p>
                    <p className="text-sm text-slate-900 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(pkg.shipment.start).toLocaleDateString()}
                    </p>
                  </div>
                  {pkg.shipment.assigned_operators && pkg.shipment.assigned_operators.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-600 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Assigned Operators
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pkg.shipment.assigned_operators.map((operator, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {operator}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {pkg.shipment.completed_at && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-600 mb-1">Completed At</p>
                      <p className="text-sm text-slate-900 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(pkg.shipment.completed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {pkg.has_deviation && pkg.deviation && (
              <div className="bg-orange-50 rounded-lg border-2 border-orange-200 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-orange-900 mb-1">
                      Deviation Reported
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getDeviationStatusColor(
                          pkg.deviation.status
                        )}`}
                      >
                        {pkg.deviation.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${getPriorityColor(
                          pkg.deviation.priority
                        )}`}
                      >
                        {pkg.deviation.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 capitalize">
                        {pkg.deviation.deviation_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 mb-3 border border-orange-200">
                  <p className="text-xs font-medium text-slate-700 mb-2">Description</p>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">
                    {pkg.deviation.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-600 mb-1">Reported</p>
                    <p className="text-slate-900">
                      {new Date(pkg.deviation.created_at).toLocaleString()}
                    </p>
                  </div>
                  {pkg.deviation.resolved_at && (
                    <div>
                      <p className="text-slate-600 mb-1">Resolved</p>
                      <p className="text-slate-900">
                        {new Date(pkg.deviation.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {allPackages.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <History className="w-4 h-4" />
                  All Packages in This Shipment ({allPackages.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {allPackages.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                        p.id === pkg.id
                          ? 'bg-blue-50 border-blue-300'
                          : p.has_deviation
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PackageIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {p.sscc_number}
                        </span>
                        {p.id === pkg.id && (
                          <span className="text-xs text-blue-600 font-medium">(Current)</span>
                        )}
                        {p.has_deviation && (
                          <AlertTriangle className="w-3 h-3 text-orange-600" />
                        )}
                      </div>
                      <span className="text-xs text-slate-600">{p.storage_location || 'No location'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
