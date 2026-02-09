import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Upload, AlertCircle, CheckCircle2, Clock, Database, FileJson } from 'lucide-react';

export function BackupRestoreTab() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const createBackup = async () => {
    setIsBackingUp(true);
    setError('');
    setSuccess('');
    setBackupStatus('Fetching data...');

    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

      setBackupStatus('Exporting shipments...');
      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (shipmentsError) throw shipmentsError;

      setBackupStatus('Exporting operators...');
      const { data: operators, error: operatorsError } = await supabase
        .from('operators')
        .select('*')
        .order('created_at', { ascending: false });

      if (operatorsError) throw operatorsError;

      setBackupStatus('Exporting packages...');
      const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (packagesError) throw packagesError;

      setBackupStatus('Exporting user profiles...');
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');

      if (profilesError) throw profilesError;

      setBackupStatus('Exporting notifications...');
      const { data: notificationSettings, error: notifError } = await supabase
        .from('notification_settings')
        .select('*');

      if (notifError) throw notifError;

      setBackupStatus('Exporting audit logs...');
      const { data: auditLogs, error: auditError } = await supabase
        .from('shipment_audit_log')
        .select('*')
        .order('action_timestamp', { ascending: false })
        .limit(1000);

      if (auditError) throw auditError;

      setBackupStatus('Creating backup file...');
      const backup = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          recordCounts: {
            shipments: shipments?.length || 0,
            operators: operators?.length || 0,
            packages: packages?.length || 0,
            userProfiles: userProfiles?.length || 0,
            notificationSettings: notificationSettings?.length || 0,
            auditLogs: auditLogs?.length || 0
          }
        },
        data: {
          shipments: shipments || [],
          operators: operators || [],
          packages: packages || [],
          user_profiles: userProfiles || [],
          notification_settings: notificationSettings || [],
          audit_logs: auditLogs || []
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-system-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Backup created successfully! Downloaded ${backup.metadata.recordCounts.shipments} shipments, ${backup.metadata.recordCounts.operators} operators, ${backup.metadata.recordCounts.packages} packages, and more.`);
      setBackupStatus('');
    } catch (err) {
      console.error('Backup failed:', err);
      setError(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setBackupStatus('');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setError('');
    setSuccess('');
    setRestoreStatus('Reading backup file...');

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.metadata || !backup.data) {
        throw new Error('Invalid backup file format');
      }

      const confirmed = window.confirm(
        `This will restore data from ${new Date(backup.metadata.timestamp).toLocaleString()}.\n\n` +
        `Records to restore:\n` +
        `- Shipments: ${backup.metadata.recordCounts.shipments}\n` +
        `- Operators: ${backup.metadata.recordCounts.operators}\n` +
        `- Packages: ${backup.metadata.recordCounts.packages}\n\n` +
        `WARNING: This will delete ALL existing data and replace it with backup data.\n\n` +
        `Are you absolutely sure you want to continue?`
      );

      if (!confirmed) {
        setIsRestoring(false);
        setRestoreStatus('');
        return;
      }

      const doubleConfirm = window.confirm(
        'FINAL CONFIRMATION: This action cannot be undone. All current data will be permanently deleted. Continue?'
      );

      if (!doubleConfirm) {
        setIsRestoring(false);
        setRestoreStatus('');
        return;
      }

      setRestoreStatus('Deleting existing packages...');
      await supabase.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      setRestoreStatus('Deleting existing shipments...');
      await supabase.from('shipments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      setRestoreStatus('Restoring operators...');
      if (backup.data.operators && backup.data.operators.length > 0) {
        const { error: opError } = await supabase
          .from('operators')
          .upsert(backup.data.operators, { onConflict: 'id' });
        if (opError) throw opError;
      }

      setRestoreStatus('Restoring shipments...');
      if (backup.data.shipments && backup.data.shipments.length > 0) {
        const { error: shipError } = await supabase
          .from('shipments')
          .insert(backup.data.shipments);
        if (shipError) throw shipError;
      }

      setRestoreStatus('Restoring packages...');
      if (backup.data.packages && backup.data.packages.length > 0) {
        const { error: pkgError } = await supabase
          .from('packages')
          .insert(backup.data.packages);
        if (pkgError) throw pkgError;
      }

      setRestoreStatus('Restoring notification settings...');
      if (backup.data.notification_settings && backup.data.notification_settings.length > 0) {
        const { error: notifError } = await supabase
          .from('notification_settings')
          .upsert(backup.data.notification_settings, { onConflict: 'id' });
        if (notifError) throw notifError;
      }

      setSuccess(`Restore completed successfully! Restored ${backup.metadata.recordCounts.shipments} shipments, ${backup.metadata.recordCounts.operators} operators, and ${backup.metadata.recordCounts.packages} packages.`);
      setRestoreStatus('');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Restore failed:', err);
      setError(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRestoreStatus('');
    } finally {
      setIsRestoring(false);
      event.target.value = '';
    }
  };

  const createQuickExport = async () => {
    setIsBackingUp(true);
    setError('');
    setSuccess('');
    setBackupStatus('Exporting shipments to CSV...');

    try {
      const { data: shipments, error } = await supabase
        .from('shipments_with_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!shipments || shipments.length === 0) {
        throw new Error('No shipments found to export');
      }

      const headers = [
        'ID',
        'Row ID',
        'Title',
        'Start Date',
        'Car Registration',
        'SSCC Numbers',
        'Storage Location',
        'Assigned Operators',
        'Status',
        'Notes',
        'Is Delivery',
        'Created At',
        'Created By',
        'Updated At',
        'Updated By',
        'Completed At',
        'Completed By'
      ];

      const csvRows = [
        headers.join(','),
        ...shipments.map(s => [
          s.id,
          s.row_id,
          `"${(s.title || '').replace(/"/g, '""')}"`,
          s.start || '',
          `"${(s.car_reg_no || '').replace(/"/g, '""')}"`,
          `"${(s.sscc_numbers || '').replace(/"/g, '""')}"`,
          `"${(s.storage_location || '').replace(/"/g, '""')}"`,
          `"${(s.assigned_operators || []).join('; ')}"`,
          s.status,
          `"${(s.notes || '').replace(/"/g, '""')}"`,
          s.is_delivery ? 'Yes' : 'No',
          s.created_at,
          s.created_by_email || '',
          s.updated_at,
          s.updated_by_email || '',
          s.completed_at || '',
          s.completed_by_email || ''
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipments-export-${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Exported ${shipments.length} shipments to CSV successfully!`);
      setBackupStatus('');
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setBackupStatus('');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Database Backup & Restore</h2>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Create complete backups of all system data or restore from previous backups. Backups include shipments, operators, packages, and all related data.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900">Success</p>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
          </div>
        )}

        {(backupStatus || restoreStatus) && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
            <p className="text-sm text-blue-900">{backupStatus || restoreStatus}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Create Backup
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Download a complete JSON backup of all system data. This includes shipments, operators, packages, user profiles, notification settings, and recent audit logs.
            </p>
            <button
              onClick={createBackup}
              disabled={isBackingUp || isRestoring}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              {isBackingUp ? 'Creating Backup...' : 'Download Full Backup'}
            </button>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-green-600" />
                Quick CSV Export
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                Export shipments to CSV format for spreadsheet analysis.
              </p>
              <button
                onClick={createQuickExport}
                disabled={isBackingUp || isRestoring}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-600" />
              Restore from Backup
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Restore system data from a previously created backup file. This will replace all current data with the backup data.
            </p>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Warning</p>
              <p className="text-xs text-amber-800">
                Restoring from backup will permanently delete all current data and replace it with backup data. This action cannot be undone. Always create a backup before restoring.
              </p>
            </div>
            <label className="block">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={isBackingUp || isRestoring}
                className="hidden"
                id="restore-file-input"
              />
              <label
                htmlFor="restore-file-input"
                className={`w-full px-4 py-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer ${
                  isBackingUp || isRestoring
                    ? 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
                }`}
              >
                <Upload className="w-4 h-4" />
                {isRestoring ? 'Restoring...' : 'Select Backup File to Restore'}
              </label>
            </label>
            <p className="text-xs text-slate-500 mt-2">
              Supported format: JSON backup files created by this system
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Backup Best Practices</h4>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>Create regular backups (daily or weekly recommended)</li>
            <li>Store backups in a secure, off-site location</li>
            <li>Test restore procedures periodically to ensure backups work</li>
            <li>Always create a fresh backup before performing system maintenance</li>
            <li>Keep multiple backup versions (don't overwrite old backups immediately)</li>
            <li>Document when backups were created and what they contain</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
