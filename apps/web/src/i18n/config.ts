import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import as from './as.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  as: { translation: as },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React handles XSS escaping
    },
  });

export default i18n;
