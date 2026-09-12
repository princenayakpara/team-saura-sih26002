import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  style?: React.CSSProperties;
  className?: string;
}

export default function LanguageSwitcher({ style, className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिंदी', short: 'HI' },
    { code: 'as', label: 'অসমীয়া', short: 'AS' },
  ];

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '8px',
        padding: '4px 6px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        ...style,
      }}
      role="group"
      aria-label={t('language.select', 'Language')}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#38BDF8',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 2px',
        }}
      >
        <span>🌐</span>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('language.select', 'Language')}:
        </span>
      </span>
      <div style={{ display: 'inline-flex', gap: '3px' }}>
        {languages.map((lang) => {
          const isActive = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)'
                  : 'transparent',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                border: isActive
                  ? '1px solid #38BDF8'
                  : '1px solid transparent',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={lang.label}
              aria-pressed={isActive}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
