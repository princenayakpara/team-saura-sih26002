import type { AlertRecord, CandidateRouteProfile } from '../../types/api';
import type { ReactNode } from 'react';
import { Icon } from '../common/Icon';

interface DriverSafetyBannerProps {
  selectedRoute: CandidateRouteProfile;
  alerts: AlertRecord[];
  onViewSafety: () => void;
  onViewAhead?: () => void;
  onCheckReroute: () => void;
  canReroute: boolean;
  onReportIssue?: () => void;
}

export default function DriverSafetyBanner({
  selectedRoute,
  alerts,
  onViewSafety,
  onViewAhead,
  onCheckReroute,
  canReroute,
  onReportIssue,
}: DriverSafetyBannerProps) {
  const routeAlerts = alerts.filter((a) => a.routeCandidateId || a.severity === 'CRITICAL');
  const activeAlert = routeAlerts[0];
  const risk = selectedRoute.risk;
  const accessibilityStatus = selectedRoute.accessibility?.status;

  let tone: 'hazard' | 'warn' | 'safe' = 'safe';
  let icon: ReactNode = <Icon name="check" size={18} color="var(--color-status-safe)" />;
  let title = 'Safe to Proceed';
  let message = 'No active road warnings ahead';

  if (activeAlert) {
    tone = activeAlert.severity === 'CRITICAL' ? 'hazard' : 'warn';
    icon = <Icon name="alert-triangle" size={18} color={tone === 'hazard' ? 'var(--color-status-danger)' : 'var(--color-status-caution)'} />;
    title = activeAlert.title;
    message = activeAlert.message;
  } else if (accessibilityStatus === 'CLOSED') {
    tone = 'hazard';
    icon = <Icon name="barrier" size={18} color="var(--color-status-danger)" />;
    title = 'Road Closed Ahead';
    message = 'A road segment on this route is currently closed to traffic.';
  } else if (accessibilityStatus === 'RESTRICTED') {
    tone = 'warn';
    icon = <Icon name="alert-triangle" size={18} color="var(--color-status-caution)" />;
    title = 'Restricted Road';
    message = 'Drive with caution — single-lane or slow traffic on this corridor.';
  } else if (risk.overallLevel === 'CRITICAL' || risk.overallLevel === 'HIGH') {
    tone = 'warn';
    icon = <Icon name="alert-triangle" size={18} color="var(--color-status-caution)" />;
    title = risk.overallLevel === 'CRITICAL' ? 'High Risk Road Ahead' : 'Road Ahead Requires Caution';
    message = `Main concern: ${risk.dominantTrigger}`;
  }

  const className = `driver-safety-banner driver-safety-${tone}`;

  return (
    <div className={className}>
      <div className="driver-safety-main">
        <span className="driver-safety-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="driver-safety-body">
          <div className="driver-safety-title">{title}</div>
          <div className="driver-safety-message">{message}</div>
        </div>
      </div>

      <div className="driver-safety-actions">
        {onViewAhead && (
          <button
            type="button"
            className="driver-safety-btn"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: '#FBBF24',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fontWeight: 700,
            }}
            onClick={onViewAhead}
          >
            What&apos;s Ahead
          </button>
        )}
        <button type="button" className="driver-safety-btn" onClick={onViewSafety}>
          Safety Details
        </button>
        {onReportIssue && (
          <button
            type="button"
            className="driver-safety-btn"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#F87171',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              fontWeight: 600,
            }}
            onClick={onReportIssue}
          >
            Report Issue
          </button>
        )}
        <button
          type="button"
          className="driver-safety-btn driver-safety-btn-primary"
          onClick={onCheckReroute}
          disabled={!canReroute}
        >
          Find a safer route
        </button>
      </div>
    </div>
  );
}