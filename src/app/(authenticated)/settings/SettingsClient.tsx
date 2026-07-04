'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/lib/store';
import { updateShopSettingsAction, uploadLogoAction } from '@/lib/actions/settings';
import { importRecommendedCategoriesAction } from '@/lib/actions/categories';
import { useToastStore } from '@/lib/store/toast';
import { Language } from '@/lib/translations';
import { Store, CheckCircle, Database, FileSpreadsheet, HeartPulse, Upload, Loader2 } from 'lucide-react';
import BackupRestoreTab from './BackupRestoreTab';
import ImportExportTab from './ImportExportTab';
import SystemHealthWidget from './SystemHealthWidget';
import { BusinessType, ReceiptFormat, PrinterType } from '@prisma/client';

interface SettingsClientProps {
  shop: {
    id: string;
    name: string;
    address: string | null;
    gst: string | null;
    phone: string | null;
    email: string | null;
    footerMessage: string | null;
    returnPolicy: string | null;
    logo: string | null;
    currency: string;
    businessType?: BusinessType;
    gstRegistered: boolean;
    settings: {
      language: string;
      theme: string;
      lowStockAlert: boolean;
      receiptFormat: string;
      printerType: string;
      receiptPrefix: string;
      taxPrefix: string;
      currencySymbol: string;
      decimalPrecision: number;
      dateFormat: string;
      allowItemDiscount?: boolean;
      allowBillDiscount?: boolean;
      maxStaffDiscount?: any;
      requireDiscountReason?: boolean;
      reasonPercentLimit?: any;
      reasonAmountLimit?: any;
      autoSuggestPunjabi?: boolean;
      autoSuggestEnglish?: boolean;
    } | null;
    subscription?: {
      status: string;
      startDate: string;
      endDate: string;
      trialEndsAt: string | null;
      plan: {
        name: string;
        price: any;
        billingPeriod: string;
        features: Array<{
          id: string;
          enabled: boolean;
          limitType: string;
          limitValue: number;
          feature: { name: string; code: string; }
        }>
      }
    } | null;
  };
  role: string;
}

