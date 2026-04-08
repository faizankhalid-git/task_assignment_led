import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ImportRecord = {
  packageId: string;
  description?: string;
  location: string;
  arrivalDate: string;
  limitWeeks?: number;
  notes?: string;
};

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

export function BulkImportTab() {
  const [importType, setImportType] = useState<'incoming' | 'delivered'>('incoming');
  const [csvData, setCsvData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const sampleCSV = `Package ID,Description,Location,Arrival Date,Limit Weeks,Notes
G134U12G-3,HMP,ML2-B1,1/26/26,6,
G134U12E-3,HMP,ML2-B1,1/26/26,6,
U419379,,ML4-B4,1/26/26,6,
U427568,,ML2-B2,1/26/26,6,
U423481,,ML2-B1,1/26/26,6,`;

  const parseCSV = (csv: string): ImportRecord[] => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const records: ImportRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      const packageIdIndex = headers.findIndex(h => h.includes('package') || h.includes('id') || h.includes('sscc'));
      const locationIndex = headers.findIndex(h => h.includes('location'));
      const dateIndex = headers.findIndex(h => h.includes('arrival') || h.includes('date'));
      const descIndex = headers.findIndex(h => h.includes('description') || h.includes('desc'));
      const weeksIndex = headers.findIndex(h => h.includes('week') || h.includes('limit'));
      const notesIndex = headers.findIndex(h => h.includes('note'));

      if (packageIdIndex >= 0 && values[packageIdIndex]) {
        records.push({
          packageId: values[packageIdIndex],
          description: descIndex >= 0 ? values[descIndex] : undefined,
          location: locationIndex >= 0 ? values[locationIndex] : '',
          arrivalDate: dateIndex >= 0 ? values[dateIndex] : '',
          limitWeeks: weeksIndex >= 0 && values[weeksIndex] ? parseInt(values[weeksIndex]) : undefined,
          notes: notesIndex >= 0 ? values[notesIndex] : undefined,
        });
      }
    }

    return records;
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();

    // Handle MM/DD/YY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let [month, day, year] = parts;

      // Handle 2-digit year
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }

      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString();
    }

    // Try to parse as-is
    return new Date(dateStr).toISOString();
  };

  const processImport = async () => {
    if (!csvData.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const records = parseCSV(csvData);
      const errors: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get the current max row_id to generate unique values
      const { data: maxRowData } = await supabase
        .from('shipments')
        .select('row_id')
        .order('row_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextRowId = (maxRowData?.row_id || 0) + 1;

      for (const record of records) {
        try {
          if (importType === 'incoming') {
            // Create incoming shipment
            const { data: shipment, error: shipmentError } = await supabase
              .from('shipments')
              .insert({
                row_id: nextRowId++,
                title: record.description || `Import: ${record.packageId}`,
                sscc_numbers: record.packageId,
                storage_location: record.location,
                start: parseDate(record.arrivalDate),
                status: 'completed',
                shipment_type: 'incoming',
                created_by: user.id,
                completed_by: user.id,
                completed_at: parseDate(record.arrivalDate),
                notes: record.notes || `Imported historical data. Limit: ${record.limitWeeks || 'N/A'} weeks`,
                archived: false,
              })
              .select()
              .single();

            if (shipmentError) throw shipmentError;

            // Create package entry as stored
            const { error: packageError } = await supabase
              .from('packages')
              .insert({
                shipment_id: shipment.id,
                sscc_number: record.packageId,
                storage_location: record.location,
                status: 'stored',
                created_at: parseDate(record.arrivalDate),
                updated_at: parseDate(record.arrivalDate),
              });

            if (packageError) throw packageError;

          } else {
            // For delivered: Find the package and create outgoing shipment
            const { data: existingPkg, error: findError } = await supabase
              .from('packages')
              .select('id, shipment_id, sscc_number')
              .eq('sscc_number', record.packageId)
              .eq('status', 'stored')
              .maybeSingle();

            if (findError) throw findError;

            if (!existingPkg) {
              errors.push(`Package ${record.packageId} not found in stored packages`);
              failedCount++;
              continue;
            }

            // Create outgoing shipment
            const { data: outgoingShipment, error: shipmentError } = await supabase
              .from('shipments')
              .insert({
                row_id: nextRowId++,
                title: record.description || `Delivery: ${record.packageId}`,
                sscc_numbers: record.packageId,
                storage_location: record.location,
                start: parseDate(record.arrivalDate),
                status: 'completed',
                shipment_type: 'outgoing',
                created_by: user.id,
                completed_by: user.id,
                completed_at: parseDate(record.arrivalDate),
                notes: record.notes || 'Imported historical delivery data',
                archived: false,
              })
              .select()
              .single();

            if (shipmentError) throw shipmentError;

            // Update package status to pending (delivered)
            const { error: updateError } = await supabase
              .from('packages')
              .update({
                status: 'pending',
                updated_at: parseDate(record.arrivalDate),
              })
              .eq('id', existingPkg.id);

            if (updateError) throw updateError;
          }

          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push(`${record.packageId}: ${err.message}`);
        }
      }

      setResult({
        success: successCount,
        failed: failedCount,
        errors,
      });

    } catch (err: any) {
      setResult({
        success: 0,
        failed: 0,
        errors: [err.message],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
      setShowInstructions(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Bulk Import Historical Data</h2>
            <p className="text-sm text-slate-600 mt-1">Import package arrival and delivery records from Excel/CSV</p>
          </div>
        </div>

        {/* Import Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Import Type</label>
          <div className="flex gap-4">
            <button
              onClick={() => setImportType('incoming')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                importType === 'incoming'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="font-semibold">Incoming Packages</div>
              <div className="text-xs mt-1 opacity-80">Packages that arrived at warehouse</div>
            </button>
            <button
              onClick={() => setImportType('delivered')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                importType === 'delivered'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="font-semibold">Delivered Packages</div>
              <div className="text-xs mt-1 opacity-80">Packages that were delivered out</div>
            </button>
          </div>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">CSV Format Instructions</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Your CSV file should have the following columns (order doesn't matter):
                </p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li><strong>Package ID / SSCC Number</strong> - Required</li>
                  <li><strong>Location</strong> - Storage location</li>
                  <li><strong>Arrival Date / Date</strong> - Date in MM/DD/YY or MM/DD/YYYY format</li>
                  <li><strong>Description</strong> - Optional description</li>
                  <li><strong>Limit Weeks</strong> - Optional limit in weeks</li>
                  <li><strong>Notes</strong> - Optional notes</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Sample CSV:</p>
                  <pre className="text-xs bg-white p-2 rounded border border-blue-200 overflow-x-auto">
                    {sampleCSV}
                  </pre>
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Upload CSV File</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Choose File
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {csvData && (
              <span className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                File loaded ({csvData.split('\n').length - 1} rows)
              </span>
            )}
          </div>
        </div>

        {/* CSV Preview/Editor */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">CSV Data</label>
          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="Paste your CSV data here or upload a file above..."
            className="w-full h-64 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            You can paste Excel data directly (copy from Excel and paste here)
          </p>
        </div>

        {/* Process Button */}
        <button
          onClick={processImport}
          disabled={!csvData.trim() || isProcessing}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import {importType === 'incoming' ? 'Incoming' : 'Delivered'} Packages
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={`mt-6 p-4 rounded-lg border-2 ${
            result.failed === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-start gap-3">
              {result.failed === 0 ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  result.failed === 0 ? 'text-green-900' : 'text-orange-900'
                }`}>
                  Import Complete
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-green-700">
                    ✓ Successfully imported: <strong>{result.success}</strong> packages
                  </p>
                  {result.failed > 0 && (
                    <p className="text-orange-700">
                      ✗ Failed: <strong>{result.failed}</strong> packages
                    </p>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <p className="text-sm font-semibold text-orange-900 mb-2">Errors:</p>
                    <div className="max-h-40 overflow-y-auto">
                      {result.errors.map((error, index) => (
                        <p key={index} className="text-xs text-orange-800 mb-1">• {error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
