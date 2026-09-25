import type { DriverRouteAlert } from '../../types/api';
import { Icon } from '../common/Icon';

interface DriverRouteAlertCardProps {
  alert: DriverRouteAlert;
  onReviewSaferRoute?: () => void;
  onViewWhatsAhead?: () => void;
  onDismiss?: () => void;
  canReroute?: boolean;
}

export default function DriverRouteAlertCard({
  alert,
  onReviewSaferRoute,
  onViewWhatsAhead,
  onDismiss,
  canReroute = true,
}: DriverRouteAlertCardProps) {
  const isCritical = alert.severity === 'CRITICAL';
  const isClosure = alert.category === 'ROAD_CLOSURE';

  const borderColor = isCritical ? '#EF4444' : '#F59E0B';
  const bgColor = isCritical ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.14)';
  const badgeBg = isCritical ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)';
  const badgeColor = isCritical ? '#EF4444' : '#FBBF24';

  return (
    <div
      className="driver-card"
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow: isCritical ? '0 6px 20px rgba(239, 68, 68, 0.35)' : '0 6px 20px rgba(245, 158, 11, 0.25)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'fadeIn 0.25s ease-out',
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* Header with Headline & Distance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 6,
            background: badgeBg,
            color: badgeColor,
            border: `1px solid ${borderColor}44`,
          }}
        >
          <Icon name={isClosure ? 'barrier' : 'alert-triangle'} size={12} color={badgeColor} />
          <span>{alert.headline}</span>
        </span>

        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#FFFFFF',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          {alert.distanceLabel}
        </span>
      </div>

      {/* Main Alert Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{
            display: 'flex',
            padding: 8,
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.35)',
            border: `1px solid ${borderColor}66`,
            color: badgeColor,
          }}
        >
          <Icon name={isClosure ? 'barrier' : 'alert-triangle'} size={22} color={badgeColor} />
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 4 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
            {alert.message}
          </div>
        </div>
      </div>

      {/* Verified Status Tag */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          paddingTop: 6,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#60A5FA', fontWeight: 600 }}>
          <Icon name="shield" size={12} color="#60A5FA" />
          <span>Verified by Operations</span>
        </span>
        <span>
          Location: <strong style={{ color: '#FFFFFF' }}>{alert.affectedCorridorOrLocation}</strong>
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        {onReviewSaferRoute && (
          <button
            type="button"
            onClick={onReviewSaferRoute}
            disabled={!canReroute}
            style={{
              flex: 1,
              minWidth: 140,
              background: 'var(--color-accent-amber)',
              color: 'var(--color-bg-deep)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 800,
              cursor: canReroute ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            }}
          >
            <Icon name="reroute" size={14} color="var(--color-bg-deep)" />
            <span>{alert.actionLabel || 'Review Safer Route'}</span>
          </button>
        )}

        {onViewWhatsAhead && (
          <button
            type="button"
            onClick={onViewWhatsAhead}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="mountain" size={14} />
            <span>{alert.secondaryActionLabel || "What's Ahead"}</span>
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--color-text-muted)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Dismiss popup (condition remains monitored)"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
