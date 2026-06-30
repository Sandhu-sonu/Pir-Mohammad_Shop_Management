'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { createSaleAction, reverseSaleAction, listSalesAction, getSaleAction } from '../../lib/actions/sales';
import { addCustomerAction } from '../../lib/actions/customers';
import { PaymentMethod } from '@prisma/client';
import { EmptyState } from '../../components/ui/EmptyState';
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
  ChevronDown,
  Edit3,
  Percent,
  Coins,
} from 'lucide-react';

import { useToastStore } from '../../lib/store/toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

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
  shop: any;
  role: string;
}

interface CartItem {
  product: any;
  quantity: number;
  originalPrice: number;
  sellingPrice: number;
  itemDiscount: number;
  discountType: 'FIXED' | 'PERCENT';
  discountReason?: string;
}

export default function SalesClient({ products, customers, salesData, shop, role }: SalesClientProps) {
  const { t, language } = useTranslation();
  const { showToast } = useToastStore();
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
  
  // Discount Engine states
  const [billDiscountType, setBillDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [activeDiscountItem, setActiveDiscountItem] = useState<string | null>(null);
  const [rowDiscountVal, setRowDiscountVal] = useState<string>('0');
  const [rowDiscountType, setRowDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [tempPriceVal, setTempPriceVal] = useState<string>('');

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonSelected, setReasonSelected] = useState('Regular Customer');
  const [customReason, setCustomReason] = useState('');
  const [autoPrintAfterReason, setAutoPrintAfterReason] = useState(false);

  // Invoice History State
  const [invoices, setInvoices] = useState<any[]>(salesData.items);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Focus ref for barcode input
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [reversalTarget, setReversalTarget] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [showPrintDropdown, setShowPrintDropdown] = useState(false);

  // Formatting helper based on regional settings
  const formatSymbol = shop?.settings?.currencySymbol || '₹';
  const decimals = shop?.settings?.decimalPrecision ?? 2;
  const formatPrice = (value: number) => {
    return `${formatSymbol}${value.toFixed(decimals)}`;
  };

  // Automatically update paidAmount when cart or payment method changes
  const rawSubTotal = cart.reduce((sum, item) => sum + item.quantity * item.originalPrice, 0);
  const totalItemDiscount = cart.reduce((sum, item) => sum + item.quantity * (item.originalPrice - item.sellingPrice), 0);
  const afterItemDiscountSubtotal = rawSubTotal - totalItemDiscount;

  const billDiscountVal = parseFloat(discount || '0');
  const billDiscountAmt = billDiscountType === 'PERCENT'
    ? afterItemDiscountSubtotal * (billDiscountVal / 100)
    : billDiscountVal;

  const total = Math.max(0, afterItemDiscountSubtotal - billDiscountAmt);
  
  useEffect(() => {
    if (paymentMethod === PaymentMethod.CREDIT) {
      setPaidAmount('0');
    } else {
      setPaidAmount(total.toString());
    }
  }, [total, paymentMethod]);

  // Caching POS state to local storage for crash/session recovery (Module 5)
  useEffect(() => {
    if (cart.length > 0 || selectedCustomerId || Number(discount) > 0 || searchQuery) {
      localStorage.setItem(
        'draft_sales_pos',
        JSON.stringify({
          cart,
          selectedCustomerId,
          discount,
          paymentMethod,
          paidAmount,
          searchQuery,
          activeTab,
          savedAt: Date.now(),
        })
      );
    } else {
      localStorage.removeItem('draft_sales_pos');
    }
  }, [cart, selectedCustomerId, discount, paymentMethod, paidAmount, searchQuery, activeTab]);

  // Restoring POS state on approval
  useEffect(() => {
    const approved = localStorage.getItem('draft_restore_approved');
    if (approved === 'true') {
      const draft = localStorage.getItem('draft_sales_pos');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          const now = Date.now();
          // Verify 24-hour expiration threshold
          if (parsed.savedAt && now - parsed.savedAt <= 24 * 60 * 60 * 1000) {
            if (parsed.cart) setCart(parsed.cart);
            if (parsed.selectedCustomerId) setSelectedCustomerId(parsed.selectedCustomerId);
            if (parsed.discount) setDiscount(parsed.discount);
            if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
            if (parsed.paidAmount) setPaidAmount(parsed.paidAmount);
            if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
            if (parsed.activeTab) setActiveTab(parsed.activeTab);
          }
        } catch (e) {
          console.error('Failed to restore POS session', e);
        }
      }
      localStorage.removeItem('draft_restore_approved');
      localStorage.removeItem('draft_restore_prompted');
    }
  }, []);

  // Autofocus barcode scanner input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Autofocus barcode scanner input when printable modal is closed
  useEffect(() => {
    if (!selectedInvoiceForPrint) {
      barcodeInputRef.current?.focus();
    }
  }, [selectedInvoiceForPrint]);

  // Keyboard Shortcuts: F2 -> Complete Bill, F3 -> Add Customer, Esc -> Clear Cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pos') return;

      if (e.key === 'F2') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowAddCustomerModal(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showAddCustomerModal) {
          setShowAddCustomerModal(false);
        } else if (selectedInvoiceForPrint) {
          setSelectedInvoiceForPrint(null);
        } else {
          setCart([]);
          setDiscount('0');
          setSelectedCustomerId('');
          showToast('Cart cleared', 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cart, selectedCustomerId, discount, paymentMethod, paidAmount, showAddCustomerModal, selectedInvoiceForPrint]);

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    setSavingCustomer(true);
    try {
      const res = await addCustomerAction({
        name: newCustomerName.trim(),
        mobile: newCustomerMobile.trim() || undefined,
      });

      if (res.success && 'customer' in res) {
        showToast('Customer added successfully', 'success');
        customers.push(res.customer);
        setSelectedCustomerId(res.customer.id);
        setShowAddCustomerModal(false);
        setNewCustomerName('');
        setNewCustomerMobile('');
      } else {
        const errorMsg = 'error' in res ? res.error : 'Failed to add customer';
        showToast(errorMsg, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add customer', 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

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
      showToast(`Product with barcode/SKU "${barcodeQuery}" not found.`, 'warning');
    }
  };

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      // Check stock limit
      if (existing.quantity + 1 > Number(product.currentQuantity)) {
        showToast(`Insufficient stock for ${product.nameEn}. Available: ${product.currentQuantity}`, 'warning');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (Number(product.currentQuantity) < 1) {
        showToast(`Insufficient stock for ${product.nameEn}. Available: 0`, 'warning');
        return;
      }
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          originalPrice: Number(product.sellingPrice),
          sellingPrice: Number(product.sellingPrice),
          itemDiscount: 0,
          discountType: 'FIXED',
          discountReason: undefined
        }
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > Number(item.product.currentQuantity)) {
              showToast(`Insufficient stock. Available: ${item.product.currentQuantity}`, 'warning');
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

  const applyRowDiscount = (productId: string, val: number, type: 'FIXED' | 'PERCENT') => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          let derivedPrice = item.originalPrice;
          if (type === 'PERCENT') {
            derivedPrice = item.originalPrice * (1 - val / 100);
          } else {
            derivedPrice = item.originalPrice - val;
          }
          return {
            ...item,
            itemDiscount: val,
            discountType: type,
            sellingPrice: Math.max(0, parseFloat(derivedPrice.toFixed(2))),
          };
        }
        return item;
      })
    );
  };

  const editSellingPrice = (productId: string, newPrice: number) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const discountDiff = item.originalPrice - newPrice;
          return {
            ...item,
            itemDiscount: parseFloat(discountDiff.toFixed(2)),
            discountType: 'FIXED',
            sellingPrice: Math.max(0, newPrice),
          };
        }
        return item;
      })
    );
  };

  const handleCheckout = async (autoPrint = false) => {
    validateAndProceedCheckout(autoPrint);
  };

  const validateAndProceedCheckout = (autoPrint = false) => {
    if (cart.length === 0) {
      showToast('Your cart is empty.', 'warning');
      return;
    }

    const allowItemDiscount = shop.settings?.allowItemDiscount ?? true;
    const allowBillDiscount = shop.settings?.allowBillDiscount ?? true;
    const maxStaffDiscount = shop.settings?.maxStaffDiscount !== undefined ? Number(shop.settings.maxStaffDiscount) : 10;
    const requireDiscountReason = shop.settings?.requireDiscountReason ?? false;
    const reasonPercentLimit = shop.settings?.reasonPercentLimit !== undefined ? Number(shop.settings.reasonPercentLimit) : 15;
    const reasonAmountLimit = shop.settings?.reasonAmountLimit !== undefined ? Number(shop.settings.reasonAmountLimit) : 500;

    // Check if item discounts are allowed
    if (!allowItemDiscount && cart.some(item => item.itemDiscount > 0)) {
      showToast('Item-wise discounts are disabled in settings.', 'error');
      return;
    }

    // Check if bill discount is allowed
    const billDiscountVal = parseFloat(discount || '0');
    if (!allowBillDiscount && billDiscountVal > 0) {
      showToast('Bill-wise discounts are disabled in settings.', 'error');
      return;
    }

    if (paymentMethod === PaymentMethod.CREDIT && !selectedCustomerId) {
      showToast(t('selectCustomer') + ' (Required for credit sale)', 'warning');
      return;
    }

    // Check for negative selling prices or discounts exceeding price
    for (const item of cart) {
      if (item.sellingPrice < 0) {
        showToast(`Selling price cannot be negative for product: ${item.product.namePa || item.product.nameEn}`, 'error');
        return;
      }
      if (item.originalPrice < item.sellingPrice) {
        showToast(`Selling price cannot exceed original price for product: ${item.product.namePa || item.product.nameEn}`, 'error');
        return;
      }
      const discountPercent = item.originalPrice > 0 ? ((item.originalPrice - item.sellingPrice) / item.originalPrice) * 100 : 0;
      
      // Staff limit checks
      if (role === 'STAFF' && discountPercent > maxStaffDiscount) {
        showToast(`Staff members cannot give discounts higher than ${maxStaffDiscount}% on item: ${item.product.namePa || item.product.nameEn}`, 'error');
        return;
      }
    }

    // Calculate subtotal of lines
    let subtotal = 0;
    let totalItemDiscount = 0;
    cart.forEach(item => {
      subtotal += item.quantity * item.sellingPrice;
      totalItemDiscount += item.quantity * (item.originalPrice - item.sellingPrice);
    });

    // Check bill discount Staff limit
    let billDiscountAmt = 0;
    if (billDiscountType === 'PERCENT') {
      if (role === 'STAFF' && billDiscountVal > maxStaffDiscount) {
        showToast(`Staff members cannot give bill discounts higher than ${maxStaffDiscount}%`, 'error');
        return;
      }
      billDiscountAmt = subtotal * (billDiscountVal / 100);
    } else {
      const billDiscountPercent = subtotal > 0 ? (billDiscountVal / subtotal) * 100 : 0;
      if (role === 'STAFF' && billDiscountPercent > maxStaffDiscount) {
        showToast(`Staff members cannot give bill discounts higher than ${maxStaffDiscount}%`, 'error');
        return;
      }
      billDiscountAmt = billDiscountVal;
    }

    const totalDiscountAmt = totalItemDiscount + billDiscountAmt;
    const finalTotal = subtotal - billDiscountAmt;

    if (finalTotal < 0) {
      showToast('Grand total cannot be negative.', 'error');
      return;
    }

    // Check if large discount reason is required
    let thresholdExceeded = false;
    if (requireDiscountReason) {
      for (const item of cart) {
        const itemDiscountPercent = item.originalPrice > 0 ? ((item.originalPrice - item.sellingPrice) / item.originalPrice) * 100 : 0;
        if (itemDiscountPercent > reasonPercentLimit) {
          thresholdExceeded = true;
          break;
        }
      }
      if (totalDiscountAmt > reasonAmountLimit) {
        thresholdExceeded = true;
      }
    }

    if (thresholdExceeded) {
      setAutoPrintAfterReason(autoPrint);
      setShowReasonModal(true);
    } else {
      executeCheckout(autoPrint);
    }
  };

  const executeCheckout = async (autoPrint = false, reasonText?: string) => {
    const billDiscountVal = parseFloat(discount || '0');
    const paidNum = parseFloat(paidAmount || '0');

    setSubmitting(true);
    try {
      const res = await createSaleAction({
        customerId: selectedCustomerId || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          originalPrice: item.originalPrice,
          itemDiscount: item.itemDiscount,
          discountType: item.discountType,
          discountReason: reasonText || undefined,
        })),
        discount: 0,
        paymentMethod,
        paidAmount: paidNum,
        billDiscount: billDiscountVal,
        billDiscountType: billDiscountType,
        discountReason: reasonText || undefined,
      });

      if (res.success && 'sale' in res) {
        showToast('Bill generated successfully!', 'success');
        setSelectedInvoiceForPrint(res.sale);
        setCart([]);
        setDiscount('0');
        setSelectedCustomerId('');
        setBillDiscountType('FIXED');
        localStorage.removeItem('draft_sales_pos');
        
        // Refresh invoices list
        const freshInvoices = await listSalesAction(1, 10);
        setInvoices(freshInvoices.items);
        router.refresh();

        if (autoPrint) {
          setTimeout(() => {
            window.print();
          }, 500);
        } else {
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 200);
        }
      } else {
        const errMsg = 'error' in res ? res.error : 'Checkout failed';
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Checkout failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseSale = (id: string, invoiceNumber: string) => {
    setReversalTarget({ id, invoiceNumber });
  };

  const handleConfirmReverse = async () => {
    if (!reversalTarget) return;
    try {
      const res = await reverseSaleAction(reversalTarget.id);
      if (res.success) {
        showToast('Sale reversed successfully.', 'success');
        const freshInvoices = await listSalesAction(1, 10);
        setInvoices(freshInvoices.items);
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : 'Error reversing sale';
        showToast(errorMsg, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error reversing sale', 'error');
    } finally {
      setReversalTarget(null);
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
                    {c.name} ({c.mobile || 'No mobile'}) - Bal: {formatPrice(Number(c.currentBalance))}
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
                cart.map((item) => {
                  const lineTotal = item.quantity * item.sellingPrice;
                  const itemDiscountVal = item.originalPrice - item.sellingPrice;

                  return (
                    <div
                      key={item.product.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">
                          {language === 'pa' ? item.product.namePa : item.product.nameEn}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1">
                          {editingPriceProductId === item.product.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400">₹</span>
                              <input
                                type="number"
                                value={tempPriceVal}
                                onChange={(e) => setTempPriceVal(e.target.value)}
                                onBlur={() => {
                                  const parsed = parseFloat(tempPriceVal);
                                  if (!isNaN(parsed) && parsed >= 0) {
                                    editSellingPrice(item.product.id, parsed);
                                  }
                                  setEditingPriceProductId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const parsed = parseFloat(tempPriceVal);
                                    if (!isNaN(parsed) && parsed >= 0) {
                                      editSellingPrice(item.product.id, parsed);
                                    }
                                    setEditingPriceProductId(null);
                                  }
                                }}
                                className="w-16 px-1.5 py-0.5 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 rounded text-xs font-extrabold text-slate-900 dark:text-slate-100"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {formatPrice(item.sellingPrice)} / {item.product.unit}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPriceProductId(item.product.id);
                                  setTempPriceVal(item.sellingPrice.toString());
                                }}
                                className="p-0.5 text-slate-400 hover:text-slate-650 rounded"
                                title="Edit Price directly"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {itemDiscountVal > 0 && (
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                              Disc: -{formatPrice(itemDiscountVal)} (Orig: {formatPrice(item.originalPrice)})
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Minus className="w-4.5 h-4.5" />
                          </button>
                          <span className="px-3.5 font-extrabold text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Plus className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        {/* Discount Button & Popover */}
                        {(shop.settings?.allowItemDiscount ?? true) && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (activeDiscountItem === item.product.id) {
                                  setActiveDiscountItem(null);
                                } else {
                                  setActiveDiscountItem(item.product.id);
                                  setRowDiscountVal(item.itemDiscount.toString());
                                  setRowDiscountType(item.discountType);
                                }
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                item.itemDiscount > 0
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 border-amber-200 dark:border-amber-900 font-extrabold'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>
                                {item.itemDiscount > 0
                                  ? `${item.discountType === 'PERCENT' ? `${item.itemDiscount}%` : `₹${item.itemDiscount}`}`
                                  : 'ਡਿਸਕਾਊਂਟ (Disc)'}
                              </span>
                            </button>

                            {activeDiscountItem === item.product.id && (
                              <div className="absolute right-0 mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl shadow-xl z-50 w-52 space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">ਡਿਸਕਾਊਂਟ:</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDiscountItem(null)}
                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                
                                <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      applyRowDiscount(item.product.id, 0, 'FIXED');
                                      setActiveDiscountItem(null);
                                    }}
                                    className="flex-1 py-1.5 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-650 text-center"
                                  >
                                    No Disc
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRowDiscountType('FIXED')}
                                    className={`flex-1 py-1.5 text-center ${
                                      rowDiscountType === 'FIXED'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    ₹ Fixed
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRowDiscountType('PERCENT')}
                                    className={`flex-1 py-1.5 text-center ${
                                      rowDiscountType === 'PERCENT'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    % Pct
                                  </button>
                                </div>

                                <div className="flex gap-1.5 items-center">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rowDiscountVal}
                                    onChange={(e) => setRowDiscountVal(e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100"
                                    placeholder="Value"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = parseFloat(rowDiscountVal) || 0;
                                      applyRowDiscount(item.product.id, val, rowDiscountType);
                                      setActiveDiscountItem(null);
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Final Line Total */}
                        <div className="w-20 text-right font-extrabold text-sm text-slate-800 dark:text-slate-100">
                          {formatPrice(lineTotal)}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-rose-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Checkout Totals Panel */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4 bg-slate-50 dark:bg-slate-950 -mx-5 -mb-5 p-5 rounded-b-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-semibold">
                <div>
                  <span className="text-slate-450 block">ਸਬ-ਟੋਟਲ (Subtotal):</span>
                  <span className="text-md font-bold text-slate-800 dark:text-slate-200">{formatPrice(rawSubTotal)}</span>
                </div>
                
                <div>
                  <span className="text-slate-450 block">ਆਈਟਮ ਡਿਸਕਾਊਂਟ (Item Disc):</span>
                  <span className="text-md font-bold text-amber-600">-{formatPrice(totalItemDiscount)}</span>
                </div>

                <div>
                  <span className="text-slate-450 block">ਬਿੱਲ ਡਿਸਕਾਊਂਟ (Bill Disc):</span>
                  {(shop.settings?.allowBillDiscount ?? true) ? (
                    <div className="flex items-center mt-1 border border-slate-300 dark:border-slate-800 rounded bg-white dark:bg-slate-900 overflow-hidden">
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="w-full px-2 py-0.5 bg-transparent border-0 font-bold focus:ring-0 text-xs text-slate-900 dark:text-slate-100"
                        style={{ outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setBillDiscountType(billDiscountType === 'FIXED' ? 'PERCENT' : 'FIXED')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-extrabold border-l border-slate-200 dark:border-slate-700"
                      >
                        {billDiscountType === 'FIXED' ? '₹' : '%'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 block text-xs py-1">Disabled</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-450 block">ਭੁਗਤਾਨ (Payment):</span>
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
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
                <div>
                  <span className="text-slate-450 block">{t('paidAmount')}:</span>
                  <input
                    type="number"
                    disabled={paymentMethod === PaymentMethod.CREDIT}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded font-bold disabled:opacity-50 text-slate-950 dark:text-slate-50"
                  />
                </div>
              </div>

              {paymentMethod === PaymentMethod.CASH && parseFloat(paidAmount || '0') > total && (
                <div className="flex justify-between items-center text-sm font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900">
                  <span>ਵਾਪਸੀ ਬਾਕੀ (Change Return):</span>
                  <span>{formatPrice(parseFloat(paidAmount || '0') - total)}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3 text-lg font-extrabold">
                <span className="text-slate-500">{t('total')}:</span>
                <span className="text-2xl text-blue-650 dark:text-blue-400">{formatPrice(total)}</span>
              </div>

              <div className="relative flex w-full">
                <button
                  type="button"
                  onClick={() => handleCheckout(true)}
                  disabled={submitting || cart.length === 0}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-l-xl text-lg font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-5 h-5" />
                  {submitting ? 'ਬਿੱਲ ਬਣ ਰਿਹਾ ਹੈ...' : 'ਰਸੀਦ ਪ੍ਰਿੰਟ ਕਰੋ (Print Receipt)'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintDropdown(!showPrintDropdown)}
                  disabled={submitting || cart.length === 0}
                  className="px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-r-xl border-l border-blue-500 shadow-md transition-all flex items-center justify-center disabled:opacity-50"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                
                {showPrintDropdown && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden z-30">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintDropdown(false);
                        handleCheckout(true);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                    >
                      ਡਾਇਰੈਕਟ ਪ੍ਰਿੰਟ (Direct Print)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintDropdown(false);
                        handleCheckout(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold border-t border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                    >
                      ਪੂਰਵਦਰਸ਼ਨ (Preview Receipt)
                    </button>
                  </div>
                )}
              </div>
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
                          {formatPrice(Number(p.sellingPrice))}
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
                            onClick={async () => {
                              try {
                                const fullSale = await getSaleAction(sale.id);
                                if (fullSale) {
                                  setSelectedInvoiceForPrint(fullSale);
                                } else {
                                  showToast('Unable to load invoice details', 'error');
                                }
                              } catch (err: any) {
                                showToast(err.message || 'Error loading invoice', 'error');
                              }
                            }}
                            className="p-2 border border-slate-205 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350"
                            title="Print Receipt"
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
      {selectedInvoiceForPrint && (() => {
        const format = shop?.settings?.receiptFormat || 'SIMPLE';
        const printer = shop?.settings?.printerType || 'THERMAL_80';
        const gstRegistered = shop?.gstRegistered || false;
        
        // Detailed layout is only GST-active if layout is DETAILED and shop is GST-registered
        const showGST = gstRegistered && format === 'DETAILED';
        const headerTitle = showGST ? 'TAX INVOICE' : 'RETAIL RECEIPT';

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden p-6 max-h-[90vh] flex flex-col">
              
              {/* Modal actions, hidden on print */}
              <div className="flex justify-between items-center mb-6 shrink-0 no-print">
                <h2 className="text-xl font-bold">ਰਸੀਦ ਦੇਖੋ (Receipt Preview)</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-605 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 bg-blue-600"
                  >
                    <Printer className="w-4 h-4" />
                    ਰਸੀਦ ਪ੍ਰਿੰਟ ਕਰੋ (Print Receipt)
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
              <div className={`flex-1 overflow-y-auto pr-1 print-area font-sans text-black dark:text-white p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 print-${printer}`}>
                {printer === 'A4' ? (
                  /* ==================== A4 LAYOUT ==================== */
                  <div className="space-y-6 text-sm text-slate-800 p-2">
                    {/* Top Header Grid */}
                    <div className="flex justify-between items-start border-b pb-4">
                      <div className="flex gap-4 items-center">
                        {shop?.logo && (
                          <div className="w-16 h-16 overflow-hidden flex items-center justify-center border rounded">
                            <img src={shop.logo} alt="Logo" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div>
                          <h2 className="text-2xl font-bold uppercase text-slate-900">{shop?.name}</h2>
                          {shop?.address && <p className="text-xs">{shop.address}</p>}
                          {shop?.phone && <p className="text-xs">Phone: {shop.phone}</p>}
                          {shop?.email && <p className="text-xs">Email: {shop.email}</p>}
                          {showGST && shop?.gst && <p className="text-xs font-semibold">GSTIN: {shop.gst}</p>}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <h3 className="text-xl font-black text-blue-700">{headerTitle}</h3>
                        <p className="text-xs"><strong>{showGST ? 'Invoice No' : 'Receipt No'}:</strong> {selectedInvoiceForPrint.invoiceNumber}</p>
                        <p className="text-xs"><strong>Date:</strong> {new Date(selectedInvoiceForPrint.date).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Customer / Billed To Section */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Billed To (ਖਰੀਦਦਾਰ)</h4>
                        <p className="font-bold text-slate-900">{selectedInvoiceForPrint.customer?.name || 'Walk-in Customer'}</p>
                        {selectedInvoiceForPrint.customer?.mobile && <p className="text-xs">Mobile: {selectedInvoiceForPrint.customer.mobile}</p>}
                        {selectedInvoiceForPrint.customer?.address && <p className="text-xs">Address: {selectedInvoiceForPrint.customer.address}</p>}
                      </div>
                      <div className="text-right">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Payment Details</h4>
                        <p className="text-xs"><strong>Method:</strong> {selectedInvoiceForPrint.paymentMethod}</p>
                        <p className="text-xs"><strong>Status:</strong> {selectedInvoiceForPrint.dueAmount > 0 ? 'PARTIAL/DUE' : 'PAID'}</p>
                      </div>
                    </div>

                    {/* Product Table */}
                    <table className="w-full text-sm text-left border-collapse border">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b font-mono">
                          <th className="py-2.5 px-3 border text-center">#</th>
                          <th className="py-2.5 px-3 border">Item</th>
                          {showGST && <th className="py-2.5 px-3 border text-center">HSN</th>}
                          <th className="py-2.5 px-3 border text-center">Qty</th>
                          <th className="py-2.5 px-3 border text-right">Rate</th>
                          {showGST && <th className="py-2.5 px-3 border text-center">GST</th>}
                          <th className="py-2.5 px-3 border text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedInvoiceForPrint.items?.map((item: any, idx: number) => {
                          const originalPrice = Number(item.originalPrice || item.sellingPrice);
                          const quantity = Number(item.quantity);
                          const itemDiscount = Number(item.itemDiscount || 0);
                          const lineTotal = quantity * Number(item.sellingPrice);
                          
                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 border text-center">{idx + 1}</td>
                              <td className="py-2 px-3 border">
                                <div className="font-semibold text-slate-900">{item.product?.namePa}</div>
                                <div className="text-[10px] text-slate-500">{item.product?.nameEn}</div>
                                {itemDiscount > 0 && (
                                  <div className="text-[10px] text-amber-600 font-bold">
                                    Discount: -{formatPrice(itemDiscount)} {item.discountType === 'PERCENT' ? `(${item.itemDiscount}%)` : ''}
                                  </div>
                                )}
                              </td>
                              {showGST && <td className="py-2 px-3 border text-center">{item.product?.hsn || '-'}</td>}
                              <td className="py-2 px-3 border text-center">
                                {quantity} {item.product?.unit}
                              </td>
                              <td className="py-2 px-3 border text-right">{formatPrice(originalPrice)}</td>
                              {showGST && <td className="py-2 px-3 border text-center">{item.product?.gstRate ? `${item.product.gstRate}%` : '0%'}</td>}
                              <td className="py-2 px-3 border text-right font-semibold">{formatPrice(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Totals Summary */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div>
                        {shop?.returnPolicy && (
                          <div className="p-3 bg-slate-50 border rounded-lg text-xs text-slate-500 whitespace-pre-line">
                            <strong className="text-slate-700 block mb-1">Return Policy & Terms:</strong>
                            {shop.returnPolicy}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 text-right max-w-sm ml-auto w-full">
                        {(() => {
                          const rawSubTotal = selectedInvoiceForPrint.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) * Number(item.originalPrice || item.sellingPrice), 0) || 0;
                          const itemDiscountTotal = selectedInvoiceForPrint.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) * (Number(item.originalPrice || item.sellingPrice) - Number(item.sellingPrice)), 0) || 0;
                          const billDiscountAmt = Number(selectedInvoiceForPrint.billDiscount || 0);
                          const totalDiscount = itemDiscountTotal + billDiscountAmt;
                          
                          return (
                            <>
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>Subtotal:</span>
                                <span>{formatPrice(rawSubTotal)}</span>
                              </div>
                              {itemDiscountTotal > 0 && (
                                <div className="flex justify-between text-xs text-amber-600">
                                  <span>Item Discount:</span>
                                  <span>- {formatPrice(itemDiscountTotal)}</span>
                                </div>
                              )}
                              {billDiscountAmt > 0 && (
                                <div className="flex justify-between text-xs text-rose-600">
                                  <span>Bill Discount:</span>
                                  <span>- {formatPrice(billDiscountAmt)}</span>
                                </div>
                              )}
                              {totalDiscount > 0 && (
                                <div className="flex justify-between text-xs text-emerald-600 font-bold border-t border-dashed pt-1">
                                  <span>Total Discount Given:</span>
                                  <span>{formatPrice(totalDiscount)}</span>
                                </div>
                              )}
                              {selectedInvoiceForPrint.discountReason && (
                                <div className="text-[10px] text-slate-500 italic text-right">
                                  Reason: {selectedInvoiceForPrint.discountReason}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* GST breakdown summary if enabled */}
                        {showGST && (
                          <div className="border-t border-dashed py-1.5 my-1.5 space-y-1 text-xs text-slate-500">
                            <div className="flex justify-between">
                              <span>CGST (9%):</span>
                              <span>{formatPrice((Number(selectedInvoiceForPrint.total) - Number(selectedInvoiceForPrint.subTotal) * 0.84) / 2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>SGST (9%):</span>
                              <span>{formatPrice((Number(selectedInvoiceForPrint.total) - Number(selectedInvoiceForPrint.subTotal) * 0.84) / 2)}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between text-base font-bold border-t pt-2 text-slate-900">
                          <span>Grand Total:</span>
                          <span>{formatPrice(Number(selectedInvoiceForPrint.total))}</span>
                        </div>
                        
                        <div className="border-t pt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <span>Paid:</span>
                            <span>{formatPrice(Number(selectedInvoiceForPrint.paidAmount))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Change Returned:</span>
                            <span>{formatPrice(Math.max(0, Number(selectedInvoiceForPrint.paidAmount) - Number(selectedInvoiceForPrint.total)))}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signatures & Footer */}
                    <div className="flex justify-between items-end pt-12 border-t mt-8">
                      <p className="text-xs text-slate-400">{shop?.footerMessage || 'Thank You! Visit Again'}</p>
                      <div className="text-center w-48 border-t pt-2">
                        <p className="text-xs font-bold text-slate-800">Authorized Signature</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ==================== THERMAL (58mm / 80mm) LAYOUT ==================== */
                  <div className="space-y-4">
                    <div className="text-center border-b border-dashed border-slate-350 pb-4 mb-4">
                      {shop?.logo && (
                        <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center overflow-hidden">
                          <img src={shop.logo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <h2 className="text-lg font-black uppercase tracking-tight">{shop?.name}</h2>
                      {shop?.address && <p className="text-[11px] mt-0.5">{shop.address}</p>}
                      {shop?.phone && <p className="text-[11px]">Mob: {shop.phone}</p>}
                      {showGST && shop?.gst && <p className="text-[11px] font-bold">GSTIN: {shop.gst}</p>}
                      <h3 className="text-[11px] font-bold border border-black dark:border-white inline-block px-2.5 py-0.5 mt-2.5 uppercase tracking-wider">
                        {headerTitle}
                      </h3>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 text-[11px] gap-y-0.5 mb-2 font-mono">
                      <div><strong>{showGST ? 'Invoice No' : 'Receipt No'}:</strong> {selectedInvoiceForPrint.invoiceNumber}</div>
                      <div className="text-right"><strong>Date:</strong> {new Date(selectedInvoiceForPrint.date).toLocaleString()}</div>
                      <div><strong>Customer:</strong> {selectedInvoiceForPrint.customer?.name || 'Walk-in'}</div>
                      <div className="text-right"><strong>Cashier:</strong> {selectedInvoiceForPrint.user?.name || 'Staff'}</div>
                    </div>

                    {/* Product Table */}
                    <table className="w-full text-[11px] text-left border-t border-b border-dashed border-black dark:border-white py-1.5 mb-2 border-collapse font-mono">
                      <thead>
                        <tr className="border-b border-dashed border-black font-bold">
                          <th className="py-1">Item</th>
                          {showGST && <th className="py-1 text-center">HSN</th>}
                          <th className="py-1 text-center">Qty</th>
                          <th className="py-1 text-right">Rate</th>
                          {showGST && <th className="py-1 text-center">GST</th>}
                          <th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoiceForPrint.items?.map((item: any) => {
                          const originalPrice = Number(item.originalPrice || item.sellingPrice);
                          const quantity = Number(item.quantity);
                          const itemDiscount = Number(item.itemDiscount || 0);
                          const lineTotal = quantity * Number(item.sellingPrice);
                          
                          return (
                            <tr key={item.id}>
                              <td className="py-1.5 pr-1">
                                <div className="font-bold">{item.product?.namePa}</div>
                                <div className="text-[9px] text-slate-500">{item.product?.nameEn}</div>
                                {itemDiscount > 0 && (
                                  <div className="text-[9px] text-amber-600 font-bold">
                                    Disc: -{formatPrice(itemDiscount)} {item.discountType === 'PERCENT' ? `(${item.itemDiscount}%)` : ''}
                                  </div>
                                )}
                              </td>
                              {showGST && <td className="py-1.5 text-center">{item.product?.hsn || '-'}</td>}
                              <td className="py-1.5 text-center">
                                {quantity} {item.product?.unit}
                              </td>
                              <td className="py-1.5 text-right">{formatPrice(originalPrice)}</td>
                              {showGST && <td className="py-1.5 text-center">{item.product?.gstRate ? `${item.product.gstRate}%` : '0%'}</td>}
                              <td className="py-1.5 text-right font-bold">{formatPrice(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Summary */}
                    <div className="w-full text-[11px] space-y-1 pb-2 border-b border-dashed border-black dark:border-white font-mono">
                      <div className="flex justify-between">
                        <span>Total Items:</span>
                        <span>{selectedInvoiceForPrint.items?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Quantity:</span>
                        <span>{selectedInvoiceForPrint.items?.reduce((sum: number, i: any) => sum + Number(i.quantity), 0) || 0}</span>
                      </div>
                      {(() => {
                        const rawSubTotal = selectedInvoiceForPrint.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) * Number(item.originalPrice || item.sellingPrice), 0) || 0;
                        const itemDiscountTotal = selectedInvoiceForPrint.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) * (Number(item.originalPrice || item.sellingPrice) - Number(item.sellingPrice)), 0) || 0;
                        const billDiscountAmt = Number(selectedInvoiceForPrint.billDiscount || 0);
                        const totalDiscount = itemDiscountTotal + billDiscountAmt;
                        
                        return (
                          <>
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{formatPrice(rawSubTotal)}</span>
                            </div>
                            {itemDiscountTotal > 0 && (
                              <div className="flex justify-between text-amber-600">
                                <span>Item Discount:</span>
                                <span>- {formatPrice(itemDiscountTotal)}</span>
                              </div>
                            )}
                            {billDiscountAmt > 0 && (
                              <div className="flex justify-between text-rose-600">
                                <span>Bill Discount:</span>
                                <span>- {formatPrice(billDiscountAmt)}</span>
                              </div>
                            )}
                            {totalDiscount > 0 && (
                              <div className="flex justify-between text-emerald-600 font-bold border-t border-dashed pt-0.5">
                                <span>Total Discount:</span>
                                <span>{formatPrice(totalDiscount)}</span>
                              </div>
                            )}
                            {selectedInvoiceForPrint.discountReason && (
                              <div className="text-[9px] text-slate-500 italic text-right">
                                Reason: {selectedInvoiceForPrint.discountReason}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      
                      {/* GST breakdown table */}
                      {showGST && (
                        <div className="border-t border-dashed py-1 text-slate-500 text-[10px]">
                          <div className="flex justify-between">
                            <span>CGST:</span>
                            <span>{formatPrice((Number(selectedInvoiceForPrint.total) - Number(selectedInvoiceForPrint.subTotal) * 0.84) / 2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST:</span>
                            <span>{formatPrice((Number(selectedInvoiceForPrint.total) - Number(selectedInvoiceForPrint.subTotal) * 0.84) / 2)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-xs font-black border-t border-dashed pt-1">
                        <span>Grand Total:</span>
                        <span>{formatPrice(Number(selectedInvoiceForPrint.total))}</span>
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="grid grid-cols-2 text-[10px] gap-y-0.5 font-mono pt-1">
                      <div><strong>Payment Method:</strong> {selectedInvoiceForPrint.paymentMethod}</div>
                      <div className="text-right"><strong>Paid Amount:</strong> {formatPrice(Number(selectedInvoiceForPrint.paidAmount))}</div>
                      <div><strong>Change Returned:</strong> {formatPrice(Math.max(0, Number(selectedInvoiceForPrint.paidAmount) - Number(selectedInvoiceForPrint.total)))}</div>
                    </div>

                    {shop?.footerMessage && (
                      <p className="text-center text-[10px] pt-2 border-t border-dashed mt-4 whitespace-pre-line italic">
                        {shop.footerMessage}
                      </p>
                    )}
                    
                    {shop?.returnPolicy && (
                      <div className="text-center text-[9px] mt-1 border-t border-dashed pt-1 whitespace-pre-line text-slate-500">
                        <strong>Return Policy:</strong><br />
                        {shop.returnPolicy}
                      </div>
                    )}
                  </div>
                )}
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
        );
      })()}

      {/* Confirm Sale Reversal Dialog */}
      <ConfirmDialog
        isOpen={reversalTarget !== null}
        title="ਬਿੱਲ ਰਿਵਰਸ ਕਰੋ? (Reverse Invoice?)"
        message={`ਕੀ ਤੁਸੀਂ ਸੱਚਮੁੱਚ ਬਿੱਲ ${reversalTarget?.invoiceNumber} ਨੂੰ ਰਿਵਰਸ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ? ਇਹ ਸਟਾਕ ਵਾਪਸ ਕਰੇਗਾ ਅਤੇ ਬਕਾਇਆ ਰੱਦ ਕਰ ਦੇਵੇਗਾ।`}
        confirmLabel="ਰਿਵਰਸ ਕਰੋ (Reverse)"
        cancelLabel="ਬੰਦ ਕਰੋ (Cancel)"
        onConfirm={handleConfirmReverse}
        onClose={() => setReversalTarget(null)}
        isDestructive={true}
      />

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6 relative">
            <button
              onClick={() => setShowAddCustomerModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b pb-2 mb-4">
              ਨਵਾਂ ਗਾਹਕ ਜੋੜੋ (Quick Add Customer)
            </h3>
            <form onSubmit={handleQuickAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  ਗਾਹਕ ਦਾ ਨਾਮ (Customer Name)
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-semibold"
                  placeholder="e.g. Gurpreet Singh"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  ਮੋਬਾਈਲ ਨੰਬਰ (Mobile Number - Optional)
                </label>
                <input
                  type="text"
                  value={newCustomerMobile}
                  onChange={(e) => setNewCustomerMobile(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-semibold"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300"
                >
                  ਰੱਦ ਕਰੋ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold active:scale-95"
                >
                  {savingCustomer ? 'ਸੇਵ ਹੋ ਰਿਹਾ...' : 'ਸੇਵ ਕਰੋ (Save)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Reason Required Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6 relative">
            <button
              onClick={() => setShowReasonModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b pb-2 mb-4">
              ਡਿਸਕਾਊਂਟ ਦਾ ਕਾਰਨ (Discount Reason Required)
            </h3>
            
            <p className="text-xs text-slate-550 dark:text-slate-400 mb-4">
              ਲਾਗੂ ਕੀਤਾ ਡਿਸਕਾਊਂਟ ਨਿਰਧਾਰਿਤ ਸੀਮਾ ਤੋਂ ਵੱਡਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਾਰਨ ਚੁਣੋ:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-550 mb-1">
                  ਕਾਰਨ ਚੁਣੋ (Select Reason)
                </label>
                <select
                  value={reasonSelected}
                  onChange={(e) => setReasonSelected(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-550 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-950 dark:text-slate-50"
                >
                  <option value="Regular Customer">ਪੁਰਾਣਾ ਗਾਹਕ (Regular Customer)</option>
                  <option value="Damaged Product">ਖਰਾਬ ਮਾਲ (Damaged Product)</option>
                  <option value="Festival Offer">ਤਿਉਹਾਰ ਦੀ ਪੇਸ਼ਕਸ਼ (Festival Offer)</option>
                  <option value="Clearance Sale">ਕਲੀਅਰੈਂਸ ਸੇਲ (Clearance Sale)</option>
                  <option value="Price Match">ਮੁੱਲ ਮੇਲ (Price Match)</option>
                  <option value="Other">ਹੋਰ (Other)</option>
                </select>
              </div>

              {reasonSelected === 'Other' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    ਵੇਰਵਾ ਲਿਖੋ (Enter Custom Reason)
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-semibold"
                    placeholder="e.g. Special owner approval"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-105 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-350"
                >
                  ਰੱਦ ਕਰੋ (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalReason = reasonSelected === 'Other' ? customReason : reasonSelected;
                    if (reasonSelected === 'Other' && !customReason.trim()) {
                      showToast('Please enter a custom reason', 'warning');
                      return;
                    }
                    setShowReasonModal(false);
                    executeCheckout(autoPrintAfterReason, finalReason);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold active:scale-95"
                >
                  ਬਿੱਲ ਪੂਰਾ ਕਰੋ (Complete Checkout)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State for Invoice History */}
      {activeTab === 'invoices' && invoices.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={History}
            title="ਕੋਈ ਬਿੱਲ ਨਹੀਂ ਮਿਲਿਆ (No Invoices Found)"
            description="ਕੋਈ ਬਿੱਲ ਜਨਰੇਟ ਨਹੀਂ ਕੀਤਾ ਗਿਆ ਹੈ। ਵਿਕਰੀ ਕਰਨ ਲਈ POS 'ਤੇ ਜਾਓ।"
            actionLabel="ਬਿੱਲ ਬਣਾਓ (Go to POS)"
            onAction={() => setActiveTab('pos')}
          />
        </div>
      )}

    </div>
  );
}
