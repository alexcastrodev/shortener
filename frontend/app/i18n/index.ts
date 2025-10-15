import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import menu from './en/menu.json';
import home from './en/home.json';
import dashboard from './en/dashboard.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      menu,
      home,
      dashboard,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
