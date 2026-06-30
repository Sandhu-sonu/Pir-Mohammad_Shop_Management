import React from 'react';
import { useToastStore } from '../../lib/store/toast';
import { X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 no-print">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start justify-between p-4 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 transform translate-y-0 opacity-100 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-zinc-900 dark:border-emerald-800 dark:text-emerald-400'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-zinc-900 dark:border-rose-800 dark:text-rose-405'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-zinc-900 dark:border-amber-800 dark:text-amber-400'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-zinc-900 dark:border-blue-800 dark:text-blue-400'
          }`}
          style={{ animation: 'slideIn 0.3s ease-out forwards' }}
        >
          <div className="pr-4 flex-1 whitespace-pre-line leading-relaxed">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
