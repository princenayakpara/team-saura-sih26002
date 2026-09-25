import { useState, useEffect, useCallback } from 'react';
import type { WhatsAheadItem, WhatsAheadResult, CandidateRouteProfile } from '../../types/api';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

interface DriverWhatsAheadProps {
  selectedRoute: CandidateRouteProfile | null;
  onCheckReroute?: () => void;
  canReroute?: boolean;
  onReportIssue?: () => void;
}

const API_BASE_URL = 'http://localhost:3000/api';

function getCategoryIcon(item: WhatsAheadItem): IconName {
  if (item.category === 'CORRIDOR_CLOSED') return 'barrier';
  if (item.category === 'CORRIDOR_RESTRICTED') return 'alert-triangle';
  switch (item.type) {
    case 'LANDSLIDE':
    case 'FALLEN_ROCKS':
      return 'mountain';
    case 'FLOOD':
      return 'cloud-rain';
    case 'ACCIDENT':
      return 'truck';
    case 'BLOCKAGE':
    case 'ROAD_DAMAGE':
      return 'barrier';
    default:
      return 'alert-triangle';
  }
}

export default function DriverWhatsAhead({
  selectedRoute,
  onCheckReroute,
  canReroute = true,
  onReportIssue,
}: DriverWhatsAheadProps) {
  const [data, setData] = useState<WhatsAheadResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchWhatsAhead = useCallback(async () => {
    if (!selectedRoute?.geometry?.coordinates?.length) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/routes/whats-ahead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry: selectedRoute.geometry }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json.data as WhatsAheadResult);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch What\'s Ahead data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoute]);

  useEffect(() => {
    fetchWhatsAhead();
    // Poll every 5s to reflect real-time operations verifications and driver reports
    const interval = setInterval(fetchWhatsAhead, 5000);
    return () => clearInterval(interval);
  }, [fetchWhatsAhead]);

  const items = data?.items || [];
  const hasClosedCorridor = items.some((i) => i.category === 'CORRIDOR_CLOSED');
  const hasUnverified = items.some((i) => !i.isVerified);
  const totalCount = items.length;

  return (
    <div className="driver-stack" aria-label="What's Ahead Route Intelligence">
      {/* Header Card */}
      <div className="driver-card" style={{ borderLeft: '4px solid var(--color-accent-amber)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--color-accent-amber)', display: 'flex' }}>
              <Icon name="mountain" size={20} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.3 }}>
                What&apos;s Ahead
              </h2>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Route-linked hazards &amp; corridor conditions
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchWhatsAhead}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Refresh conditions"
          >
            <Icon name="refresh" size={12} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Scanning...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Quick summary stats */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 11,
            color: 'var(--color-text-secondary)',
          }}
        >
          <span style={{ fontWeight: 700, color: totalCount > 0 ? '#FBBF24' : '#4ADE80' }}>
            {totalCount === 0 ? '✓ Path Clear' : `${totalCount} item${totalCount > 1 ? 's' : ''} on route`}
          </span>
          {hasClosedCorridor && (
            <span style={{ color: '#EF4444', fontWeight: 700 }}>• Route Closure Detected</span>
          )}
          {hasUnverified && (
            <span style={{ color: '#F97316', fontWeight: 600 }}>• Unverified Reports</span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="driver-card"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
            <Icon name="alert-triangle" size={14} color="#EF4444" />
            <span>Connection Issue</span>
          </div>
          <div>{error}</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div
          className="driver-card"
          style={{
            textAlign: 'center',
            padding: '24px 16px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', marginBottom: 10 }}>
            <Icon name="check" size={28} color="#10B981" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>
            No Hazards or Restrictions Ahead
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 320, margin: '0 auto 16px' }}>
            The monitored corridor is open with no active road closures or critical verified incidents on your trajectory.
          </div>
          {onReportIssue && (
            <button
              type="button"
              onClick={onReportIssue}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon name="alert-triangle" size={14} />
              <span>See something on the road? Report Issue</span>
            </button>
          )}
        </div>
      )}

      {/* List of What's Ahead Items */}
      {items.map((item) => {
        const isClosed = item.category === 'CORRIDOR_CLOSED';
        const isRestricted = item.category === 'CORRIDOR_RESTRICTED';
        const isVerified = item.isVerified;

        let cardBorder = 'rgba(255, 255, 255, 0.1)';
        let cardBg = 'rgba(30, 41, 59, 0.7)';
        let statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
        let statusBadgeColor = '#FBBF24';
        let statusBadgeText = 'UNVERIFIED OBSERVATION';

        if (isClosed) {
          cardBorder = '#EF4444';
          cardBg = 'rgba(239, 68, 68, 0.12)';
          statusBadgeBg = 'rgba(239, 68, 68, 0.25)';
          statusBadgeColor = '#EF4444';
          statusBadgeText = 'ROAD CLOSURE — AFFECTS ROUTE';
        } else if (isRestricted) {
          cardBorder = '#F59E0B';
          cardBg = 'rgba(245, 158, 11, 0.1)';
          statusBadgeBg = 'rgba(245, 158, 11, 0.25)';
          statusBadgeColor = '#F59E0B';
          statusBadgeText = 'RESTRICTED CORRIDOR';
        } else if (isVerified) {
          cardBorder = '#3B82F6';
          cardBg = 'rgba(59, 130, 246, 0.08)';
          statusBadgeBg = 'rgba(59, 130, 246, 0.2)';
          statusBadgeColor = '#60A5FA';
          statusBadgeText = 'VERIFIED BY OPERATIONS';
        }

        return (
          <div
            key={`${item.category}_${item.id}`}
            className="driver-card"
            style={{
              background: cardBg,
              border: `1.5px solid ${cardBorder}`,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Top row: Status Trust Badge & Distance Ahead */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: statusBadgeBg,
                  color: statusBadgeColor,
                  border: `1px solid ${statusBadgeColor}44`,
                }}
              >
                <Icon name={isVerified ? 'check' : 'alert-triangle'} size={11} color={statusBadgeColor} />
                <span>{statusBadgeText}</span>
              </span>

              {/* Prominent Distance Label */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {item.distanceLabel}
              </span>
            </div>

            {/* Title & Category Icon */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  display: 'flex',
                  padding: 8,
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: isClosed ? '#EF4444' : isRestricted ? '#F59E0B' : '#60A5FA',
                }}
              >
                <Icon name={getCategoryIcon(item)} size={20} />
              </span>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </div>
            </div>

            {/* Footer Context Info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: 11,
                color: 'var(--color-text-muted)',
              }}
            >
              <span>
                Location: <strong style={{ color: 'var(--color-text-primary)' }}>{item.locationContext}</strong>
              </span>
              <span>
                Severity: <strong style={{ color: item.severity === 'CRITICAL' ? '#EF4444' : '#FBBF24' }}>{item.severity}</strong>
              </span>
            </div>

            {/* If route is closed or high hazard, offer one-tap detour */}
            {(isClosed || item.severity === 'CRITICAL') && onCheckReroute && (
              <button
                type="button"
                onClick={onCheckReroute}
                disabled={!canReroute}
                style={{
                  marginTop: 4,
                  width: '100%',
                  background: 'var(--color-accent-amber)',
                  color: 'var(--color-bg-deep)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: canReroute ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon name="reroute" size={15} color="var(--color-bg-deep)" />
                <span>Find Safer Alternative Route</span>
              </button>
            )}
          </div>
        );
      })}

      {/* Action Footer: Report Issue */}
      {items.length > 0 && onReportIssue && (
        <div className="driver-card" style={{ padding: 12 }}>
          <button
            type="button"
            className="driver-empty-btn"
            onClick={onReportIssue}
            style={{
              minHeight: 44,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1.5px solid #EF4444',
              color: '#FCA5A5',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="alert-triangle" size={16} color="#EF4444" />
            <span>Report Road Hazard / Issue</span>
          </button>
        </div>
      )}

      {/* Live sync footnote */}
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
        Updated from latest available telemetry {lastFetched ? `at ${lastFetched}` : ''} • Server-filtered for active route
      </div>
    </div>
  );
}
