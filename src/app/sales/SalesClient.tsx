'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { createSaleAction, reverseSaleAction, listSalesAction } from '../../lib/actions/sales';
import { PaymentMethod } from '@prisma/client';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  History,
  CheckCircle,
  XCircle,
  X,
  ScanBarcode,
} from 'lucide-react';

interface SalesClientProps {
  products: any[];
  customers: any[];
  salesData: {
    items: any[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

interface CartItem {
  product: any;
  quantity: number;
  sellingPrice: number;
}

export default function SalesClient({ products, customers, salesData }: SalesClientProps) {
  const { t, language } = useTranslation();
  const router = useRouter();

  // Tab state (POS vs Invoices)
  const [activeTab, setActiveTab] = useState<'pos' | 'invoices'>('pos');

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paidAmount, setPaidAmount] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Invoice History State
  const [invoices, setInvoices] = useState<any[]>(salesData.items);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);

  // Focus ref for barcode input
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Automatically update paidAmount when cart or payment method changes
  const subTotal = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const total = Math.max(0, subTotal - parseFloat(discount || '0'));
  
  useEffect(() => {
    if (paymentMethod === PaymentMethod.CREDIT) {
      setPaidAmount('0');
    } else {
      setPaidAmount(total.toString());
    }
  }, [total, paymentMethod]);

  // Handle barcode scanning (simulate barcode scanner entering enter)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const matchedProduct = products.find(
      (p) => p.barcode === barcodeQuery.trim() || p.sku === barcodeQuery.trim()
    );