export default function SettingsClient({ shop, role }: SettingsClientProps) {
  const { t, setLanguage } = useTranslation();
  const { setTheme } = useAppStore();
  const { showToast } = useToastStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'profile' | 'backup' | 'import_export' | 'health'>('profile');

  // Form profile states
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address || '');
  const [gst, setGst] = useState(shop.gst || '');
  const [phone, setPhone] = useState(shop.phone || '');
  const [email, setEmail] = useState(shop.email || '');
  const [footerMessage, setFooterMessage] = useState(shop.footerMessage || '');
  const [returnPolicy, setReturnPolicy] = useState(shop.returnPolicy || '');
  const [logoPath, setLogoPath] = useState(shop.logo || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [lang, setLang] = useState<Language>((shop.settings?.language as Language) || 'pa');
  const [theme, setLocalTheme] = useState<'light' | 'dark'>((shop.settings?.theme as 'light' | 'dark') || 'light');
  const [lowStockAlert, setLowStockAlert] = useState(shop.settings?.lowStockAlert ?? true);
  const [businessType, setBusinessType] = useState<BusinessType>(shop.businessType || 'GENERAL_STORE');
  const [receiptFormat, setReceiptFormat] = useState<ReceiptFormat>((shop.settings?.receiptFormat as ReceiptFormat) || ReceiptFormat.SIMPLE);
  const [printerType, setPrinterType] = useState<PrinterType>((shop.settings?.printerType as PrinterType) || PrinterType.THERMAL_80);
  const [gstRegistered, setGstRegistered] = useState(shop.gstRegistered || false);
  const [receiptPrefix, setReceiptPrefix] = useState(shop.settings?.receiptPrefix || 'RCP-');
  const [taxPrefix, setTaxPrefix] = useState(shop.settings?.taxPrefix || 'INV-');
  const [currencySymbol, setCurrencySymbol] = useState(shop.settings?.currencySymbol || '₹');
  const [decimalPrecision, setDecimalPrecision] = useState(shop.settings?.decimalPrecision ?? 2);
  const [dateFormat, setDateFormat] = useState(shop.settings?.dateFormat || 'DD/MM/YYYY');
  
  const [allowItemDiscount, setAllowItemDiscount] = useState(shop.settings?.allowItemDiscount ?? true);
  const [allowBillDiscount, setAllowBillDiscount] = useState(shop.settings?.allowBillDiscount ?? true);
  const [maxStaffDiscount, setMaxStaffDiscount] = useState(shop.settings?.maxStaffDiscount !== undefined ? Number(shop.settings.maxStaffDiscount) : 10);
  const [requireDiscountReason, setRequireDiscountReason] = useState(shop.settings?.requireDiscountReason ?? false);
  const [reasonPercentLimit, setReasonPercentLimit] = useState(shop.settings?.reasonPercentLimit !== undefined ? Number(shop.settings.reasonPercentLimit) : 15);
  const [reasonAmountLimit, setReasonAmountLimit] = useState(shop.settings?.reasonAmountLimit !== undefined ? Number(shop.settings.reasonAmountLimit) : 500);
  
  const [autoSuggestPunjabi, setAutoSuggestPunjabi] = useState(shop.settings?.autoSuggestPunjabi ?? true);
  const [autoSuggestEnglish, setAutoSuggestEnglish] = useState(shop.settings?.autoSuggestEnglish ?? true);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await uploadLogoAction(formData);
      if (res.success && res.logoPath) {
        setLogoPath(res.logoPath);
        showToast('Logo uploaded successfully', 'success');
      } else {
        showToast(res.error || 'Failed to upload logo', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error uploading file', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePrintTestReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Popup blocked! Please allow popups to print.', 'error');
      return;
    }

    const receiptHtml = `
      <html>
        <head>
          <title>Test Print Receipt</title>
          <style>
            body { font-family: monospace; padding: 20px; color: black; }
            .text-center { text-align: center; }
            .border-dashed { border-top: 1px dashed black; margin: 10px 0; }
            .flex-between { display: flex; justify-content: space-between; }
            .print-58mm { width: 58mm; font-size: 11px; }
            .print-80mm { width: 80mm; font-size: 13px; }
            .print-a4 { width: 100%; max-width: 800px; font-family: sans-serif; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="${printerType === PrinterType.THERMAL_58 ? 'print-58mm' : printerType === PrinterType.THERMAL_80 ? 'print-80mm' : 'print-a4'}">
            <h2 class="text-center">${name || shop.name}</h2>
            <p class="text-center">*** TEST PRINT / ਟੈਸਟ ਪ੍ਰਿੰਟ ***</p>
            <p class="text-center">${address || shop.address || 'G.T. Road, Jalandhar'}</p>
            <div class="border-dashed"></div>
            <div class="flex-between">
              <span>Layout: ${receiptFormat}</span>
              <span>Printer: ${printerType}</span>
            </div>
            <div class="flex-between">
              <span>GST Registered: ${gstRegistered ? 'YES' : 'NO'}</span>
            </div>
            <div class="border-dashed"></div>
            <div class="flex-between">
              <span>Item A x 1</span>
              <span>₹100.00</span>
            </div>
            <div class="flex-between">
              <span>Item B x 2</span>
              <span>₹200.00</span>
            </div>
            <div class="border-dashed"></div>
            <div class="flex-between" style="font-weight: bold;">
              <span>Grand Total:</span>
              <span>₹300.00</span>
            </div>
            <div class="border-dashed"></div>
            <p class="text-center">Printers configuration is working fine!</p>
            <p class="text-center">${footerMessage || 'Thank You! Visit Again'}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const executeSave = async (shouldImportRecommended: boolean) => {
    setLoading(true);
    setSaved(false);

    try {
      const res = await updateShopSettingsAction({
        name,
        address,
        gst,
        phone,
        email,
        footerMessage,
        returnPolicy,
        logo: logoPath,
        language: lang,
        theme,
        lowStockAlert,
        businessType: role === 'OWNER' ? businessType : undefined,
        gstRegistered,
        receiptFormat,
        printerType,
        receiptPrefix,
        taxPrefix,
        currencySymbol,
        decimalPrecision: Number(decimalPrecision),
        dateFormat,
        allowItemDiscount,
        allowBillDiscount,
        maxStaffDiscount: Number(maxStaffDiscount),
        requireDiscountReason,
        reasonPercentLimit: Number(reasonPercentLimit),
        reasonAmountLimit: Number(reasonAmountLimit),
        autoSuggestPunjabi,
        autoSuggestEnglish,
      });

      if (res.success) {
        if (shouldImportRecommended && role === 'OWNER') {
          await importRecommendedCategoriesAction(businessType);
        }
        setLanguage(lang);
        setTheme(theme);
        setSaved(true);
        showToast('Settings saved successfully', 'success');
        router.refresh();
      } else {
        showToast('Unable to save settings', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Unable to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if Business Type is changed
    if (role === 'OWNER' && businessType !== shop.businessType) {
      setShowImportConfirm(true);
      return;
    }

    await executeSave(false);
  };

  const isOwnerOrManager = role === 'OWNER' || role === 'MANAGER';

  return (
    <div className="space-y-6">
      {/* TABS SELECTION FOR PRIVILEGED USERS */}
      {isOwnerOrManager && (
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-1 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <Store className="w-4 h-4" />
            Shop Profile
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'backup'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <Database className="w-4 h-4" />
            Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('import_export')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'import_export'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import / Export
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'health'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-555 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            System Health
          </button>
          <button
            onClick={() => setActiveTab('subscription' as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === ('subscription' as any)
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-555 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <span className="w-4 h-4 text-center">💳</span>
            Subscription / ਪਲਾਨ
          </button>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-650">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ਦੁਕਾਨ ਦੀ ਪ੍ਰੋਫਾਈਲ (Shop Profile)</h2>
              <p className="text-xs text-slate-550 dark:text-slate-400">Manage basic credentials and layouts</p>
            </div>
          </div>

          {saved && (
            <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500 text-emerald-800 dark:text-emerald-350 p-4 rounded-xl flex items-center gap-3 font-semibold text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              ਸੈਟਿੰਗਾਂ ਸਫਲਤਾਪੂਰਵਕ ਸੇਵ ਹੋ ਗਈਆਂ ਹਨ (Settings saved successfully!)
            </div>
          )}

           <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo Upload Section */}
            <div className="border border-dashed border-slate-350 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="w-16 h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                {logoPath ? (
                  <img src={logoPath} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Store className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">ਦੁਕਾਨ ਦਾ ਲੋਗੋ (Shop Logo)</h4>
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG formats supported (Max 1MB)</p>
              </div>
              <label className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1.5 active:scale-95">
                {uploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਦੁਕਾਨ ਦਾ ਨਾਮ (Shop Name)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਜੀ.ਐੱਸ.ਟੀ. ਨੰਬਰ (GST Number - Optional)
                </label>
                <input
                  type="text"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-mono"
                  placeholder="e.g. 03AAAAA1111A1Z1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਫੋਨ ਨੰਬਰ (Phone Number)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਈਮੇਲ (Email Address - Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm"
                  placeholder="e.g. contact@shop.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਦੁਕਾਨ ਦਾ ਪਤਾ (Shop Address)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm"
                placeholder="G.T. Road, Jalandhar, Punjab"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਬਿੱਲ ਦੇ ਹੇਠਾਂ ਲਿਖਣ ਵਾਲਾ ਸੁਨੇਹਾ (Invoice Footer Message)
              </label>
              <textarea
                value={footerMessage}
                onChange={(e) => setFooterMessage(e.target.value)}
                rows={2}
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm leading-relaxed"
                placeholder="e.g. Thank you for shopping with us!&#10;Visit again."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਵਾਪਸੀ ਦੀ ਨੀਤੀ (Return Policy)
              </label>
              <textarea
                value={returnPolicy}
                onChange={(e) => setReturnPolicy(e.target.value)}
                rows={2}
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm leading-relaxed"
                placeholder="e.g. Goods once sold will not be taken back.&#10;Warranty as per company policy."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                ਕਾਰੋਬਾਰੀ ਪ੍ਰੋਫਾਈਲ (Business Profile / Industry Type)
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                disabled={role !== 'OWNER'}
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold disabled:opacity-60"
              >
                <option value="GENERAL_STORE">General Store / Kirana / ਕਿਰਿਆਨਾ</option>
                <option value="GROCERY">Grocery Store / ਗਰੋਸਰੀ</option>
                <option value="HARDWARE">Hardware Store / ਹਾਰਡਵੇਅਰ</option>
                <option value="ELECTRICAL">Electrical Shop / ਬਿਜਲੀ ਦੀ ਦੁਕਾਨ</option>
                <option value="PAINT">Paint Store / ਪੇਂਟ ਸਟੋਰ</option>
                <option value="MOBILE">Mobile Shop / ਮੋਬਾਈਲ ਸਟੋਰ</option>
                <option value="COMPUTER">Computer Shop / ਕੰਪਿਊਟਰ ਸਟੋਰ</option>
                <option value="STATIONERY">Stationery Shop / ਸਟੇਸ਼ਨਰੀ</option>
                <option value="BOOK">Book Shop / ਕਿਤਾਬਾਂ ਦੀ ਦੁਕਾਨ</option>
                <option value="GARMENT">Garment Store / ਕੱਪੜਿਆਂ ਦੀ ਦੁਕਾਨ</option>
                <option value="FOOTWEAR">Footwear Store / ਜੁੱਤੀਆਂ ਦੀ ਦੁਕਾਨ</option>
                <option value="COSMETICS">Cosmetics Shop / ਸਿੰਗਾਰ ਦੀ ਦੁਕਾਨ</option>
                <option value="BAKERY">Bakery / ਬੇਕਰੀ</option>
                <option value="DAIRY">Dairy / ਡੇਅਰੀ</option>
                <option value="SWEET">Sweet Shop / ਹਲਵਾਈ ਦੀ ਦੁਕਾਨ</option>
                <option value="SPORTS">Sports Shop / ਖੇਡਾਂ ਦਾ ਸਾਮਾਨ</option>
                <option value="FURNITURE">Furniture Shop / ਫਰਨੀਚਰ ਸਟੋਰ</option>
                <option value="ELECTRONICS">Electronics Shop / ਇਲੈਕਟ੍ਰਾਨਿਕਸ</option>
                <option value="AUTO_PARTS">Auto Parts Shop / ਆਟੋ ਪਾਰਟਸ</option>
                <option value="AGRICULTURAL_INPUT">Agricultural Input Store / ਖੇਤੀਬਾੜੀ ਸਾਮਾਨ</option>
                <option value="PESTICIDE">Pesticide Store / ਕੀਟਨਾਸ਼ਕ ਸਟੋਰ</option>
                <option value="SEED">Seed Store / ਬੀਜ ਸਟੋਰ</option>
                <option value="FERTILIZER">Fertilizer Store / ਖਾਦ ਸਟੋਰ</option>
                <option value="BUILDING_MATERIAL">Building Material Supplier / ਬਿਲਡਿੰਗ ਮਟੀਰੀਅਲ</option>
                <option value="WHOLESALE">Wholesale Distributor / ਹੋਲਸੇਲ ਡਿਸਟ੍ਰੀਬਿਊਟਰ</option>
                <option value="MEDICAL">Medical Store / ਕੈਮਿਸਟ</option>
              </select>
              {role !== 'OWNER' && (
                <p className="mt-1 text-xs text-slate-500">Only the shop OWNER can change the business profile.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਬੋਲੀ / Language
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Language)}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                >
                  <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                  <option value="en">English (English)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  ਥੀਮ / Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setLocalTheme(e.target.value as 'light' | 'dark')}
                  className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                >
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 text-blue-600 dark:text-blue-400">
                ਅਨੁਵਾਦ ਸੁਝਾਅ (Product Name Auto-Suggestion Settings)
              </h4>
              <div className="flex flex-col gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-sm font-semibold select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSuggestPunjabi}
                    onChange={(e) => setAutoSuggestPunjabi(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>ਪੰਜਾਬੀ ਉਤਪਾਦ ਦੇ ਨਾਮ ਆਟੋ-ਸੁਝਾਓ (Auto Suggest Punjabi Product Names)</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm font-semibold select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSuggestEnglish}
                    onChange={(e) => setAutoSuggestEnglish(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>ਅੰਗਰੇਜ਼ੀ ਉਤਪਾਦ ਦੇ ਨਾਮ ਆਟੋ-ਸੁਝਾਓ (Auto Suggest English Product Names)</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 text-blue-600 dark:text-blue-400">ਰਸੀਦ ਅਤੇ ਪ੍ਰਿੰਟਿੰਗ (Receipt & Printing)</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਪ੍ਰਿੰਟਰ ਦੀ ਕਿਸਮ (Printer Type)
                  </label>
                  <select
                    value={printerType}
                    onChange={(e) => setPrinterType(e.target.value as PrinterType)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  >
                    <option value={PrinterType.THERMAL_58}>Thermal 58 mm</option>
                    <option value={PrinterType.THERMAL_80}>Thermal 80 mm</option>
                    <option value={PrinterType.A4}>A4 Printer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਰਸੀਦ ਦਾ ਲੇਆਉਟ (Receipt Layout)
                  </label>
                  <select
                    value={receiptFormat}
                    onChange={(e) => setReceiptFormat(e.target.value as ReceiptFormat)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  >
                    <option value={ReceiptFormat.SIMPLE}>Simple Receipt (ਸਧਾਰਨ ਰਸੀਦ)</option>
                    <option value={ReceiptFormat.DETAILED}>Detailed Receipt (ਵੇਰਵੇ ਸਹਿਤ ਰਸੀਦ)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    ਜੀ.ਐਸ.ਟੀ. ਰਜਿਸਟਰਡ (GST Registered)
                  </label>
                  <select
                    value={gstRegistered ? 'yes' : 'no'}
                    onChange={(e) => setGstRegistered(e.target.value === 'yes')}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  >
                    <option value="no">No (ਜੀ.ਐਸ.ਟੀ. ਰਜਿਸਟਰਡ ਨਹੀਂ)</option>
                    <option value="yes">Yes (ਜੀ.ਐਸ.ਟੀ. ਰਜਿਸਟਰਡ)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handlePrintTestReceipt}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all"
                  >
                    ਪ੍ਰਿੰਟ ਟੈਸਟ ਰਸੀਦ (Print Test Receipt)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਰਸੀਦ ਪ੍ਰੀਫਿਕਸ (Receipt Prefix)
                  </label>
                  <input
                    type="text"
                    value={receiptPrefix}
                    onChange={(e) => setReceiptPrefix(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-mono font-bold"
                    placeholder="e.g. RCP-"
                  />
                  <p className="mt-1 text-[10px] text-slate-450">Example: {receiptPrefix}000125</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਟੈਕਸ ਬਿੱਲ ਪ੍ਰੀਫਿਕਸ (Tax Invoice Prefix)
                  </label>
                  <input
                    type="text"
                    value={taxPrefix}
                    onChange={(e) => setTaxPrefix(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-mono font-bold"
                    placeholder="e.g. INV-"
                  />
                  <p className="mt-1 text-[10px] text-slate-450">Example: {taxPrefix}000125</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਕਰੰਸੀ ਨਿਸ਼ਾਨ (Currency Symbol)
                  </label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                    placeholder="e.g. ₹"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਦਸ਼ਮਲਵ ਸ਼ੁੱਧਤਾ (Decimal Precision)
                  </label>
                  <select
                    value={decimalPrecision}
                    onChange={(e) => setDecimalPrecision(Number(e.target.value))}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  >
                    <option value={0}>0 (No decimals)</option>
                    <option value={2}>2 (e.g. ₹100.50)</option>
                    <option value={3}>3 (e.g. ₹100.500)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਤਾਰੀਖ ਦਾ ਫਾਰਮੈਟ (Date Format)
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Discount Rules Card */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/30 dark:bg-slate-900/30 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                ਡਿਸਕਾਊਂਟ ਨਿਯਮ (Discount Rules)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="allowItemDiscount"
                    checked={allowItemDiscount}
                    onChange={(e) => setAllowItemDiscount(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allowItemDiscount" className="text-sm font-bold select-none cursor-pointer">
                    ਆਈਟਮ-ਵਾਰ ਡਿਸਕਾਊਂਟ ਚਾਲੂ ਕਰੋ (Allow Item Discounts)
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="allowBillDiscount"
                    checked={allowBillDiscount}
                    onChange={(e) => setAllowBillDiscount(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allowBillDiscount" className="text-sm font-bold select-none cursor-pointer">
                    ਬਿੱਲ-ਵਾਰ ਡਿਸਕਾਊਂਟ ਚਾਲੂ ਕਰੋ (Allow Bill Discounts)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    ਸਟਾਫ ਲਈ ਅਧਿਕਤਮ ਡਿਸਕਾਊਂਟ Limit (%) (Max Staff Discount Limit)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={maxStaffDiscount}
                    onChange={(e) => setMaxStaffDiscount(Number(e.target.value))}
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200/60 dark:border-slate-800 pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireDiscountReason"
                    checked={requireDiscountReason}
                    onChange={(e) => setRequireDiscountReason(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="requireDiscountReason" className="text-sm font-bold select-none cursor-pointer">
                    ਵੱਡੇ ਡਿਸਕਾਊਂਟ ਲਈ ਕਾਰਨ ਪੁੱਛੋ (Require Reason for Large Discounts)
                  </label>
                </div>

                {requireDiscountReason && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        ਡਿਸਕਾਊਂਟ ਪ੍ਰਤੀਸ਼ਤ ਸੀਮਾ (%) (Reason Threshold Percent)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={reasonPercentLimit}
                        onChange={(e) => setReasonPercentLimit(Number(e.target.value))}
                        className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        ਡਿਸਕਾਊਂਟ ਰਕਮ ਸੀਮਾ (₹) (Reason Threshold Amount)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={reasonAmountLimit}
                        onChange={(e) => setReasonAmountLimit(Number(e.target.value))}
                        className="mt-1.5 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="lowStockAlert"
                checked={lowStockAlert}
                onChange={(e) => setLowStockAlert(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="lowStockAlert" className="text-sm font-bold select-none cursor-pointer">
                ਘੱਟ ਸਟਾਕ ਚੇਤਾਵਨੀ ਚਾਲੂ ਕਰੋ (Enable Low Stock Alerts)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-bold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ...' : 'ਸੈਟਿੰਗਾਂ ਸੇਵ ਕਰੋ (Save Settings)'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'backup' && isOwnerOrManager && <BackupRestoreTab />}
      {activeTab === 'import_export' && isOwnerOrManager && <ImportExportTab />}
      {activeTab === 'health' && isOwnerOrManager && <SystemHealthWidget />}
      {activeTab === ('subscription' as any) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-650 font-bold">
              <span>💳</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਅਤੇ ਪਲਾਨ (SaaS Subscription)</h2>
              <p className="text-xs text-slate-550 dark:text-slate-400">View active plan limits and billing cycles</p>
            </div>
          </div>

          {shop.subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-550 uppercase font-bold">Current Plan</p>
                  <p className="text-lg font-black text-slate-800 dark:text-white mt-1">
                    {shop.subscription.plan.name}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-555 uppercase font-bold">Status</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mt-1.5 ${
                    shop.subscription.status === 'ACTIVE' ? 'bg-green-950 text-green-400' : 'bg-blue-950 text-blue-400'
                  }`}>
                    {shop.subscription.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-555 uppercase font-bold">Days Remaining</p>
                  <p className="text-lg font-black text-slate-800 dark:text-white mt-1">
                    {Math.max(0, Math.ceil((new Date(shop.subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} Days
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-555 uppercase font-bold">Renewal Date</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                    {new Date(shop.subscription.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <p className="text-xs text-slate-555 font-bold uppercase tracking-wider">Features Enabled in Plan:</p>
                {shop.subscription.plan.features.map((pf: any) => (
                  <div key={pf.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{pf.feature.name}</span>
                    <span className={`text-xs font-bold ${pf.enabled ? 'text-green-400' : 'text-slate-655'}`}>
                      {pf.enabled ? (
                        pf.limitValue > 0 ? `Limit: ${pf.limitValue} (${pf.limitType})` : 'Unlimited ✔'
                      ) : 'Disabled ✖'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">
              No active subscription found. Please contact support.
            </p>
          )}
        </div>
      )}


      {/* Business Type Category Import Confirmation Modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {lang === 'en' ? 'Import Recommended Categories?' : 'ਸਿਫਾਰਸ਼ ਕੀਤੀਆਂ ਕੈਟੇਗਰੀਆਂ ਇੰਪੋਰਟ ਕਰੀਏ?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {lang === 'en'
                ? `You have changed the Business Type. Would you like to import the recommended default categories for "${businessType}"?`
                : `ਤੁਸੀਂ ਕਾਰੋਬਾਰ ਦੀ ਕਿਸਮ ਬਦਲ ਦਿੱਤੀ ਹੈ। ਕੀ ਤੁਸੀਂ "${businessType}" ਲਈ ਸਿਫਾਰਸ਼ ਕੀਤੀਆਂ ਮੂਲ ਕੈਟੇਗਰੀਆਂ ਇੰਪੋਰਟ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?`}
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 dark:text-slate-500 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              {lang === 'en'
                ? 'Note: This will only add categories that do not already exist. None of your current categories will be deleted.'
                : 'ਨੋਟ: ਇਹ ਸਿਰਫ ਉਹੀ ਕੈਟੇਗਰੀਆਂ ਜੋੜੇਗਾ ਜੋ ਪਹਿਲਾਂ ਤੋਂ ਮੌਜੂਦ ਨਹੀਂ ਹਨ। ਤੁਹਾਡੀ ਕੋਈ ਵੀ ਮੌਜੂਦਾ ਕੈਟੇਗਰੀ ਹਟਾਈ ਨਹੀਂ ਜਾਵੇਗੀ।'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportConfirm(false);
                }}
                className="px-4 py-2 border border-slate-250 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {lang === 'en' ? 'Cancel' : 'ਰੱਦ ਕਰੋ'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowImportConfirm(false);
                  await executeSave(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors"
              >
                {lang === 'en' ? 'No, Just Save' : 'ਨਹੀਂ, ਸਿਰਫ ਸੇਵ ਕਰੋ'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowImportConfirm(false);
                  await executeSave(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                {lang === 'en' ? 'Yes, Import' : 'ਹਾਂ, ਇੰਪੋਰਟ ਕਰੋ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
