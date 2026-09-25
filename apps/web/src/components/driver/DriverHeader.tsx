import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DriverHeaderProps {
  isLive: boolean;
  onExit?: () => void;
}

export default function DriverHeader({ isLive, onExit }: DriverHeaderProps) {
  const { t } = useTranslation();

  const [now, setNow] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="driver-header">
      <div className="driver-header-brand">
        <span className="driver-header-mark" aria-hidden="true">
          SR
        </span>
        <span className="driver-header-name">SAURAROUTE</span>
        <span className="driver-header-mode">{t('driver.mode')}</span>
      </div>

      <div className="driver-header-status">
        <span className={`driver-status-chip ${isLive ? 'driver-status-on' : 'driver-status-off'}`}>
          <span className="driver-status-dot" />
          <span>{isLive ? t('driver.online') : t('driver.offline')}</span>
        </span>
        <span className="driver-header-time">{now}</span>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="driver-header-exit-btn"
            title={t('driver.switchToOps')}
            aria-label={t('driver.switchToOps')}
          >
            {t('driver.opsCenter')}
          </button>
        )}
      </div>
    </header>
  );
}