import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/config';
import './index.css';
import App from './App.tsx';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <LanguageSwitcher
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
      }}
    />
  </StrictMode>,
);
