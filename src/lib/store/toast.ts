import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Consistent prefixes matching the user's instructions
    let prefix = '✅ ';
    if (type === 'error') prefix = '❌ ';
    if (type === 'warning') prefix = '⚠ ';
    if (type === 'info') prefix = 'ℹ ';

    const formattedMessage = message.startsWith('✅') || message.startsWith('❌') || message.startsWith('⚠') || message.startsWith('ℹ')
      ? message
      : `${prefix}${message}`;

    set((state) => ({ toasts: [...state.toasts, { id, message: formattedMessage, type }] }));
    
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
