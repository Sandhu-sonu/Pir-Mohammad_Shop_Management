'use client';

import { useAppStore } from '../lib/store';
import { translations, Language } from '../lib/translations';

export function useTranslation() {
  const { language, toggleLanguage, setLanguage } = useAppStore();

  const t = (key: keyof typeof translations['en']): string => {
    const langDict = translations[language] || translations['pa'];
    return (langDict[key] || translations['en'][key] || key) as string;
  };

  return { t, language, toggleLanguage, setLanguage };
}
