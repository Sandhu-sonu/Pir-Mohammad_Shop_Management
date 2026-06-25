'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  FileSpreadsheet,
  FileText,
  TrendingUp,
  PackageCheck,
  UserX,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface ReportsClientProps {
  salesReport: any[];
  inventoryReport: any[];
  duesReport: any[];
  fastMoving: any[];
  slowMoving: any[];
}

type ReportTab = 'sales' | 'inventory' | 'dues' | 'velocity';

export default function ReportsClient({
  salesReport,
  inventoryReport,
  duesReport,
  fastMoving,
  slowMoving,
}: ReportsClientProps) {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  const exportExcel = () => {
    let dataToExport: any[] = [];
    let filename = '';

    if (activeTab === 'sales') {
      dataToExport = salesReport;
      filename = 'sales_report.xlsx';
    } else if (activeTab === 'inventory') {
      dataToExport = inventoryReport;
      filename = 'inventory_report.xlsx';
    } else if (activeTab === 'dues') {
      dataToExport = duesReport;
      filename = 'customer_dues_report.xlsx';
    } else if (activeTab === 'velocity') {
      dataToExport = fastMoving.map((p, idx) => ({
        Rank: idx + 1,
        Product: p.nameEn,
        SoldQty: p.qtySold,
        Unit: p.unit,
      }));
      filename = 'product_velocity_report.xlsx';
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, filename);
  };

  const exportPdf = () => {
    const doc = new jsPDF() as any;
    doc.text(`${t('reports')} - ${activeTab.toUpperCase()}`, 14, 15);

    let columns: string[] = [];
    let rows: any[][] = [];

    if (activeTab === 'sales') {
      columns = ['Date', 'Total Sales (INR)', 'Paid Amount (INR)', 'Due Amount (INR)'];
      rows = salesReport.map((s) => [s.date, `Rs ${s.total}`, `Rs ${s.paid}`, `Rs ${s.due}`]);
    } else if (activeTab === 'inventory') {
      columns = ['SKU', 'Product Name', 'Stock Qty', 'Purchase Rate', 'Selling Rate', 'Valuation'];
      rows = inventoryReport.map((p) => [
        p.sku,
        p.nameEn,
        `${p.quantity} ${p.unit}`,
        `Rs ${p.purchasePrice}`,
        `Rs ${p.sellingPrice}`,
        `Rs ${p.totalValue}`,
      ]);
    } else if (activeTab === 'dues') {
      columns = ['Customer Name', 'Mobile', 'Outstanding Dues (INR)'];
      rows = duesReport.map((c) => [c.name, c.mobile, `Rs ${c.dueAmount}`]);
    } else if (activeTab === 'velocity') {
      columns = ['Rank', 'Fast Moving Product', 'Quantity Sold', 'Slow Moving Product', 'Quantity Sold'];
      rows = fastMoving.map((f, idx) => {
        const s = slowMoving[idx] || { nameEn: '-', qtySold: 0, unit: '' };
        return [
          idx + 1,
          f.nameEn,
          `${f.qtySold} ${f.unit}`,
          s.nameEn,
          `${s.qtySold} ${s.unit}`,
        ];
      });
    }

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 22,
    });

    doc.save(`${activeTab}_report.pdf`);
  };

  const tabs: { id: ReportTab; label: string; icon: any }[] = [
    { id: 'sales', label: 'ਵਿਕਰੀ ਰਿਪੋਰਟ (Sales)', icon: TrendingUp },
    { id: 'inventory', label: 'ਸਟਾਕ ਵੈਲਯੂਏਸ਼ਨ (Stock Value)', icon: PackageCheck },
    { id: 'dues', label: 'ਬਾਕਾਇਆ ਉਧਾਰ (Customer Dues)', icon: UserX },
    { id: 'velocity', label: 'ਉਤਪਾਦ ਗਤੀ (Product Velocity)', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      
      {/* Export & Actions Top Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Tab triggers */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Action triggers */}
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={exportExcel}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('exportExcel')}
          </button>
          
          <button
            onClick={exportPdf}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-105"
          >
            <FileText className="w-4 h-4" />
            {t('exportPdf')}
          </button>
        </div>
      </div>

      {/* Reports Tables Output */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden p-6">
        
        {/* Tab 1: Sales Summary table */}
        {activeTab === 'sales' && (
          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-205 border-b pb-2">ਰੋਜ਼ਾਨਾ ਵਿਕਰੀ ਦਾ ਲੇਖਾ-ਜੋਖਾ (Daily Sales Summary)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">{t('date')}</th>
                    <th className="py-3 px-4 text-right">ਕੁੱਲ ਵਿਕਰੀ (Total Sales)</th>
                    <th className="py-3 px-4 text-right">ਪ੍ਰਾਪਤ ਨਕਦ (Paid Amount)</th>
                    <th className="py-3 px-4 text-right">ਬਾਕਾਇਆ ਉਧਾਰ (Dues)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {salesReport.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold">No sales found in database.</td>
                    </tr>
                  ) : (
                    salesReport.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/40">
                        <td className="py-3.5 px-4 font-medium">{s.date}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-blue-600">₹{s.total.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">₹{s.paid.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-600">₹{s.due.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Inventory summary table */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-205 border-b pb-2">ਸਟਾਕ ਵੈਲਯੂਏਸ਼ਨ ਅਤੇ ਮਾਰਜਿਨ (Stock Valuations)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">{t('sku')}</th>
                    <th className="py-3 px-4">ਉਤਪਾਦ ਦਾ ਨਾਮ</th>
                    <th className="py-3 px-4 text-center">{t('quantity')}</th>
                    <th className="py-3 px-4 text-right">ਖਰੀਦ ਕੀਮਤ</th>
                    <th className="py-3 px-4 text-right">ਸਟਾਕ ਦੀ ਕੁੱਲ ਕੀਮਤ</th>
                    <th className="py-3 px-4 text-right">ਸੰਭਾਵਿਤ ਵੇਚ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inventoryReport.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">No products in inventory.</td>
                    </tr>
                  ) : (
                    inventoryReport.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/40">
                        <td className="py-3.5 px-4 font-mono text-xs">{p.sku}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold">{p.namePa}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{p.nameEn}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800">
                            {p.quantity} {p.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold">₹{p.purchasePrice.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-blue-650">₹{p.totalValue.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600">₹{p.potentialSales.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Outstanding dues list */}
        {activeTab === 'dues' && (
          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-205 border-b pb-2">ਉਧਾਰ ਦੇਣਦਾਰੀ ਸੂਚੀ (Pending Customer Balances)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">ਗਾਹਕ ਦਾ ਨਾਮ</th>
                    <th className="py-3 px-4">ਮੋਬਾਈਲ</th>
                    <th className="py-3 px-4 text-right">ਬਾਕਾਇਆ ਰਕਮ (Dues Dues)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {duesReport.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 font-semibold">No customers with pending balances.</td>
                    </tr>
                  ) : (
                    duesReport.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/40">
                        <td className="py-3.5 px-4 font-bold">{c.name}</td>
                        <td className="py-3.5 px-4 font-mono text-xs">{c.mobile}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">₹{c.dueAmount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Velocity list */}
        {activeTab === 'velocity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Column 1: Fast moving */}
            <div className="space-y-4">
              <h3 className="text-md font-bold text-emerald-700 dark:text-emerald-400 border-b border-emerald-100 pb-2">
                ਤੇਜ਼ੀ ਨਾਲ ਵਿਕਣ ਵਾਲਾ ਮਾਲ (Fast Moving Items)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-xs font-bold text-slate-550 uppercase">
                      <th className="py-3 px-2">Rank</th>
                      <th className="py-3 px-2">Item Name</th>
                      <th className="py-3 px-2 text-right">Quantity Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fastMoving.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400">No sales recorded.</td>
                      </tr>
                    ) : (
                      fastMoving.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-3 px-2 font-bold">#{idx + 1}</td>
                          <td className="py-3 px-2 font-semibold">
                            <div>{p.namePa}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{p.nameEn}</div>
                          </td>
                          <td className="py-3 px-2 text-right font-extrabold text-blue-600">{p.qtySold} {p.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column 2: Slow moving */}
            <div className="space-y-4">
              <h3 className="text-md font-bold text-slate-500 border-b border-slate-200 pb-2">
                ਹੌਲੀ ਵਿਕਣ ਵਾਲਾ ਮਾਲ (Slow Moving Items)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-xs font-bold text-slate-550 uppercase">
                      <th className="py-3 px-2">Rank</th>
                      <th className="py-3 px-2">Item Name</th>
                      <th className="py-3 px-2 text-right">Quantity Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {slowMoving.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400">No products in catalog.</td>
                      </tr>
                    ) : (
                      slowMoving.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-3 px-2 font-bold text-slate-500">#{idx + 1}</td>
                          <td className="py-3 px-2">
                            <div>{p.namePa}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{p.nameEn}</div>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-550">{p.qtySold} {p.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
