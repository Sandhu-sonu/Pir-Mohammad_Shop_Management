'use client';

import React, { useEffect, useState } from 'react';
import {
  createBackupAction,
  downloadBackupAction,
  restoreBackupAction,
  previewBackupAction,
  getBackupHistoryAction,
  getRestoreLogsAction
} from '../../lib/actions/backups';
import { Download, Upload, RefreshCw, AlertTriangle, FileText, CheckCircle, ShieldAlert } from 'lucide-react';

export default function BackupRestoreTab() {
  const [history, setHistory] = useState<any[]>([]);
  const [restoreLogs, setRestoreLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Restore file variables
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [previewError, setPreviewError] = useState('');
  const [restoring, setRestoring] = useState(false);

  const fetchHistory = async () => {
    try {
      const hist = await getBackupHistoryAction();
      setHistory(hist);
      const logs = await getRestoreLogsAction();
      setRestoreLogs(logs);
    } catch (err) {
      console.error('Failed to load backup logs:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 5000);
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const res = await createBackupAction('Manual backup created from Settings page.');
      if (res.success) {
        showMsg('ਬੈਕਅੱਪ ਸਫਲਤਾਪੂਰਵਕ ਤਿਆਰ ਕੀਤਾ ਗਿਆ (Backup generated successfully!)', 'success');
        fetchHistory();
      } else {
        showMsg(res.error || 'Failed to generate backup.', 'error');
      }
    } catch (err: any) {
      showMsg(err.message || 'Error generating backup.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await downloadBackupAction(filename);
      if (res.success && res.content) {
        const blob = new Blob([res.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || 'Failed to download backup file');
      }
    } catch (err: any) {
      alert(err.message || 'Error downloading file');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setBackupPreview(null);
    setPreviewError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setFileContent(content);

      try {
        const res = await previewBackupAction(content);
        if (res.success) {
          setBackupPreview(res.preview);
        } else {
          setPreviewError(res.error || 'Invalid backup structure.');
        }
      } catch (err: any) {
        setPreviewError(err.message || 'Error parsing backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!fileContent) return;
    if (!confirm('WARNING: Restoring this backup will replace all current business records with backup files. Any modifications since backup was created will be lost. Proceed?')) {
      return;
    }

    setRestoring(true);
    try {
      const res = await restoreBackupAction(fileContent);
      if (res.success) {
        alert('Database Restored Successfully! / ਬੈਕਅੱਪ ਸਫਲਤਾਪੂਰਵਕ ਬਹਾਲ ਕੀਤਾ ਗਿਆ!');
        setUploadFile(null);
        setBackupPreview(null);
        setFileContent('');
        fetchHistory();
      } else {
        alert(res.error || 'Failed to restore database.');
      }
    } catch (err: any) {
      alert(err.message || 'Error performing restore.');
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {actionMsg && (
        <div className={`p-4 rounded-xl border font-semibold text-sm flex items-center gap-3 ${actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450' : 'bg-red-50 border-red-500 text-red-800 dark:bg-red-950/20 dark:text-red-450'}`}>
          {actionMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />}
          {actionMsg.text}
        </div>
      )}

      {/* Manual Backup Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold">ਬੈਕਅੱਪ ਬਣਾਓ (Create Database Backup)</h3>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
            Generate a full business data backup file. Auto-prunes entries exceeding the latest 30 backups.
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          {loading ? 'Generating...' : 'Create Manual Backup'}
        </button>
      </div>

      {/* Restore Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold">ਬੈਕਅੱਪ ਰੀਸਟੋਰ ਕਰੋ (Restore Database)</h3>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
            Upload your shop's backup JSON payload to restore. Process is transaction-isolated and rolls back fully on failures.
          </p>
        </div>

        {/* Upload box */}
        <div className="border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 relative">
          <Upload className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-bold text-slate-500">
            {uploadFile ? uploadFile.name : 'Select or drop backup file (.json)'}
          </p>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            disabled={restoring}
          />
        </div>

        {/* Preview block */}
        {backupPreview && (
          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-450 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Backup Preview Summary (ਵੇਰਵਾ ਦੇਖੋ)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block">Backup Version</span>
                <span className="font-extrabold text-sm dark:text-white mt-0.5 block">{backupPreview.backupVersion}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Backup Date</span>
                <span className="font-extrabold text-sm dark:text-white mt-0.5 block">
                  {new Date(backupPreview.backupDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Schema Version</span>
                <span className="font-extrabold text-sm dark:text-white mt-0.5 block">{backupPreview.schemaVersion}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">App Version</span>
                <span className="font-extrabold text-sm dark:text-white mt-0.5 block">{backupPreview.appVersion}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-xs grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center">
                <span className="font-extrabold text-sm block">{backupPreview.products}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Products</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center">
                <span className="font-extrabold text-sm block">{backupPreview.customers}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Customers</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center">
                <span className="font-extrabold text-sm block">{backupPreview.sales}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Sales</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center">
                <span className="font-extrabold text-sm block">{backupPreview.purchases}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Purchases</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center col-span-3 sm:col-span-1">
                <span className="font-extrabold text-sm block">{backupPreview.expenses}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Expenses</span>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 border border-red-500 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-red-800 dark:text-red-350 leading-relaxed">
                WARNING (ਚੇਤਾਵਨੀ): Restoring this backup will replace current operational data with backup files. Any entries registered since backup creation will be lost. Shared databases (other tenants) will NOT be affected.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-red-600/10 transition"
              >
                {restoring ? 'Restoring Database...' : 'Confirm Restore (ਰੀਸਟੋਰ ਕਰੋ)'}
              </button>
              <button
                onClick={() => {
                  setUploadFile(null);
                  setBackupPreview(null);
                }}
                disabled={restoring}
                className="px-5 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs text-slate-650 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {previewError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-500 p-4 rounded-xl flex items-center gap-3 text-red-850 dark:text-red-350 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {previewError}
          </div>
        )}
      </div>

      {/* History log lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backups history list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-450">Backup History (ਪਿਛਲੇ ਬੈਕਅੱਪ)</h3>
          <div className="overflow-x-auto text-xs max-h-60">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400">
                  <th className="py-2.5 font-bold">Date</th>
                  <th className="py-2.5 font-bold">Size</th>
                  <th className="py-2.5 font-bold">Status</th>
                  <th className="py-2.5 font-bold text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 font-semibold text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-slate-500">{formatSize(row.fileSize)}</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${row.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-red-50 text-red-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {row.status === 'SUCCESS' && (
                        <button
                          onClick={() => handleDownload(row.filename)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-blue-600 dark:text-blue-400"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                      No backups created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restores performed logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-450">Restore Log (ਰੀਸਟੋਰ ਰਿਕਾਰਡ)</h3>
          <div className="overflow-x-auto text-xs max-h-60">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400">
                  <th className="py-2.5 font-bold">Timestamp</th>
                  <th className="py-2.5 font-bold">User</th>
                  <th className="py-2.5 font-bold">Status</th>
                  <th className="py-2.5 font-bold text-right">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {restoreLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 font-semibold text-slate-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-slate-500">{row.restoredBy?.name || 'System'}</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${row.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-red-50 text-red-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-red-500 truncate max-w-32" title={row.error || ''}>
                      {row.error || '-'}
                    </td>
                  </tr>
                ))}
                {restoreLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                      No restore actions logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
