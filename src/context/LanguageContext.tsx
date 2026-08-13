import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationDictionary } from '../services/i18n';

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  t: TranslationDictionary;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_LANG_KEY = 'tailor_erp_lang_v1';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    return (saved as Language) || 'en';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, dir, t, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
