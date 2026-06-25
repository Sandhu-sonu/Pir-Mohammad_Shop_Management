import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '../translations';

interface AppState {
  language: Language;
  theme: 'light' | 'dark';
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'pa', // Default is Punjabi (ਸਰਲਤਾ ਲਈ)
      theme: 'light',
      setLanguage: (lang) => set({ language: lang }),
      toggleLanguage: () =>
        set((state) => ({
          language: state.language === 'en' ? 'pa' : 'en',
        })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
    }),
    {
      name: 'punjab-shop-storage',
    }
  )
);
