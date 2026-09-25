import { useTranslation } from 'react-i18next';
import type { AlertRecord } from '../types/api';
import { Icon } from './common/Icon';

interface AlertsPanelProps {
  alerts: AlertRecord[];
  isUnavailable?: boolean;
  hasCalculatedRoute?: boolean;
  onRecalculateSaferRoute?: () => void;
  onViewAffectedSegment?: () => void;
  driverMode?: boolean;
}

export default function AlertsPanel({
  alerts,
  isUnavailable = false,
  hasCalculatedRoute = false,
  onRecalculateSaferRoute,
  onViewAffectedSegment,
  driverMode = false,
}: AlertsPanelProps) {
  const { t } = useTranslation();

  // Check if any alert affects the current route
  const routeAlerts = alerts.filter((a) => a.routeCandidateId || a.severity === 'CRITICAL');
  const hasRouteAlert = hasCalculatedRoute && routeAlerts.length > 0;

  return (
    <div className="intel-card">
      {/* Route-Specific Alert / Status Banner */}
      {hasRouteAlert ? (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(217, 56, 58, 0.12)',
            border: '1px solid rgba(217, 56, 58, 0.35)',
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-status-danger)', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
            <Icon name="alert-triangle" size={14} color="var(--color-status-danger)" />
            <span>{t('alerts.liveRouteAlertLabel')}</span>
          </div>
          <div style={{ fontSize: 11, color: '#FCA5A5', lineHeight: 1.4, marginBottom: 8 }}>
            Hazard or obstruction detected on current route ({routeAlerts[0]?.title || 'Active Corridor Warning'}).
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onViewAffectedSegment && (
              <button
                onClick={onViewAffectedSegment}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: 'rgba(217, 56, 58, 0.2)',
                  border: '1px solid rgba(217, 56, 58, 0.4)',
                  borderRadius: 4,
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('alerts.viewAffected')}
              </button>
            )}
            {onRecalculateSaferRoute && (
              <button
                onClick={onRecalculateSaferRoute}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: 'var(--color-status-safe)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {driverMode ? t('alerts.recalculateDriver') : t('alerts.recalculate')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(46, 139, 87, 0.1)',
            border: '1px solid rgba(46, 139, 87, 0.25)',
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-status-safe)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('alerts.routeStatus')}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-status-safe)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="check" size={13} color="var(--color-status-safe)" />
            <span>{t('alerts.noActiveRouteAlerts')}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {t('alerts.routeNormal')}
          </div>
        </div>
      )}

      {/* Regional Alerts Section */}
      <div className="intel-card-header" style={{ marginBottom: 6 }}>
        <span className="intel-card-title">
          <Icon name="bell" size={14} color="var(--color-accent-amber)" />
          <span>{driverMode ? t('alerts.driverAdvisories') : t('alerts.regionAdvisories')}</span>
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: alerts.length > 0 ? 'rgba(217, 119, 6, 0.15)' : 'rgba(46, 139, 87, 0.15)',
            color: alerts.length > 0 ? 'var(--color-status-caution)' : 'var(--color-status-safe)',
          }}
        >
          {t('alerts.regionAdvisoriesCount', { count: alerts.length })}
        </span>
      </div>

      {isUnavailable && (
        <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--color-status-caution)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="alert-triangle" size={12} color="var(--color-status-caution)" />
          <span>{t('alerts.serviceOffline')}</span>
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const accentColor = isCritical ? 'var(--color-status-danger)' : isWarning ? 'var(--color-status-caution)' : 'var(--color-accent-amber)';
            const bgColor = isCritical ? 'rgba(217, 56, 58, 0.1)' : isWarning ? 'rgba(217, 119, 6, 0.1)' : 'rgba(229, 152, 58, 0.08)';

            return (
              <div
                key={alert.id}
                style={{
                  padding: '8px 10px',
                  backgroundColor: bgColor,
                  border: `1px solid ${accentColor}33`,
                  borderLeft: `3px solid ${accentColor}`,
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {alert.severity} — {alert.category.replace(/_/g, ' ')}
                  </span>
                  {alert.routeCandidateId && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-accent-amber)', backgroundColor: 'rgba(229, 152, 58, 0.15)', padding: '1px 5px', borderRadius: 3 }}>
                      {t('alerts.onRoute')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>{alert.title}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>{alert.message}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
