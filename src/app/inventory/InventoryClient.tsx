'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema } from '../../validation';
import { useTranslation } from '../../hooks/useTranslation';
import {
  addProductAction,
  updateProductAction,
  deleteProductAction,
  importCsvAction,
  getProductStockHistoryAction,
  adjustStockAction,
} from '../../lib/actions/inventory';
import { z } from 'zod';
import { TransactionType } from '@prisma/client';
import {
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Edit2,
  Trash2,
  History,
  AlertTriangle,
  X,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Copy,
  PlusCircle,
  FileText,
} from 'lucide-react';

type ProductInputs = z.infer<typeof productSchema>;

interface InventoryClientProps {
  productsData: {
    items: any[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
  categories: string[];
  suppliers: any[];
  currentFilters: {
    search: string;
    category: string;
    lowStockOnly: boolean;
    page: number;
  };
}

// EAN-13 Barcode generator
function generateEAN13(): string {
  let code = '';
  // 12 random digits
  for (let i = 0; i < 12; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  // Checksum calculation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code.charAt(i), 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum.toString();
}

export default function InventoryClient({
  productsData,
  categories,
  suppliers,
  currentFilters,
}: InventoryClientProps) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchVal, setSearchVal] = useState(currentFilters.search);
  const [selectedCat, setSelectedCat] = useState(currentFilters.category);
  const [lowStockToggle, setLowStockToggle] = useState(currentFilters.lowStockOnly);

  // UI state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<any | null>(null);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  
  // More options dropdown
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // Success toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Inline category creation state
  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Quick Add Mode Toggle
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  
  // Duplicate caching
  const [lastCreatedProduct, setLastCreatedProduct] = useState<any | null>(null);
  
  // Direct stock adjustment dialog state
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustPrice, setAdjustPrice] = useState<string>('');
  const [adjustType, setAdjustType] = useState<TransactionType>(TransactionType.ADJUSTMENT);
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Refs for Autofocus
  const nameEnInputRef = useRef<HTMLInputElement>(null);
  const quickNameInputRef = useRef<HTMLInputElement>(null);
  const focusRef = isQuickAddMode ? quickNameInputRef : nameEnInputRef;

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      barcode: '',
      nameEn: '',
      namePa: '',
      category: 'General',
      purchasePrice: 0,
      sellingPrice: 0,
      currentQuantity: 0,
      unit: 'PCS',
      minStock: 5,
      supplierId: '',
    }
  });

  // Keep last category and supplier values for Quick Add flow
  const lastSelectedCategory = useRef<string>('General');
  const lastSelectedSupplier = useRef<string>('');

  // Auto-focus logic when modal opens or resets
  useEffect(() => {
    if (isAddEditOpen) {
      setTimeout(() => {
        focusRef.current?.focus();
      }, 50);
    }
  }, [isAddEditOpen, isQuickAddMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keyboard navigation handler (Enter focuses the next input field)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      ) {
        // Skip default form submission
        e.preventDefault();
        
        // Query all focusable controls
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll(
            'input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])'
          )
        ) as HTMLElement[];
        
        const index = focusable.indexOf(target);
        if (index > -1 && index < focusable.length - 1) {
          focusable[index + 1].focus();
        }
      }
    }
  };

  // Apply filters by changing URL
  const applyFilters = (search: string, cat: string, lowStock: boolean, pageNum = 1) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (cat && cat !== 'ALL') params.set('category', cat);
    if (lowStock) params.set('lowStock', 'true');
    if (pageNum > 1) params.set('page', pageNum.toString());

    startTransition(() => {
      router.push(`/inventory?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(searchVal, selectedCat, lowStockToggle, 1);
  };

  // Inline category adder
  const handleAddCategoryInline = () => {
    const trimmed = inlineCategoryName.trim();
    if (trimmed) {
      if (!categories.includes(trimmed) && !customCategories.includes(trimmed)) {
        setCustomCategories((prev) => [...prev, trimmed]);
      }
      setValue('category', trimmed);
      lastSelectedCategory.current = trimmed;
      setIsCreatingCategoryInline(false);
      setInlineCategoryName('');
      showToast(language === 'en' ? 'Category created inline' : 'ਕੈਟੇਗਰੀ ਇਨਲਾਈਨ ਜੋੜੀ ਗਈ ✓');
    }
  };

  // Auto generate barcode
  const handleGenerateBarcode = () => {
    let uniqueBarcode = generateEAN13();
    // In production we would do duplicate checks, here we populate EAN-13 directly
    setValue('barcode', uniqueBarcode);
    showToast(language === 'en' ? 'EAN-13 Barcode generated' : 'ਬਾਰਕੋਡ ਤਿਆਰ ਕੀਤਾ ਗਿਆ ✓');
  };

  // Submit product creation
  const saveProduct = async (data: ProductInputs, shouldAddNext = false) => {
    try {
      setLoading(true);
      
      // Auto-translate rule checks
      let nameEn = data.nameEn || '';
      let namePa = data.namePa || '';
      if (!nameEn.trim() && namePa.trim()) {
        nameEn = namePa;
      } else if (!namePa.trim() && nameEn.trim()) {
        namePa = nameEn;
      }

      const payload = {
        ...data,
        nameEn,
        namePa,
        category: data.category || 'General',
        unit: data.unit || 'PCS',
        minStock: Number(data.minStock) || 5,
        purchasePrice: Number(data.purchasePrice) || 0,
        sellingPrice: Number(data.sellingPrice) || 0,
        currentQuantity: Number(data.currentQuantity) || 0,
      };

      if (editingProduct) {
        const res = await updateProductAction(editingProduct.id, payload);
        if (res.success) {
          setIsAddEditOpen(false);
          setEditingProduct(null);
          showToast(language === 'en' ? 'Product updated ✓' : 'ਉਤਪਾਦ ਅਪਡੇਟ ਹੋਇਆ ✓');
          router.refresh();
        }
      } else {
        const res = await addProductAction(payload);
        if (res.success) {
          showToast(language === 'en' ? 'Product Created ✓' : 'ਉਤਪਾਦ ਜੋੜਿਆ ਗਿਆ ✓');
          setLastCreatedProduct(res.product);

          // Track last selections
          if (data.category) lastSelectedCategory.current = data.category;
          if (data.supplierId) lastSelectedSupplier.current = data.supplierId;

          if (shouldAddNext) {
            // Reset for next, keeping category and supplier
            reset({
              sku: '',
              barcode: '',
              nameEn: '',
              namePa: '',
              category: lastSelectedCategory.current,
              purchasePrice: isQuickAddMode ? Number(data.purchasePrice) : 0,
              sellingPrice: isQuickAddMode ? Number(data.sellingPrice) : 0,
              currentQuantity: 0,
              unit: 'PCS',
              minStock: 5,
              supplierId: lastSelectedSupplier.current,
            });
            setTimeout(() => {
              focusRef.current?.focus();
            }, 50);
          } else {
            setIsAddEditOpen(false);
            reset();
          }
          router.refresh();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error saving product');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = (prod: any) => {
    // Fill out form fields except Name, SKU, Barcode
    reset({
      sku: '',
      barcode: '',
      nameEn: '',
      namePa: '',
      category: prod.categoryName || 'General',
      purchasePrice: Number(prod.purchasePrice),
      sellingPrice: Number(prod.sellingPrice),
      currentQuantity: 0,
      unit: prod.unit,
      minStock: Number(prod.minStock || prod.reorderLevel),
      supplierId: prod.supplierId || '',
    });
    setEditingProduct(null);
    setIsAddEditOpen(true);
    showToast(language === 'en' ? 'Product settings duplicated. Enter name.' : 'ਉਤਪਾਦ ਕਾਪੀ ਹੋ ਗਿਆ। ਨਵਾਂ ਨਾਮ ਦਰਜ ਕਰੋ।');
  };

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    reset({
      sku: product.sku || '',
      barcode: product.barcode || '',
      nameEn: product.nameEn,
      namePa: product.namePa,
      category: product.categoryName || '',
      purchasePrice: Number(product.purchasePrice),
      sellingPrice: Number(product.sellingPrice),
      currentQuantity: Number(product.currentQuantity),
      unit: product.unit,
      minStock: Number(product.minStock || product.reorderLevel),
      supplierId: product.supplierId || '',
    });
    setIsAddEditOpen(true);
  };

  const handleDeleteClick = async (id: string, name: string) => {
    if (confirm(language === 'en' ? `Are you sure you want to delete ${name}?` : `ਕੀ ਤੁਸੀਂ ਸੱਚਮੁੱਚ ${name} ਮਿਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?`)) {
      try {
        await deleteProductAction(id);
        showToast(language === 'en' ? 'Product deleted' : 'ਉਤਪਾਦ ਮਿਟਾਇਆ ਗਿਆ ✓');
        router.refresh();
      } catch (err: any) {
        alert(err.message || 'Error deleting product');
      }
    }
  };

  const handleHistoryClick = async (product: any) => {
    setSelectedProductForHistory(product);
    try {
      const history = await getProductStockHistoryAction(product.id);
      setHistoryItems(history);
      setIsHistoryOpen(true);
    } catch (err: any) {
      alert(err.message || 'Error loading stock history');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    try {
      setLoading(true);
      const res = await importCsvAction(csvText);
      alert(`Import complete! Imported: ${res.importedCount}, Updated: ${res.updatedCount}, Failed: ${res.failedCount}`);
      setIsCsvOpen(false);
      setCsvText('');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'CSV Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjust = (prod: any) => {
    setAdjustProduct(prod);
    setAdjustQty('');
    setAdjustPrice(Number(prod.purchasePrice).toString());
    setAdjustType(TransactionType.ADJUSTMENT);
    setAdjustNote('');
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;

    const qty = parseFloat(adjustQty);
    const price = parseFloat(adjustPrice);

    if (isNaN(qty) || qty === 0) {
      alert(language === 'en' ? 'Enter a valid non-zero quantity' : 'ਸਹੀ ਮਾਤਰਾ ਦਰਜ ਕਰੋ (ਨਾਨ-ਜ਼ੀਰੋ)');
      return;
    }

    try {
      setLoading(true);
      await adjustStockAction({
        productId: adjustProduct.id,
        quantity: qty,
        type: adjustType,
        price,
        note: adjustNote.trim() || 'Manual stock adjustment from inventory panel',
      });
      setAdjustProduct(null);
      showToast(language === 'en' ? 'Stock ledger transaction recorded ✓' : 'ਸਟਾਕ ਲੇਜਰ ਟ੍ਰਾਂਜੈਕਸ਼ਨ ਦਰਜ ਕੀਤੀ ਗਈ ✓');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Stock adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  // Combine popular recent categories with existing db list
  const popularCategories = ['Grocery', 'Dairy', 'Snacks', 'Beverages', 'General'];
  const allCategoriesList = Array.from(new Set([...popularCategories, ...categories, ...customCategories]));

  return (
    <div className="space-y-6">
      
      {/* TOAST SUCCESS BANNER */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[999] bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FILTERING & ACTIONS BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search by name, SKU, barcode...' : 'ਉਤਪਾਦ ਦਾ ਨਾਮ, ਕੋਡ ਜਾਂ ਬਾਰਕੋਡ ਲੱਭੋ...'}
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={selectedCat}
              onChange={(e) => {
                setSelectedCat(e.target.value);
                applyFilters(searchVal, e.target.value, lowStockToggle, 1);
              }}
              className="flex-1 md:w-48 px-3 py-2 border border-slate-300 dark:border-slate-850 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none"
            >
              <option value="ALL">
                {language === 'en' ? 'All Categories' : 'ਸਾਰੀਆਂ ਸ਼੍ਰੇਣੀਆਂ'}
              </option>
              {allCategoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const next = !lowStockToggle;
                setLowStockToggle(next);
                applyFilters(searchVal, selectedCat, next, 1);
              }}
              className={`px-4 py-2 border rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                lowStockToggle
                  ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                  : 'border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {language === 'en' ? 'Low Stock' : 'ਘੱਟ ਸਟਾਕ'}
            </button>
            
            {/* DROPDOWN MENU FOR SECONDARY CSV ACTIONS */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-1 text-slate-700 dark:text-slate-200"
              >
                <span>{language === 'en' ? 'More' : 'ਹੋਰ'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-25 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCsvOpen(true);
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'en' ? 'Import CSV' : 'CSV ਅਪਲੋਡ'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setEditingProduct(null);
                reset({
                  sku: '',
                  barcode: '',
                  nameEn: '',
                  namePa: '',
                  category: 'General',
                  purchasePrice: 0,
                  sellingPrice: 0,
                  currentQuantity: 0,
                  unit: 'PCS',
                  minStock: 5,
                  supplierId: '',
                });
                setIsAddEditOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>{language === 'en' ? 'Add Product' : 'ਉਤਪਾਦ ਜੋੜੋ'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* PRODUCTS LIST TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-250 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-6">{language === 'en' ? 'Product Name' : 'ਉਤਪਾਦ'}</th>
                <th className="py-3 px-6">{language === 'en' ? 'SKU / Barcode' : 'ਆਈਟਮ ਕੋਡ (SKU)'}</th>
                <th className="py-3 px-6">{language === 'en' ? 'Category' : 'ਸ਼੍ਰੇਣੀ (ਕੈਟੇਗਰੀ)'}</th>
                <th className="py-3 px-6 text-right">{language === 'en' ? 'Cost Price' : 'ਖਰੀਦ ਰੇਟ'}</th>
                <th className="py-3 px-6 text-right">{language === 'en' ? 'Sale Price' : 'ਵੇਚ ਰੇਟ'}</th>
                <th className="py-3 px-6 text-center">{language === 'en' ? 'Stock level' : 'ਸਟਾਕ ਦੀ ਮਾਤਰਾ'}</th>
                <th className="py-3 px-6 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {productsData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                    No products found.
                  </td>
                </tr>
              ) : (
                productsData.items.map((product) => {
                  const isLow = Number(product.currentQuantity) <= Number(product.minStock || product.reorderLevel);
                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${
                        isLow ? 'bg-red-50/30 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {product.namePa}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{product.nameEn}</div>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-700 dark:text-slate-350">
                          {product.sku || '-'}
                        </div>
                        {product.barcode && (
                          <div className="text-[10px] text-slate-400 mt-0.5">[{product.barcode}]</div>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-1 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800">
                          {product.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold font-mono">
                        ₹{Number(product.purchasePrice).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold font-mono text-blue-650 dark:text-blue-400">
                        ₹{Number(product.sellingPrice).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-lg text-sm font-extrabold ${
                            isLow
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-350'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-350'
                          }`}
                        >
                          {Number(product.currentQuantity)} {product.unit}
                        </span>
                        {isLow && (
                          <div className="text-[10px] text-rose-500 font-bold mt-1 animate-pulse">
                            LOW STOCK
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleHistoryClick(product)}
                            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="Stock History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAdjust(product)}
                            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-600"
                            title="Adjust Stock"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(product)}
                            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-650"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(product)}
                            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-amber-600"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(product.id, product.nameEn)}
                            className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {productsData.pages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between">
            <button
              disabled={currentFilters.page <= 1}
              onClick={() => applyFilters(searchVal, selectedCat, lowStockToggle, currentFilters.page - 1)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-bold">
              Page {currentFilters.page} of {productsData.pages}
            </span>
            <button
              disabled={currentFilters.page >= productsData.pages}
              onClick={() => applyFilters(searchVal, selectedCat, lowStockToggle, currentFilters.page + 1)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isAddEditOpen && (
        <div className="fixed inset-0 bg-black/60 z-55 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold">
                  {editingProduct ? (language === 'en' ? 'Edit Product' : 'ਉਤਪਾਦ ਸੋਧੋ') : (language === 'en' ? 'Add New Product' : 'ਨਵਾਂ ਉਤਪਾਦ ਜੋੜੋ')}
                </h2>
                {!editingProduct && (
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMode((prev) => !prev)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isQuickAddMode 
                      ? (language === 'en' ? 'Switch to Advanced (Full Form)' : 'ਵਿਸਤ੍ਰਿਤ ਫਾਰਮ ਦੇਖੋ')
                      : (language === 'en' ? 'Switch to Quick Add (<5s Entry)' : 'ਤੁਰੰਤ ਐਂਟਰੀ (Quick Add) ਮੋਡ')
                    }
                  </button>
                )}
              </div>
              <button onClick={() => setIsAddEditOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form
              onSubmit={handleSubmit((data) => saveProduct(data, false))}
              onKeyDown={handleKeyDown}
              className="flex-1 overflow-y-auto p-6 space-y-6 pb-20 md:pb-6"
            >
              {/* Duplicate Prefill Helper Option */}
              {lastCreatedProduct && !editingProduct && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-150 p-3 rounded-lg flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
                  <span>
                    {language === 'en' ? 'Duplicate values from last product:' : 'ਪਿਛਲੇ ਜੋੜੇ ਉਤਪਾਦ ਦੀਆਂ ਸੈਟਿੰਗਾਂ ਕਾਪੀ ਕਰੋ:'}{' '}
                    <strong>{lastCreatedProduct.nameEn}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(lastCreatedProduct)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 rounded font-bold hover:bg-blue-50"
                  >
                    {language === 'en' ? 'Prefill' : 'ਕਾਪੀ ਕਰੋ'}
                  </button>
                </div>
              )}

              {/* QUICK ADD MODE COMPONENT (ONLY Name, Prices, Stock) */}
              {isQuickAddMode && !editingProduct ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {language === 'en' ? 'Product Name (English or Punjabi)' : 'ਉਤਪਾਦ ਦਾ ਨਾਮ'}
                    </label>
                    <input
                      type="text"
                      ref={quickNameInputRef}
                      value={getValues('nameEn')}
                      onChange={(e) => {
                        setValue('nameEn', e.target.value);
                        setValue('namePa', e.target.value); // Sync names on quick add
                      }}
                      placeholder="e.g. Sugar / ਖੰਡ"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-md font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {t('purchasePrice')} (₹) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={getValues('purchasePrice')}
                        onChange={(e) => setValue('purchasePrice', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-md font-bold focus:outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {t('sellingPrice')} (₹) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={getValues('sellingPrice')}
                        onChange={(e) => setValue('sellingPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-md font-bold focus:outline-none text-blue-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {language === 'en' ? 'Opening Stock Quantity (Optional)' : 'ਸ਼ੁਰੂਆਤੀ ਸਟਾਕ ਮਾਤਰਾ (ਵਿਕਲਪਿਕ)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="numeric"
                      value={getValues('currentQuantity')}
                      onChange={(e) => setValue('currentQuantity', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-md font-bold focus:outline-none"
                    />
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1 text-slate-500 dark:text-slate-400">
                    <p>
                      <strong>{language === 'en' ? 'Popped Defaults:' : 'ਆਟੋਮੈਟਿਕ ਸੈਟਿੰਗਾਂ:'}</strong> SKU: Auto-generated, Category: "{lastSelectedCategory.current}", Wholesaler: "{suppliers.find(s=>s.id===lastSelectedSupplier.current)?.name || 'None'}", Unit: "PCS", Min Alert: 5.
                    </p>
                  </div>
                </div>
              ) : (
                /* FULL ADVANCED FORM */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('sku')} (Optional)</label>
                      <input
                        type="text"
                        {...register('sku')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm focus:outline-none"
                        placeholder={language === 'en' ? 'Auto-generated if blank' : 'ਖਾਲੀ ਛੱਡਣ ਤੇ ਆਪੇ ਬਣੇਗਾ'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('barcode')} (Optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          {...register('barcode')}
                          className="mt-1.5 flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm focus:outline-none"
                          placeholder="Scan or enter barcode"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateBarcode}
                          className="mt-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700"
                        >
                          {language === 'en' ? 'Generate' : 'ਤਿਆਰ ਕਰੋ'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        {language === 'en' ? 'Product Name (English)' : 'ਉਤਪਾਦ ਦਾ ਨਾਮ (English)'}
                      </label>
                      <input
                        type="text"
                        ref={nameEnInputRef}
                        {...register('nameEn')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-semibold focus:outline-none"
                        placeholder="e.g. Sugar 1kg"
                      />
                      {errors.nameEn && <p className="mt-1 text-xs text-red-500">{errors.nameEn.message}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        {language === 'en' ? 'Product Name (Punjabi)' : 'ਉਤਪਾਦ ਦਾ ਨਾਮ (ਪੰਜਾਬੀ)'}
                      </label>
                      <input
                        type="text"
                        {...register('namePa')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-semibold focus:outline-none"
                        placeholder="e.g. ਖੰਡ 1 ਕਿਲੋ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('category')}</label>
                      {isCreatingCategoryInline ? (
                        <div className="flex gap-1.5 mt-1.5">
                          <input
                            type="text"
                            value={inlineCategoryName}
                            onChange={(e) => setInlineCategoryName(e.target.value)}
                            placeholder="New name"
                            className="flex-1 px-2.5 py-1.5 border border-blue-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddCategoryInline}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreatingCategoryInline(false)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded text-xs"
                          >
                            x
                          </button>
                        </div>
                      ) : (
                        <div className="relative flex items-center">
                          <select
                            {...register('category')}
                            onChange={(e) => {
                              if (e.target.value === 'CREATE_NEW') {
                                setIsCreatingCategoryInline(true);
                                setValue('category', '');
                              } else {
                                lastSelectedCategory.current = e.target.value;
                              }
                            }}
                            className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm focus:outline-none"
                          >
                            {allCategoriesList.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option value="CREATE_NEW" className="font-bold text-blue-600 dark:text-blue-400">
                              + {language === 'en' ? 'Create New Category' : 'ਨਵੀਂ ਕੈਟੇਗਰੀ ਬਣਾਓ'}
                            </option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('unit')}</label>
                      <input
                        type="text"
                        {...register('unit')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-bold focus:outline-none"
                        placeholder="e.g. PCS, KG"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('supplier')}</label>
                      <select
                        {...register('supplierId')}
                        onChange={(e) => { lastSelectedSupplier.current = e.target.value; }}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="">ਕੋਈ ਨਹੀਂ (None)</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('purchasePrice')}</label>
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        {...register('purchasePrice')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('sellingPrice')}</label>
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        {...register('sellingPrice')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-bold text-blue-600 dark:text-blue-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        {editingProduct ? 'Quantity (Read-Only)' : t('quantity')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        inputMode="numeric"
                        disabled={!!editingProduct}
                        {...register('currentQuantity')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-bold disabled:opacity-60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('minStock')}</label>
                      <input
                        type="number"
                        step="any"
                        inputMode="numeric"
                        {...register('minStock')}
                        className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons (Desktop Inline / Mobile Fixed Sticky) */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-850 flex gap-3 md:relative md:border-none md:p-0 md:bg-transparent md:justify-end md:pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="flex-1 md:flex-none px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold"
                >
                  {t('cancel')}
                </button>
                {!editingProduct && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSubmit((data) => saveProduct(data, true))}
                    className="flex-1 md:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-bold"
                  >
                    {language === 'en' ? 'Save + Add Next' : 'ਸੇਵ ਕਰੋ + ਅਗਲਾ ਜੋੜੋ'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 md:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-1" />
                  ) : (
                    t('save')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isCsvOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">CSV ਫਾਈਲ ਇੰਪੋਰਟ (Import Product CSV)</h2>
              <button onClick={() => setIsCsvOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste your CSV content below. The format should be: <br />
                <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-mono">
                  SKU, Barcode, NameEn, NamePa, Category, Brand, PurchasePrice, SellingPrice, Quantity, Unit, ReorderLevel, TaxRate
                </code>
              </p>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none"
                placeholder="SKU-001, 8901, Sugar 1kg, ਖੰਡ 1 ਕਿਲੋ, Grocery, BrandA, 38, 45, 100, KG, 5, 0"
              />

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsCsvOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK LEDGER TIMELINE MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                ਸਟਾਕ ਲੇਜਰ ਹਿਸਟਰੀ ({language === 'pa' ? selectedProductForHistory?.namePa : selectedProductForHistory?.nameEn})
              </h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {historyItems.length === 0 ? (
                <p className="text-center text-slate-400 py-12 font-medium">No stock movements registered for this product.</p>
              ) : (
                <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6 py-2">
                  {historyItems.map((item) => {
                    const isAddition = Number(item.quantity) > 0;
                    return (
                      <div key={item.id} className="relative">
                        {/* Dot marker */}
                        <span className={`absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full border-2 border-white dark:border-slate-900 ${
                          isAddition ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                        
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isAddition ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {item.type}
                              </span>
                              <h4 className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-205">
                                {isAddition ? 'ਸਟਾਕ ਜਮ੍ਹਾਂ (+)' : 'ਸਟਾਕ ਘਟਾਇਆ (-)'}: {Math.abs(Number(item.quantity))} {selectedProductForHistory?.unit}
                              </h4>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(item.createdAt).toLocaleString(language === 'pa' ? 'pa-IN' : 'en-US')}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3 text-xs border-t border-slate-200 dark:border-slate-800 pt-2.5 font-mono">
                            <div>
                              <span className="text-slate-400 block font-sans">Previous:</span>
                              <span className="font-bold">{Number(item.previousQty)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-sans">New Stock:</span>
                              <span className="font-extrabold text-blue-600 dark:text-blue-400">{Number(item.newQty)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-sans">Price / Cost:</span>
                              <span className="font-bold">₹{Number(item.price)}</span>
                            </div>
                          </div>

                          {item.note && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                              Note: {item.note}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0 mt-4">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT STOCK ADJUSTMENT MODAL */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/55 z-55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  {language === 'en' ? 'Stock Ledger Transaction' : 'ਸਟਾਕ ਲੇਜਰ ਟ੍ਰਾਂਜੈਕਸ਼ਨ'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                  {language === 'en' ? adjustProduct.nameEn : adjustProduct.namePa}
                </p>
              </div>
              <button
                onClick={() => setAdjustProduct(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    {language === 'en' ? 'Quantity' : 'ਮਾਤਰਾ'} ({adjustProduct.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder={language === 'en' ? 'e.g. +50 or -20' : 'ਜਿਵੇਂ +50 ਜਾਂ -20'}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none text-sm font-bold font-mono"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    {language === 'en' ? 'Price/Cost (₹)' : 'ਰੇਟ (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={adjustPrice}
                    onChange={(e) => setAdjustPrice(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none text-sm font-bold font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Adjustment Reason/Type' : 'ਟ੍ਰਾਂਜੈਕਸ਼ਨ ਦੀ ਕਿਸਮ'}
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as TransactionType)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none text-sm"
                >
                  <option value={TransactionType.ADJUSTMENT}>ADJUSTMENT (ਸਟਾਕ ਸੁਧਾਰ)</option>
                  <option value={TransactionType.DAMAGE}>DAMAGE (ਖਰਾਬ/ਟੁੱਟਿਆ ਮਾਲ)</option>
                  <option value={TransactionType.PURCHASE}>PURCHASE (ਖਰੀਦ)</option>
                  <option value={TransactionType.SALE}>SALE (ਵਿਕਰੀ)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">
                  {language === 'en' ? 'Ledger Note' : 'ਟਿੱਪਣੀ / ਵੇਰਵਾ'}
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Audit correction / Damaged stock"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustProduct(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : language === 'en' ? (
                    'Confirm Ledger Entry'
                  ) : (
                    'ਲੇਜਰ ਐਂਟਰੀ ਦਰਜ ਕਰੋ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
