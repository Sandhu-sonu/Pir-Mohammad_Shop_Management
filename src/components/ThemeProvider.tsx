'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../lib/store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, language } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('lang', language === 'pa' ? 'pa' : 'en');
  }, [theme, language, mounted]);

  // Prevent flash by rendering child content (can style a simple skeleton or loader if needed, but simple return is clean)
  return <div className={mounted ? '' : 'invisible'}>{children}</div>;
}
