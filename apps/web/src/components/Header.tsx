import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './common/Icon';

interface HeaderProps {
  isLive: boolean;
  vehicleCount: number;
  incidentCount: number;
  hazardZoneCount: number;
  accessibilityCount: number;
  lastUpdated: string;
  showLeftPanel: boolean;
  setShowLeftPanel: Dispatch<SetStateAction<boolean>>;
  showRightPanel: boolean;
  setShowRightPanel: Dispatch<SetStateAction<boolean>>;
  showLegend: boolean;
  setShowLegend: Dispatch<SetStateAction<boolean>>;
  viewMode: 'operations' | 'driver';
  onToggleViewMode: () => void;
  onResetDemo?: () => void;
}

export default function Header({
  isLive,
  vehicleCount,
  incidentCount,
  hazardZoneCount,
  accessibilityCount,
  lastUpdated,
  showLeftPanel,
  setShowLeftPanel,
  showRightPanel,
  setShowRightPanel,
  showLegend,
  setShowLegend,
  viewMode,
  onToggleViewMode,
  onResetDemo,
}: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="command-header">
      {/* Brand / Logo */}
      <div className="brand-badge">
        <div className="brand-icon" aria-label="SauraRoute Logo">
          SR
        </div>
        <div>
          <div className="brand-title">SauraRoute</div>
          <div className="brand-subtitle">{t('header.brandSubtitle')}</div>
        </div>
      </div>

      {/* Center Operational Telemetry (Desktop / Tablet) */}
      <div
        style={{
          display: viewMode === 'driver' ? 'none' : 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        className="desktop-telemetry"
      >
        <div className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('header.regionLabel')}</span>
          <span style={{ fontWeight: 600, color: 'var(--accent-action)' }}>{t('header.regionValue')}</span>
        </div>

        <div className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('header.fleetLabel')}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('header.fleetActive', { count: vehicleCount })}</span>
        </div>

        <div className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('header.incidentsLabel')}</span>
          <span style={{ fontWeight: 600, color: incidentCount > 0 ? 'var(--status-caution)' : 'var(--text-muted)' }}>
            {t('header.incidentsReported', { count: incidentCount })}
          </span>
        </div>

        <div className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('header.hazardZonesLabel')}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('header.hazardZonesValue', { count: hazardZoneCount })}</span>
        </div>

        <div className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('header.corridorsLabel')}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('header.corridorsMonitored', { count: accessibilityCount })}</span>
        </div>
      </div>

      {/* Right Actions & Live Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {viewMode === 'operations' && (
          <>
            {onResetDemo && (
              <button
                type="button"
                onClick={onResetDemo}
                className="btn-preset"
                title="Reset Demo to Initial Baseline State"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  fontWeight: 600,
                }}
              >
                <Icon name="refresh" size={13} color="#F87171" />
                <span>Reset Demo</span>
              </button>
            )}

            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className={`btn-preset ${showLeftPanel ? 'active' : ''}`}
              title={showLeftPanel ? 'Hide Route Planner' : 'Show Route Planner'}
            >
              {t('header.planner')}
            </button>

            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className={`btn-preset ${showRightPanel ? 'active' : ''}`}
              title={showRightPanel ? 'Hide Intelligence Panel' : 'Show Intelligence Panel'}
            >
              {t('header.intelligence')}
            </button>

            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`btn-preset ${showLegend ? 'active' : ''}`}
              title={showLegend ? 'Hide Map Legend' : 'Show Map Legend'}
            >
              {t('header.legend')}
            </button>
          </>
        )}

        <button
          onClick={onToggleViewMode}
          className="btn-preset"
          title={viewMode === 'operations' ? 'Switch to Driver Mode' : 'Switch to Command Center'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
            borderColor: viewMode === 'driver' ? 'var(--status-safe)' : 'var(--accent-action)',
            color: viewMode === 'driver' ? '#4ADE80' : 'var(--accent-action)',
          }}
        >
          <Icon name={viewMode === 'driver' ? 'terminal' : 'truck'} size={14} />
          <span>{viewMode === 'driver' ? t('header.switchToOps') : t('header.switchToDriver')}</span>
        </button>

        <div className={`status-pill ${isLive ? 'live' : 'disconnected'}`} title={`Last refreshed: ${lastUpdated}`}>
          <span className="status-pulse" />
          <span>{isLive ? t('header.live') : t('header.offline')}</span>
        </div>
      </div>
    </header>
  );
}
