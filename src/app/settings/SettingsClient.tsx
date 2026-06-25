'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../lib/store';
import { updateShopSettingsAction } from '../../lib/actions/settings';
import { Language } from '../../lib/translations';
import { Store, CheckCircle } from 'lucide-react';

interface SettingsClientProps {
  shop: {
    id: string;
    name: string;
    address: string | null;
    gst: string | null;
    currency: string;
    settings: {
      language: string;
      theme: string;
      lowStockAlert: boolean;
    } | null;
  };
}

export default function SettingsClient({ shop }: SettingsClientProps) {
  const { t, setLanguage } = useTranslation();
  const { setTheme } = useAppStore();
  const router = useRouter();

  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address || '');
  const [gst, setGst] = useState(shop.gst || '');
  const [lang, setLang] = useState<Language>((shop.settings?.language as Language) || 'pa');
  const [theme, setLocalTheme] = useState<'light' | 'dark'>((shop.settings?.theme as 'light' | 'dark') || 'light');
  const [lowStockAlert, setLowStockAlert] = useState(shop.settings?.lowStockAlert ?? true);
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      const res = await updateShopSettingsAction({
        name,
        address,
        gst,
        language: lang,
        theme,
        lowStockAlert,
      });

      if (res.success) {
        // Sync preferences with Zustand state store
        setLanguage(lang);
        setTheme(theme);
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
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
              ਜੀ.ਐੱਸ.ਟੀ. ਨੰਬਰ (GST Number)
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
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
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              ਕਰੰਸੀ (Currency)
            </label>
            <input
              type="text"
              value="INR (₹) - Indian Rupee"
              disabled
              className="mt-1.5 w-full px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold opacity-60"
            />
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
  );
}