    if (matchedProduct) {
      addToCart(matchedProduct);
      setBarcodeQuery('');
    } else {
      alert(`Product with barcode/SKU "${barcodeQuery}" not found.`);
    }
  };

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      // Check stock limit
      if (existing.quantity + 1 > Number(product.currentQuantity)) {
        alert(`Insufficient stock for ${product.nameEn}. Available: ${product.currentQuantity}`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (Number(product.currentQuantity) < 1) {
        alert(`Insufficient stock for ${product.nameEn}. Available: 0`);
        return;
      }
      setCart([...cart, { product, quantity: 1, sellingPrice: Number(product.sellingPrice) }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > Number(item.product.currentQuantity)) {
              alert(`Insufficient stock. Available: ${item.product.currentQuantity}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    const discNum = parseFloat(discount || '0');
    const paidNum = parseFloat(paidAmount || '0');

    if (paymentMethod === PaymentMethod.CREDIT && !selectedCustomerId) {
      alert(t('selectCustomer') + ' (Required for credit sale)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createSaleAction({
        customerId: selectedCustomerId || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
        })),
        discount: discNum,
        paymentMethod,
        paidAmount: paidNum,
      });

      if (res.success) {
        alert('Bill generated successfully!');
        setSelectedInvoiceForPrint(res.sale);
        setCart([]);
        setDiscount('0');
        setSelectedCustomerId('');
        
        // Refresh invoices list
        const freshInvoices = await listSalesAction(1, 10);
        setInvoices(freshInvoices.items);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Error processing transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseSale = async (id: string, invoiceNumber: string) => {
    if (confirm(`Are you sure you want to reverse bill ${invoiceNumber}? This returns stock and cancels dues.`)) {
      try {
        const res = await reverseSaleAction(id);
        if (res.success) {
          alert('Sale reversed successfully.');
          const freshInvoices = await listSalesAction(1, 10);
          setInvoices(freshInvoices.items);
          router.refresh();
        }
      } catch (err: any) {
        alert(err.message || 'Error reversing sale');
      }
    }
  };

  // Filter products by search text
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.nameEn.toLowerCase().includes(q) ||
      p.namePa.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Tabs */}
      <div className="flex border-b-2 border-slate-200 dark:border-slate-800 no-print">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-6 py-3.5 text-md font-extrabold border-b-4 -mb-1 flex items-center gap-2 ${
            activeTab === 'pos'
              ? 'border-blue-600 text-blue-600 dark:text-blue-450 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          ਬਿੱਲ ਟਰਮੀਨਲ (POS Billing)
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3.5 text-md font-extrabold border-b-4 -mb-1 flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'border-blue-600 text-blue-600 dark:text-blue-450 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-5 h-5" />
          ਪੁਰਾਣੇ ਬਿੱਲ (Invoice History)
        </button>
      </div>

      {/* POS BILLING TAB */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          
          {/* Cart & Checkout Panel */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col min-h-[500px]">
            <h2 className="text-lg font-bold flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              ਕਾਰਟ (Selected Items Cart)
            </h2>

            {/* Customer Selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('selectCustomer')}
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
              >
                <option value="">ਵਾਕ-ਇਨ ਗਾਹਕ (Walk-in Customer)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile || 'No mobile'}) - Bal: ₹{Number(c.currentBalance).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto max-h-[300px] mb-6 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                  <ShoppingCart className="w-12 h-12 mb-2 stroke-1" />
                  <p className="font-bold">ਬਿੱਲ ਬਣਾਉਣ ਲਈ ਖੱਬੇ ਪਾਸਿਓਂ ਆਈਟਮਾਂ ਚੁਣੋ (Cart is empty)</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-bold truncate">
                        {language === 'pa' ? item.product.namePa : item.product.nameEn}
                      </p>
                      <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
                        ₹{item.sellingPrice.toFixed(2)} / {item.product.unit}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3.5 font-extrabold text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="w-20 text-right font-extrabold text-sm">
                        ₹{(item.quantity * item.sellingPrice).toFixed(2)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-rose-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Checkout Totals Panel */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4 bg-slate-50 dark:bg-slate-950 -mx-5 -mb-5 p-5 rounded-b-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-semibold">
                <div>
                  <span className="text-slate-450 block">{t('subTotal')}:</span>
                  <span className="text-md font-bold">₹{subTotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-450 block">{t('discount')}:</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full mt-1 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded font-bold"
                  />
                </div>
                <div>
                  <span className="text-slate-450 block">Payment:</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full mt-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded font-bold text-xs"
                  >
                    <option value={PaymentMethod.CASH}>{t('cash')}</option>
                    <option value={PaymentMethod.UPI}>{t('upi')}</option>
                    <option value={PaymentMethod.CREDIT}>{t('credit')}</option>
                  </select>
                </div>
                <div>
                  <span className="text-slate-450 block">{t('paidAmount')}:</span>
                  <input
                    type="number"
                    disabled={paymentMethod === PaymentMethod.CREDIT}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full mt-1 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded font-bold disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3 text-lg font-extrabold">
                <span className="text-slate-500">{t('total')}:</span>
                <span className="text-2xl text-blue-650 dark:text-blue-400">₹{total.toFixed(2)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-bold shadow-md transition-all disabled:opacity-50"
              >
                {submitting ? 'ਬਿੱਲ ਬਣ ਰਿਹਾ ਹੈ...' : t('generateInvoice')}
              </button>
            </div>
          </div>

          {/* Product Search & Catalog Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Barcode Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  ref={barcodeInputRef}
                  placeholder={t('barcodeReader')}
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded-lg text-sm font-bold text-center"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold shrink-0 border border-slate-300 dark:border-slate-750"
              >
                Scan
              </button>
            </form>

            {/* Catalog Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ਆਈਟਮ ਦਾ ਨਾਮ ਜਾਂ ਸ਼੍ਰੇਣੀ ਲੱਭੋ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded-lg text-sm focus:outline-none"
              />
            </div>

            {/* Product Cards Catalog */}
            <div className="overflow-y-auto max-h-[350px] space-y-2 pr-1">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-xs">No matching products.</p>
              ) : (
                filteredProducts.map((p) => {
                  const qty = Number(p.currentQuantity);
                  const isOut = qty <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isOut && addToCart(p)}
                      disabled={isOut}
                      className={`w-full flex items-center justify-between p-3 border rounded-xl hover:border-blue-500 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-850/30 text-left transition-all ${
                        isOut ? 'opacity-50 border-slate-200 bg-slate-100 cursor-not-allowed' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {language === 'pa' ? p.namePa : p.nameEn}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {p.sku || p.barcode || 'No code'} | {p.category || 'General'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-sm text-blue-650 dark:text-blue-400 block">
                          ₹{Number(p.sellingPrice).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-bold ${isOut ? 'text-red-500' : 'text-slate-450'}`}>
                          {isOut ? 'OUT OF STOCK' : `Stock: ${qty} ${p.unit}`}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE HISTORY TAB */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">
                  <th className="py-4 px-6">{t('invoiceNo')}</th>
                  <th className="py-4 px-6">{t('customerName')}</th>
                  <th className="py-4 px-6">{t('date')}</th>
                  <th className="py-4 px-6 text-right">{t('total')}</th>
                  <th className="py-4 px-6 text-center">Payment</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                      {t('noActivity')}
                    </td>
                  </tr>
                ) : (
                  invoices.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-6 font-bold text-blue-600 dark:text-blue-450">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-6">{sale.customer?.name || 'Walk-in Customer'}</td>
                      <td className="py-3.5 px-6">
                        {new Date(sale.date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-6 text-right font-extrabold">
                        ₹{Number(sale.total).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span className="px-2.5 py-1 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        {sale.isReversed ? (
                          <span className="inline-flex items-center text-rose-500 text-xs font-bold gap-1 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded">
                            <XCircle className="w-3.5 h-3.5" /> {t('reverse').toUpperCase()}D
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-emerald-500 text-xs font-bold gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded">
                            <CheckCircle className="w-3.5 h-3.5" /> ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedInvoiceForPrint(sale)}
                            className="p-2 border border-slate-205 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350"
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          
                          {!sale.isReversed && (
                            <button
                              onClick={() => handleReverseSale(sale.id, sale.invoiceNumber)}
                              className="px-2.5 py-1.5 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 text-xs font-bold flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              ਰਿਵਰਸ (Reverse)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINTABLE RETAIL TAX INVOICE MODAL */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden p-6 max-h-[90vh] flex flex-col">
            
            {/* Modal actions, hidden on print */}
            <div className="flex justify-between items-center mb-6 shrink-0 no-print">
              <h2 className="text-xl font-bold">ਰਿਟੇਲ ਟੈਕਸ ਬਿੱਲ (Print Tax Invoice)</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Page
                </button>
                <button
                  onClick={() => setSelectedInvoiceForPrint(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Formatter */}
            <div className="flex-1 overflow-y-auto pr-1 print-area font-sans text-black dark:text-white p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-center border-b border-dashed border-slate-350 pb-4 mb-4">
                <h2 className="text-xl font-extrabold uppercase">Sher-E-Punjab Retail</h2>
                <p className="text-xs mt-1">G.T. Road, Jalandhar, Punjab</p>
                <p className="text-xs">GSTIN: 03AAAAA1111A1Z1</p>
                <p className="text-xs">Mobile: 9876543210</p>
                <h3 className="text-sm font-bold border border-black dark:border-white inline-block px-3 py-0.5 mt-3 uppercase tracking-wider">
                  RETAIL INVOICE
                </h3>
              </div>

              <div className="grid grid-cols-2 text-xs gap-y-1 mb-4">
                <div><strong>Invoice No:</strong> {selectedInvoiceForPrint.invoiceNumber}</div>
                <div className="text-right">
                  <strong>Date:</strong> {new Date(selectedInvoiceForPrint.date).toLocaleString()}
                </div>
                <div><strong>Customer:</strong> {selectedInvoiceForPrint.customer?.name || 'Walk-in'}</div>
                <div className="text-right">
                  <strong>Mobile:</strong> {selectedInvoiceForPrint.customer?.mobile || '-'}
                </div>
              </div>

              <table className="w-full text-xs text-left border-t border-b border-black dark:border-white py-2 mb-4 border-collapse">
                <thead>
                  <tr className="border-b border-black dark:border-white font-bold">
                    <th className="py-2">Item Name (Punjabi / English)</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                  {selectedInvoiceForPrint.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2">
                        <div className="font-bold">{item.product?.namePa}</div>
                        <div className="text-[10px] text-slate-500">{item.product?.nameEn}</div>
                      </td>
                      <td className="py-2 text-center">
                        {Number(item.quantity)} {item.product?.unit}
                      </td>
                      <td className="py-2 text-right">₹{Number(item.sellingPrice).toFixed(2)}</td>
                      <td className="py-2 text-right font-bold">₹{Number(item.total).toFixed(2)}</td>
                    </tr>
                  )) || (
                    // Fallback for list display when items are not pre-fetched in group
                    cart.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2">
                          <div className="font-bold">{item.product.namePa}</div>
                          <div className="text-[10px] text-slate-500">{item.product.nameEn}</div>
                        </td>
                        <td className="py-2 text-center">{item.quantity} {item.product.unit}</td>
                        <td className="py-2 text-right">₹{item.sellingPrice.toFixed(2)}</td>
                        <td className="py-2 text-right font-bold">₹{(item.quantity * item.sellingPrice).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="w-48 ml-auto text-xs space-y-1.5 border-b border-black dark:border-white pb-3 mb-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{Number(selectedInvoiceForPrint.subTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>- ₹{Number(selectedInvoiceForPrint.discount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-md font-bold border-t border-slate-300 pt-1.5">
                  <span>Grand Total:</span>
                  <span>₹{Number(selectedInvoiceForPrint.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 text-[10px] font-semibold gap-y-1">
                <div><strong>Payment Method:</strong> {selectedInvoiceForPrint.paymentMethod}</div>
                <div className="text-right"><strong>Paid Amount:</strong> ₹{Number(selectedInvoiceForPrint.paidAmount).toFixed(2)}</div>
                <div><strong>Due Amount:</strong> ₹{Number(selectedInvoiceForPrint.dueAmount).toFixed(2)}</div>
              </div>

              <div className="text-center text-[10px] mt-8 border-t border-slate-200 dark:border-slate-800 pt-4 italic">
                Thank you for your business! <br />
                ਦੁਬਾਰਾ ਮਿਲਣ ਦੀ ਉਮੀਦ ਹੈ (Hope to see you again)
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0 mt-4 no-print">
              <button
                onClick={() => setSelectedInvoiceForPrint(null)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
