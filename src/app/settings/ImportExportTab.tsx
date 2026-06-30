'use client';

import React, { useState, useEffect } from 'react';
import {
  triggerExportAction,
  getExportHistoryAction,
  downloadExportFileAction
} from '../../lib/actions/exports';
import {
  importProductsAction,
  importCustomersAction,
  importSuppliersAction
} from '../../lib/actions/imports';
import { FileSpreadsheet, Upload, Download, RefreshCw, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportExportTab() {
  const [exportModule, setExportModule] = useState('products');
  const [exportFormat, setExportFormat] = useState('CSV');
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);

  // Import variables
  const [importModule, setImportModule] = useState<'products' | 'customers' | 'suppliers'>('products');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState('');

  // Active background exports polling state
  const [activePollId, setActivePollId] = useState<string | null>(null);

  const fetchExportHistory = async () => {
    try {
      const hist = await getExportHistoryAction();
      setExportHistory(hist);
      
      // If there's an active pending export, enable polling
      const pending = hist.find((h: any) => h.status === 'PENDING');
      if (pending && !activePollId) {
        setActivePollId(pending.id);
      }
    } catch (err) {
      console.error('Failed to load export history:', err);
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, []);

  // Poll background export status
  useEffect(() => {
    if (!activePollId) return;

    const timer = setInterval(async () => {
      try {
        const hist = await getExportHistoryAction();
        setExportHistory(hist);
        const currentTask = hist.find((h: any) => h.id === activePollId);
        if (!currentTask || currentTask.status !== 'PENDING') {
          // Finished or failed
          setActivePollId(null);
          clearInterval(timer);
          if (currentTask && currentTask.status === 'SUCCESS') {
            handleDownload(currentTask.filename, currentTask.format);
          }
        }
      } catch (err) {
        console.error('Error polling export:', err);
        setActivePollId(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activePollId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await triggerExportAction(exportModule, exportFormat);
      if (res.success) {
        const data = res as { background: boolean; exportId?: string; filename?: string };
        if (data.background && data.exportId) {
          setActivePollId(data.exportId);
          alert('Large export triggered in the background. Generating file...');
        } else if (data.filename) {
          // Immediate download
          await handleDownload(data.filename, exportFormat);
        }
        fetchExportHistory();
      } else {
        alert(res.error || 'Failed to trigger export.');
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering export.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async (filename: string, format: string) => {
    try {
      const res = await downloadExportFileAction(filename, format);
      if (res.success && res.content) {
        const base64 = res.content;
        const raw = window.atob(base64);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }

        const blob = new Blob([uInt8Array], { type: res.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || 'Failed to download export file.');
      }
    } catch (err: any) {
      alert(err.message || 'Error downloading export file.');
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportSummary(null);
      setImportError('');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    setImportSummary(null);
    setImportError('');

    const reader = new FileReader();
    const filename = importFile.name.toLowerCase();
    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    const isJson = filename.endsWith('.json');

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        let rows: any[] = [];

        if (isExcel) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(sheet);
        } else if (isJson) {
          rows = JSON.parse(data as string);
        } else {
          // Parse CSV
          const text = data as string;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l);
          if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            rows = lines.slice(1).map(line => {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = values[index];
              });
              return obj;
            });
          }
        }

        // Validate rows parsed
        if (rows.length === 0) {
          throw new Error('The file contains no data rows.');
        }

        // Standardize headers (case-insensitive conversion)
        const normalizedRows = rows.map((r: any) => {
          const norm: any = {};
          Object.keys(r).forEach(k => {
            const key = k.toLowerCase().replace(/[^a-z]/g, '');
            // map approximate keys
            if (key === 'sku') norm.sku = r[k];
            else if (key === 'nameenglish' || key === 'nameen' || key === 'name') norm.nameEn = r[k];
            else if (key === 'namepunjabi' || key === 'namepa') norm.namePa = r[k];
            else if (key === 'purchaseprice' || key === 'costprice' || key === 'cost') norm.purchasePrice = parseFloat(r[k]);
            else if (key === 'sellingprice' || key === 'price') norm.sellingPrice = parseFloat(r[k]);
            else if (key === 'currentquantity' || key === 'qty' || key === 'stock' || key === 'quantity') norm.currentQuantity = parseFloat(r[k]);
            else if (key === 'minstock' || key === 'minalert' || key === 'reorderlevel') norm.minStock = parseFloat(r[k]);
            else if (key === 'unit') norm.unit = r[k];
            else if (key === 'category') norm.category = r[k];
            else if (key === 'brand') norm.brand = r[k];
            else if (key === 'mobile' || key === 'phone') norm.mobile = r[k];
            else if (key === 'email') norm.email = r[k];
            else if (key === 'address') norm.address = r[k];
            else if (key === 'openingbalance') norm.openingBalance = parseFloat(r[k]);
            else if (key === 'gst' || key === 'gstin') norm.gst = r[k];
            else norm[k] = r[k]; // default fallback
          });
          return norm;
        });

        // Trigger Import Server Action
        let res;
        if (importModule === 'products') {
          res = await importProductsAction(normalizedRows);
        } else if (importModule === 'customers') {
          res = await importCustomersAction(normalizedRows);
        } else {
          res = await importSuppliersAction(normalizedRows);
        }

        if (res.success) {
          setImportSummary(res.summary);
          setImportFile(null);
        } else {
          setImportError(res.error || 'Import failed');
        }
      } catch (err: any) {
        console.error(err);
        setImportError(err.message || 'Failed to parse file.');
      } finally {
        setImporting(false);
      }
    };

    if (isExcel) {
      reader.readAsBinaryString(importFile);
    } else {
      reader.readAsText(importFile);
    }
  };

  return (
    <div className="space-y-8">
      {/* Import Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold">ਡਾਟਾ ਇੰਪੋਰਟ ਕਰੋ (Excel / CSV Data Import)</h3>
          <p className="text-xs text-slate-555 dark:text-slate-400 mt-1">
            Import Products, Customers, or Suppliers. Updates details dynamically if duplicates exist (SKU-based for products, name/mobile-based for Khata).
          </p>
        </div>

        <form onSubmit={handleImportSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਇੰਪੋਰਟ ਮੋਡੀਊਲ (Import Module)
              </label>
              <select
                value={importModule}
                onChange={(e) => setImportModule(e.target.value as any)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
              >
                <option value="products">ਉਤਪਾਦ (Products / Inventory)</option>
                <option value="customers">ਗਾਹਕ (Customers / Khata)</option>
                <option value="suppliers">ਸਪਲਾਇਰ (Suppliers / Wholesalers)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਫਾਈਲ ਚੁਣੋ (Choose File - Excel, CSV, JSON)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleImportFileChange}
                className="mt-1.5 w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={importing || !importFile}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Processing Import...' : 'Import Data Now'}
          </button>
        </form>

        {importSummary && (
          <div className="border border-emerald-250 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/15 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-450 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              ਇੰਪੋਰਟ ਸਮਰੀ (Import Summary Completed)
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                <span className="font-extrabold text-sm text-emerald-600 block">{importSummary.imported}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Imported</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                <span className="font-extrabold text-sm text-blue-600 block">{importSummary.updated}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Updated</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5">
                <span className="font-extrabold text-sm text-red-650 block">{importSummary.failed}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">Failed</span>
              </div>
            </div>
          </div>
        )}

        {importError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-500 p-4 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-350 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {importError}
          </div>
        )}
      </div>

      {/* Export Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold">ਡਾਟਾ ਐਕਸਪੋਰਟ ਕਰੋ (Data Export Center)</h3>
          <p className="text-xs text-slate-555 dark:text-slate-400 mt-1">
            Download business datasets in CSV, Excel, or JSON formats. Large exports exceeding 10,000 rows automatically run in the background.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              ਮੋਡੀਊਲ ਚੁਣੋ (Select Module)
            </label>
            <select
              value={exportModule}
              onChange={(e) => setExportModule(e.target.value)}
              className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
            >
              <option value="products">ਉਤਪਾਦ (Products List)</option>
              <option value="inventory">ਸਟਾਕ ਵੈਲਿਊਏਸ਼ਨ (Stock Valuation)</option>
              <option value="customers">ਗਾਹਕ ਖਾਤਾ (Customers / Khata)</option>
              <option value="suppliers">ਸਪਲਾਇਰ ਰਿਕਾਰਡ (Suppliers List)</option>
              <option value="sales">ਬਿਕਰੀ ਇਨਵੌਇਸ (Sales History)</option>
              <option value="purchases">ਖਰੀਦਦਾਰੀ (Purchases PO)</option>
              <option value="expenses">ਖਰਚੇ (Expenses Ledger)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              ਫਾਰਮੈਟ (Format)
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
            >
              <option value="CSV">CSV Spreadsheet</option>
              <option value="EXCEL">Microsoft Excel (.xlsx)</option>
              <option value="JSON">Raw JSON</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={exporting || activePollId !== null}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Processing...' : activePollId ? 'Background Running...' : 'Generate Export'}
            </button>
          </div>
        </div>

        {/* Background Export Progress Indicator */}
        {activePollId && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-blue-750 dark:text-blue-400 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                Large dataset background exporter active...
              </span>
              <span className="text-blue-800 dark:text-blue-300">
                {exportHistory.find(h => h.id === activePollId)?.progress || 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-850 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportHistory.find(h => h.id === activePollId)?.progress || 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Exports history lists */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-450">Past Exports (ਪਿਛਲੇ ਨਿਰਯਾਤ)</h3>
          <div className="overflow-x-auto text-xs max-h-56">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400">
                  <th className="py-2 font-bold">Date</th>
                  <th className="py-2 font-bold">Module</th>
                  <th className="py-2 font-bold">Format</th>
                  <th className="py-2 font-bold">Size</th>
                  <th className="py-2 font-bold">Status</th>
                  <th className="py-2 font-bold text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {exportHistory.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 font-semibold text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 font-bold uppercase text-slate-600 dark:text-slate-300">{row.module}</td>
                    <td className="py-2.5 text-slate-550">{row.format}</td>
                    <td className="py-2.5 text-slate-500">
                      {row.fileSize ? (row.fileSize / 1024).toFixed(2) + ' KB' : '-'}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${row.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : row.status === 'PENDING' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20' : 'bg-red-50 text-red-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {row.status === 'SUCCESS' && (
                        <button
                          onClick={() => handleDownload(row.filename, row.format)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-blue-600 dark:text-blue-400"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {exportHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-semibold">
                      No exports generated yet.
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
