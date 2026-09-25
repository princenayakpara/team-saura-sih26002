import { ACCESSIBILITY_CONFIG } from '../config/accessibility.config.js';
import { accessibilityService } from './accessibility.service.js';
import { computeWhatsAhead } from './whatsahead.service.js';
import type { AlertCollection, AlertRecord, DriverRouteAlert, DriverRouteAlertResult } from '../types/alert.types.js';
import type { RouteGeometry } from '../types/routing.types.js';

export class AlertService {
  /**
   * Computes the current accessibility alerts from corridor state. Alerts are
   * derived on read so no notification or persistence subsystem is needed.
   */
  async listAlerts(): Promise<AlertCollection> {
    const corridors = await accessibilityService.listAccessibility();
    const items: AlertRecord[] = corridors.flatMap((corridor) => {
      if (corridor.status === 'OPEN') return [];

      const isClosed = corridor.status === 'CLOSED';
      return [{
        id: `accessibility-${corridor.id}-${corridor.status.toLowerCase()}`,
        category: isClosed ? 'ROAD_CLOSURE' : 'ROAD_RESTRICTION',
        severity: isClosed
          ? ACCESSIBILITY_CONFIG.alerts.roadClosureSeverity
          : ACCESSIBILITY_CONFIG.alerts.roadRestrictionSeverity,
        title: isClosed ? `Road closure: ${corridor.name}` : `Road restriction: ${corridor.name}`,
        message: corridor.reason
          ?? (isClosed ? 'This corridor is currently closed.' : 'This corridor is currently restricted.'),
        accessibilityCorridorId: corridor.id,
        accessibilityStatus: corridor.status,
        created_at: corridor.updated_at,
        updated_at: corridor.updated_at,
      }];
    });

    items.sort((left, right) => left.id.localeCompare(right.id));
    return { items };
  }

  /**
   * M7 — Computes route-specific alerts for a driver's active route geometry.
   * Only VERIFIED incidents and CLOSED/RESTRICTED corridors generate route alerts.
   * Unverified reports, rejected reports, and distant unrelated incidents do NOT generate alerts.
   */
  async computeRouteAlerts(routeGeometry: RouteGeometry): Promise<DriverRouteAlertResult> {
    const whatsAhead = await computeWhatsAhead(routeGeometry);
    const alerts: DriverRouteAlert[] = [];

    for (const item of whatsAhead.items) {
      // Trust boundary: ONLY operations-verified conditions generate verified route alerts
      if (!item.isVerified) {
        continue;
      }

      if (item.category === 'CORRIDOR_CLOSED') {
        alerts.push({
          id: `alert-closed-${item.id}`,
          category: 'ROAD_CLOSURE',
          severity: 'CRITICAL',
          headline: 'ROUTE UPDATE — ROAD CLOSURE',
          title: 'Verified Road Closure Ahead',
          message: `${item.description} (${item.distanceLabel}). Your current route is affected by a road closure verified by Operations.`,
          status: 'CLOSED',
          isVerified: true,
          affectedCorridorOrLocation: item.locationContext,
          distanceAheadMeters: item.distanceAheadMeters,
          distanceLabel: item.distanceLabel,
          requiresReroute: true,
          actionLabel: 'Review Safer Route',
          secondaryActionLabel: "View What's Ahead",
          created_at: new Date().toISOString(),
        });
      } else if (item.category === 'CORRIDOR_RESTRICTED') {
        alerts.push({
          id: `alert-restricted-${item.id}`,
          category: 'ROAD_RESTRICTION',
          severity: 'WARNING',
          headline: 'ROUTE UPDATE — TRAVEL RESTRICTION',
          title: 'Restricted Corridor Ahead',
          message: `${item.description} (${item.distanceLabel}). Drive with caution on this corridor segment.`,
          status: 'RESTRICTED',
          isVerified: true,
          affectedCorridorOrLocation: item.locationContext,
          distanceAheadMeters: item.distanceAheadMeters,
          distanceLabel: item.distanceLabel,
          requiresReroute: false,
          actionLabel: 'Review Safer Route',
          secondaryActionLabel: "View What's Ahead",
          created_at: new Date().toISOString(),
        });
      } else if (item.isVerified && (item.status === 'VERIFIED' || item.status === 'ACTIVE')) {
        const isCritical = item.severity === 'CRITICAL';
        alerts.push({
          id: `alert-hazard-${item.id}`,
          category: 'VERIFIED_HAZARD',
          severity: isCritical ? 'CRITICAL' : 'WARNING',
          headline: isCritical ? 'ROUTE UPDATE — CRITICAL ROAD HAZARD' : 'ROUTE UPDATE — ROAD ADVISORY',
          title: `Verified ${item.title} Ahead`,
          message: `${item.description} (${item.distanceLabel}). Verified by Operations.`,
          status: item.status,
          isVerified: true,
          affectedCorridorOrLocation: item.locationContext,
          distanceAheadMeters: item.distanceAheadMeters,
          distanceLabel: item.distanceLabel,
          requiresReroute: isCritical,
          actionLabel: 'Review Safer Route',
          secondaryActionLabel: "View What's Ahead",
          created_at: new Date().toISOString(),
        });
      }
    }

    // Sort by priority (severity CRITICAL before WARNING, then distance ahead)
    alerts.sort((a, b) => {
      if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
      if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
      return a.distanceAheadMeters - b.distanceAheadMeters;
    });

    const activeAlert = alerts.length > 0 ? alerts[0] : null;

    return {
      hasAlert: alerts.length > 0,
      activeAlert,
      alerts,
      totalAlertsCount: alerts.length,
      computedAt: new Date().toISOString(),
    };
  }
}

export const alertService = new AlertService();
