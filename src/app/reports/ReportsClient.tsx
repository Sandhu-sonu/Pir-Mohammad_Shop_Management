'use client';

import React, { useState, useEffect } from 'react';
import { getSalesReportDataAction, getExpensesReportDataAction, getDailyClosingReportDataAction, getOutstandingCustomersAction, getOutstandingSuppliersAction, getInventoryValuationAction } from '@/lib/actions/reports';
import { getProfitReportAction } from '@/lib/actions/profit';
import { Download, FileSpreadsheet, FileText, Filter, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ReportsClientProps {
  userRole: string;
}

export default function ReportsClient({ userRole }: ReportsClientProps) {
  const [reportType, setReportType] = useState<string>('sales');
  
  // Date ranges: default to last 30 days
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState<any>(null);

  // Filters for local search/refinements
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');

  // Load report data on configuration changes
  useEffect(() => {
    fetchReportData();
  }, [reportType, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let result: any = [];
      if (reportType === 'sales') {
        result = await getSalesReportDataAction(startDate, endDate);
      } else if (reportType === 'expenses') {
        result = await getExpensesReportDataAction(startDate, endDate);
      } else if (reportType === 'profit') {
        const summary = await getProfitReportAction(startDate, endDate);
        setProfitSummary(summary);
        // Map summary values to array row for display
        result = [
          { metric: 'ਕੁੱਲ ਵਿਕਰੀ (Revenue)', value: summary.revenue },
          { metric: 'ਖਰੀਦ ਮੁੱਲ (COGS)', value: summary.cogs },
          { metric: 'ਕੁੱਲ ਲਾਭ (Gross Profit)', value: summary.grossProfit },
          { metric: 'ਖਰਚੇ (Expenses)', value: summary.expenses },
          { metric: 'ਸ਼ੁੱਧ ਮੁਨਾਫਾ (Net Profit)', value: summary.netProfit },
          { metric: 'ਮੁਨਾਫਾ ਦਰ (Profit %)', value: `${summary.profitPercentage}%` },
        ];
      } else if (reportType === 'closing') {
        result = await getDailyClosingReportDataAction(startDate, endDate);
      } else if (reportType === 'customer_outstanding') {
        result = await getOutstandingCustomersAction();
      } else if (reportType === 'supplier_outstanding') {
        result = await getOutstandingSuppliersAction();
      } else if (reportType === 'inventory_valuation') {
        result = await getInventoryValuationAction();
      }
      setData(result);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Local filtering helper
  const getFilteredData = () => {
    if (reportType === 'profit') return data;

    return data.filter((row: any) => {
      // 1. Category filter (for inventory valuation or expenses)
      if (selectedCategory !== 'ALL') {
        const catMatch = row.category && String(row.category).toUpperCase() === selectedCategory.toUpperCase();
        if (!catMatch) return false;
      }

      // 2. Payment Method filter (for sales, expenses, or payments)
      if (selectedPaymentMethod !== 'ALL') {
        const methodMatch = row.paymentMethod && String(row.paymentMethod).toUpperCase() === selectedPaymentMethod.toUpperCase();
        if (!methodMatch) return false;
      }

      // 3. Global search
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      const nameMatch = row.name && row.name.toLowerCase().includes(term);
      const nameEnMatch = row.nameEn && row.nameEn.toLowerCase().includes(term);
      const namePaMatch = row.namePa && row.namePa.toLowerCase().includes(term);
      const skuMatch = row.sku && row.sku.toLowerCase().includes(term);
      const noteMatch = row.notes && row.notes.toLowerCase().includes(term);
      const customerMatch = row.customer?.name && row.customer.name.toLowerCase().includes(term);
      const userMatch = (row.user?.name || row.createdByUser?.name) && (row.user?.name || row.createdByUser?.name).toLowerCase().includes(term);

      return nameMatch || nameEnMatch || namePaMatch || skuMatch || noteMatch || customerMatch || userMatch;
    });
  };

  const filteredData = getFilteredData();

  // Export handlers
  const getExportFileName = () => {
    return `${reportType}_report_${startDate}_to_${endDate}`;
  };

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = getExportHeaders();
    const rows = filteredData.map(getExportRow);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${getExportFileName()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    if (filteredData.length === 0) return;
    const headers = getExportHeaders();
    const rows = filteredData.map(getExportRow);

    // Build worksheet data
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
    XLSX.writeFile(wb, `${getExportFileName()}.xlsx`);
  };

  const exportPDF = () => {
    if (filteredData.length === 0) return;
    const doc = new jsPDF();
    const title = getReportTitle();
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 21);
    doc.text(`Generated by: ${userRole}`, 14, 27);

    const headers = getExportHeaders();
    const rows = filteredData.map(getExportRow);

    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 33,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`${getExportFileName()}.pdf`);
  };

  // Setup report headers and columns dynamically
  const getReportTitle = () => {
    switch (reportType) {
      case 'sales': return 'Sales Report (ਵਿਕਰੀ ਰਿਪੋਰਟ)';
      case 'expenses': return 'Expense Report (ਖਰਚਾ ਰਿਪੋਰტ)';
      case 'profit': return 'Profit Engine Report (ਮੁਨਾਫਾ ਰਿਪੋਰਟ)';
      case 'closing': return 'Daily Closing Report (ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ)';
      case 'customer_outstanding': return 'Customer Outstanding Udhaar (ਗਾਹਕਾਂ ਦਾ ਉਧਾਰ)';
      case 'supplier_outstanding': return 'Supplier Dues (ਸਪਲਾਇਰਾਂ ਦੇ ਬਕਾਏ)';
      case 'inventory_valuation': return 'Inventory Valuation (ਸਟਾਕ ਮੁਲਾਂਕਣ)';
      default: return 'Business Report';
    }
  };

  const getExportHeaders = () => {
    switch (reportType) {
      case 'sales':
        return ['Date', 'Invoice No', 'Customer', 'Payment Method', 'Paid Amount', 'Total Amount', 'Created By', 'Status'];
      case 'expenses':
        return ['Date', 'Category', 'Amount', 'Payment Method', 'Description', 'Notes', 'Created By', 'Status'];
      case 'profit':
        return ['Business Metric', 'Value (Rs)'];
      case 'closing':
        return ['Date', 'Opening Cash', 'Cash Sales', 'Expected Cash', 'Actual Cash Count', 'Difference', 'Withdrawals', 'Closed By', 'Status'];
      case 'customer_outstanding':
        return ['Customer Name', 'Mobile', 'Opening Udhaar', 'Current Udhaar Balance'];
      case 'supplier_outstanding':
        return ['Supplier Name', 'Mobile', 'GST No', 'Owed Balance'];
      case 'inventory_valuation':
        return ['Product Name', 'SKU', 'Stock Qty', 'Purchase Price', 'Selling Price', 'Inventory Cost Value', 'Expected Sales Value'];
      default:
        return [];
    }
  };

  const getExportRow = (row: any) => {
    switch (reportType) {
      case 'sales':
        return [
          new Date(row.date).toLocaleString(),
          row.invoiceNumber || row.id.slice(0, 8),
          row.customer?.name || 'Walk-in Customer',
          row.paymentMethod,
          row.paidAmount,
          row.total,
          row.createdByUser?.name || 'System',
          row.isReversed ? 'REVERSED' : 'ACTIVE'
        ];
      case 'expenses':
        return [
          new Date(row.date).toLocaleDateString(),
          row.category,
          row.amount,
          row.paymentMethod,
          row.description || '',
          row.notes || '',
          row.user?.name || 'System',
          row.isReversed ? 'REVERSED' : 'ACTIVE'
        ];
      case 'profit':
        return [row.metric, row.value];
      case 'closing':
        return [
          new Date(row.date).toLocaleDateString(),
          row.openingCash,
          row.salesCash,
          row.openingCash + row.salesCash + row.paymentsReceivedCash - row.expensesCash - row.supplierPaymentsCash - row.withdrawals,
          row.closingCash,
          row.difference,
          row.withdrawals,
          row.user?.name || 'System',
          row.isReversed ? 'REVERSED' : 'LOCKED'
        ];
      case 'customer_outstanding':
        return [row.name, row.mobile || '', row.openingBalance, row.currentBalance];
      case 'supplier_outstanding':
        return [row.name, row.mobile || '', row.gst || '', row.currentBalance];
      case 'inventory_valuation':
        const qty = parseFloat(row.currentQuantity);
        const cost = parseFloat(row.purchasePrice);
        const sell = parseFloat(row.sellingPrice);
        return [
          row.nameEn || row.name,
          row.sku,
          qty,
          cost,
          sell,
          (qty * cost).toFixed(2),
          (qty * sell).toFixed(2)
        ];
      default:
        return [];
    }
  };

  // List of standard expense categories for filters
  const defaultCategories = [
    'Salary', 'Rent', 'Electricity', 'Internet', 'Transport', 'Tea & Refreshments', 'Shop Maintenance', 'Stationery', 'Miscellaneous'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            ਰਿਪੋਰਟਸ ਅਤੇ ਵਿਸ਼ਲੇਸ਼ਣ (Reports & Analytics)
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Export tax summaries, profits, outstanding balances, and custom date range records.
          </p>
        </div>

        {/* Exporters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportExcel}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition duration-200 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition duration-200 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar: Report Selectors & Time Boundaries */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-md font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <Filter className="w-4 h-4 text-indigo-500" />
              ਰਿਪੋਰਟ ਚੁਣੋ (Select Report)
            </h2>
            
            <div className="flex flex-col gap-1">
              {[
                { id: 'sales', label: 'ਵਿਕਰੀ ਰਿਪੋਰਟ (Sales)' },
                { id: 'expenses', label: 'ਖਰਚਾ ਰਿਪੋਰਟ (Expenses)' },
                { id: 'profit', label: 'ਮੁਨਾਫਾ ਇੰਜਣ (Profit Engine)' },
                { id: 'closing', label: 'ਰੋਜ਼ਾਨਾ ਕਲੋਜ਼ਿੰਗ (Closings)' },
                { id: 'customer_outstanding', label: 'ਗਾਹਕ ਉਧਾਰ (Outstanding Customer)' },
                { id: 'supplier_outstanding', label: 'ਸਪਲਾਇਰ ਬਕਾਇਆ (Outstanding Supplier)' },
                { id: 'inventory_valuation', label: 'ਸਟਾਕ ਮੁਲਾਂਕਣ (Stock Valuation)' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setReportType(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    reportType === item.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-650/20'
                      : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Date Picker (conditionally rendered for range dependent reports) */}
            {['sales', 'expenses', 'profit', 'closing'].includes(reportType) && (
              <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-850">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-350 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  ਸਮਾਂ ਸੀਮਾ (Timeframe)
                </h3>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-zinc-450 dark:text-zinc-500 block mb-1">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 focus:ring-2 focus:ring-indigo-550 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-450 dark:text-zinc-500 block mb-1">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 focus:ring-2 focus:ring-indigo-550 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area: Filters, Preview Table */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Sub-Filters / Search */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search report details... (ਖੋਜ ਕਰੋ)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-550 dark:text-white"
              />
            </div>
            
            <div className="flex gap-2">
              {/* Payment Method filter for transaction reports */}
              {['sales', 'expenses', 'closing'].includes(reportType) && (
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="text-xs bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CREDIT">Credit / Udhaar</option>
                </select>
              )}
            </div>
          </div>

          {/* Report Summary (Conditionally display metrics summary boxes) */}
          {reportType === 'profit' && profitSummary && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { title: 'ਕੁੱਲ ਵਿਕਰੀ (Revenue)', val: `Rs ${profitSummary.revenue}`, color: 'text-indigo-600 dark:text-indigo-400' },
                { title: 'ਖਰੀਦ ਮੁੱਲ (COGS)', val: `Rs ${profitSummary.cogs}`, color: 'text-amber-600 dark:text-amber-500' },
                { title: 'ਕੁੱਲ ਮੁਨਾਫਾ (Gross Profit)', val: `Rs ${profitSummary.grossProfit}`, color: 'text-emerald-600 dark:text-emerald-450' },
                { title: 'ਦੁਕਾਨ ਦੇ ਖਰਚੇ (Expenses)', val: `Rs ${profitSummary.expenses}`, color: 'text-rose-600 dark:text-rose-450' },
                { title: 'ਸ਼ੁੱਧ ਮੁਨਾਫਾ (Net Profit)', val: `Rs ${profitSummary.netProfit}`, color: profitSummary.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400', isBold: true },
                { title: 'ਲਾਭ ਦਰ % (Profit %)', val: `${profitSummary.profitPercentage}%`, color: 'text-indigo-600 dark:text-indigo-400' },
              ].map((card, idx) => (
                <div key={idx} className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-450 dark:text-zinc-500 font-semibold">{card.title}</span>
                  <span className={`text-lg font-black tracking-tight mt-1 ${card.color} ${card.isBold ? 'text-xl' : ''}`}>{card.val}</span>
                </div>
              ))}
            </div>
          )}

          {reportType === 'sales' && filteredData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const totalSalesAmt = filteredData.reduce((sum, sale) => sum + parseFloat(sale.total || '0'), 0);
                const totalDiscountAmt = filteredData.reduce((sum, sale) => sum + parseFloat(sale.totalDiscount || '0'), 0);
                
                // Group discounts by staff/cashier
                const cashierDiscounts: Record<string, number> = {};
                filteredData.forEach((sale) => {
                  const cashierName = sale.createdByUser?.name || 'Unknown Staff';
                  const disc = parseFloat(sale.totalDiscount || '0');
                  if (disc > 0) {
                    cashierDiscounts[cashierName] = (cashierDiscounts[cashierName] || 0) + disc;
                  }
                });

                return (
                  <>
                    <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-450 dark:text-zinc-500 font-bold">ਕੁੱਲ ਵਿਕਰੀ (Total Sales)</span>
                      <span className="text-lg font-black mt-1 text-indigo-600 dark:text-indigo-400">₹{totalSalesAmt.toFixed(2)}</span>
                    </div>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-450 dark:text-zinc-550 font-bold">ਕੁੱਲ ਡਿਸਕਾਊਂਟ (Total Discount Given)</span>
                      <span className="text-lg font-black mt-1 text-amber-600 dark:text-amber-500 font-bold">₹{totalDiscountAmt.toFixed(2)}</span>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between md:col-span-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-450 dark:text-zinc-500 font-bold font-semibold">ਸਟਾਫ਼ ਵਾਈਜ਼ ਡਿਸਕਾਊਂਟ (Discount by Cashier)</span>
                      <div className="mt-1.5 space-y-1 max-h-[80px] overflow-y-auto text-xs font-semibold">
                        {Object.keys(cashierDiscounts).length === 0 ? (
                          <span className="text-slate-400">No discounts given</span>
                        ) : (
                          Object.entries(cashierDiscounts).map(([name, val]) => (
                            <div key={name} className="flex justify-between text-zinc-700 dark:text-zinc-300">
                              <span>{name}:</span>
                              <span className="font-bold">₹{val.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Preview Grid Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-850/50 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-350 uppercase tracking-wider">
                ਰਿਪੋਰਟ ਪ੍ਰੀਵਿਊ (Report Preview - {filteredData.length} records)
              </h3>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="text-xs text-zinc-550 dark:text-zinc-400 mt-2">ਕੁਝ ਸਮਾਂ ਉਡੀਕ ਕਰੋ... Loading Report Data...</span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500">ਨੋ ਰਿਕਾਰਡ ਫਾਉਂਡ (No report records matching criteria)</span>
                <span className="text-[10px] text-zinc-400 mt-1">Try widening your date filters or search terms.</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-350 sticky top-0 font-bold border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      {getExportHeaders().map((head, idx) => (
                        <th key={idx} className="p-3 whitespace-nowrap">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-750 dark:text-zinc-300">
                    {filteredData.map((row: any, rowIdx: number) => (
                      <tr
                        key={rowIdx}
                        className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-850/30 transition-colors ${
                          row.isReversed ? 'bg-red-50/30 dark:bg-red-950/10 text-zinc-400 line-through' : ''
                        }`}
                      >
                        {getExportRow(row).map((val, cellIdx) => (
                          <td key={cellIdx} className="p-3 whitespace-nowrap">
                            {typeof val === 'number' && !isNaN(val) ? `Rs ${val.toLocaleString()}` : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
