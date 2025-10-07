import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import menu from './en/menu.json';
import home from './en/home.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      menu,
      home,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
