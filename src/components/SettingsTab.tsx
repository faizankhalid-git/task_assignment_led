import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { testSheetConnection } from '../services/googleSheets';
import { Check, X, Loader2 } from 'lucide-react';

export function SettingsTab() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [worksheetName, setWorksheetName] = useState('Live');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['spreadsheet_id', 'worksheet_name']);

    if (data) {
      const settings = Object.fromEntries(data.map(s => [s.key, s.value]));
      setSpreadsheetId(settings.spreadsheet_id || '');
      setWorksheetName(settings.worksheet_name || 'Live');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    const result = await testSheetConnection(spreadsheetId, worksheetName);

    if (result.success) {
      setTestResult({
        success: true,
        message: `Connection successful! Found ${result.rowCount} rows.`
      });
    } else {
      setTestResult({
        success: false,
        message: result.error || 'Connection failed'
      });
    }

    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);

    await supabase.from('app_settings').upsert([
      { key: 'spreadsheet_id', value: spreadsheetId },
      { key: 'worksheet_name', value: worksheetName }
    ], { onConflict: 'key' });

    setSaving(false);
    setTestResult({ success: true, message: 'Settings saved successfully!' });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Google Sheets Connection</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="spreadsheetId" className="block text-sm font-medium text-slate-700 mb-1">
            Spreadsheet ID
          </label>
          <input
            id="spreadsheetId"
            type="text"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="1A2B3C4D5E6F7G8H9I0J..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Find this in your Google Sheets URL between /d/ and /edit
          </p>
        </div>

        <div>
          <label htmlFor="worksheetName" className="block text-sm font-medium text-slate-700 mb-1">
            Worksheet Name
          </label>
          <input
            id="worksheetName"
            type="text"
            value={worksheetName}
            onChange={(e) => setWorksheetName(e.target.value)}
            placeholder="Live"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 p-4 rounded-lg ${
            testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {testResult.success ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{testResult.message}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !spreadsheetId}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Test Connection
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !spreadsheetId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg">
        <h3 className="font-medium text-slate-900 mb-2">Required Columns</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• sscc_numbers</li>
          <li>• title</li>
          <li>• start</li>
          <li>• Car reg no</li>
        </ul>
      </div>
    </div>
  );
}
