import type { AccessibilityStatus } from './accessibility.types.js';

/**
 * Lightweight alert domain for surfacing road accessibility and route-risk
 * warnings to operators. There are no push/SMS/WebSocket channels in this step;
 * alerts are computed and read via the API, then displayed in the dashboard.
 */
export type AlertCategory = 'ROAD_CLOSURE' | 'ROAD_RESTRICTION' | 'ROUTE_HAZARD';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export const VALID_ALERT_CATEGORIES: AlertCategory[] = [
  'ROAD_CLOSURE',
  'ROAD_RESTRICTION',
  'ROUTE_HAZARD',
];

export const VALID_ALERT_SEVERITIES: AlertSeverity[] = [
  'INFO',
  'WARNING',
  'CRITICAL',
];

export interface AlertRecord {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  // Corridor that triggered the alert, when applicable.
  accessibilityCorridorId?: string;
  accessibilityStatus?: AccessibilityStatus;
  // Affected route/candidate identifier, when the alert is route-scoped.
  routeCandidateId?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertCollection {
  items: AlertRecord[];
}

export interface DriverRouteAlert {
  id: string;
  category: 'ROAD_CLOSURE' | 'ROAD_RESTRICTION' | 'VERIFIED_HAZARD';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  headline: string;
  title: string;
  message: string;
  status: string;
  isVerified: boolean;
  affectedCorridorOrLocation: string;
  distanceAheadMeters: number;
  distanceLabel: string;
  requiresReroute: boolean;
  actionLabel: string;
  secondaryActionLabel: string;
  created_at: string;
}

export interface DriverRouteAlertResult {
  hasAlert: boolean;
  activeAlert: DriverRouteAlert | null;
  alerts: DriverRouteAlert[];
  totalAlertsCount: number;
  computedAt: string;
}