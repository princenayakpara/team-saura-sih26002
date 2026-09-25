/**
 * What's Ahead Service — M5
 *
 * Computes route-linked hazards, incidents, and corridor conditions that are
 * relevant to the driver's current selected route. Items are filtered by
 * geographic proximity to the route geometry and sorted by distance ahead.
 *
 * All geographic computation stays server-side. The frontend simply consumes
 * the result without duplicating spatial logic.
 */
import { incidentService } from './incident.service.js';
import { accessibilityService, routeToCorridorDistanceMeters } from './accessibility.service.js';
import { ACCESSIBILITY_CONFIG } from '../config/accessibility.config.js';
import type { RouteGeometry } from '../types/routing.types.js';

/** Maximum distance (meters) from a route for an incident to be considered route-linked. */
const INCIDENT_ROUTE_PROXIMITY_METERS = 2500;

export type WhatsAheadCategory = 'INCIDENT' | 'CORRIDOR_CLOSED' | 'CORRIDOR_RESTRICTED';

export interface WhatsAheadItem {
  id: string;
  category: WhatsAheadCategory;
  title: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  /** Whether this item has been verified by operations. */
  isVerified: boolean;
  /** Approximate distance ahead along the route, in meters. -1 if not calculable. */
  distanceAheadMeters: number;
  /** Human-readable distance label */
  distanceLabel: string;
  /** Location/area context */
  locationContext: string;
  /** Priority rank for sorting (lower = more important) */
  priority: number;
  /** Coordinates [lon, lat] */
  coordinates: [number, number];
}

export interface WhatsAheadResult {
  items: WhatsAheadItem[];
  totalCount: number;
  /** ISO timestamp of when this data was computed */
  computedAt: string;
}

/**
 * Approximate distance in meters between two [lon, lat] points using
 * equirectangular projection. Reuses the same math as the accessibility service.
 */
function haversineApproxMeters(a: [number, number], b: [number, number]): number {
  const metersPerDegreeLat = 111_320;
  const midLatRad = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(midLatRad);
  const dx = (b[0] - a[0]) * metersPerDegreeLon;
  const dy = (b[1] - a[1]) * metersPerDegreeLat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the closest point on the route to the given point and returns
 * the cumulative distance along the route to that closest point.
 */
function distanceAlongRoute(
  routeCoords: [number, number][],
  point: [number, number],
): number {
  if (routeCoords.length < 2) return -1;

  let closestDist = Number.POSITIVE_INFINITY;
  let closestCumulDist = 0;
  let cumulativeDistance = 0;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const segStart = routeCoords[i];
    const segEnd = routeCoords[i + 1];
    const segLen = haversineApproxMeters(segStart, segEnd);

    // Project point onto segment using equirectangular math
    const metersPerDegreeLat = 111_320;
    const midLatRad = (((segStart[1] + segEnd[1]) / 2) * Math.PI) / 180;
    const metersPerDegreeLon = metersPerDegreeLat * Math.cos(midLatRad);

    const segX = (segEnd[0] - segStart[0]) * metersPerDegreeLon;
    const segY = (segEnd[1] - segStart[1]) * metersPerDegreeLat;
    const segLenSq = segX * segX + segY * segY;

    const dX = (point[0] - segStart[0]) * metersPerDegreeLon;
    const dY = (point[1] - segStart[1]) * metersPerDegreeLat;

    let t = 0;
    if (segLenSq > 0) {
      t = (dX * segX + dY * segY) / segLenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = t * segX;
    const projY = t * segY;
    const dist = Math.sqrt((dX - projX) * (dX - projX) + (dY - projY) * (dY - projY));

    if (dist < closestDist) {
      closestDist = dist;
      closestCumulDist = cumulativeDistance + t * segLen;
    }

    cumulativeDistance += segLen;
  }

  return closestDist <= INCIDENT_ROUTE_PROXIMITY_METERS ? closestCumulDist : -1;
}

function formatDistanceLabel(meters: number): string {
  if (meters < 0) return 'On route';
  if (meters < 1000) return `~${Math.round(meters / 100) * 100} m ahead`;
  return `~${(meters / 1000).toFixed(1)} km ahead`;
}

function incidentTitle(type: string): string {
  switch (type) {
    case 'LANDSLIDE': return 'Landslide / Mudslide';
    case 'FALLEN_ROCKS': return 'Fallen Rocks / Debris';
    case 'FLOOD': return 'Flash Flooding';
    case 'ROAD_DAMAGE': return 'Road Surface Damage';
    case 'ACCIDENT': return 'Vehicle Accident';
    case 'BLOCKAGE': return 'Corridor Blockage';
    default: return 'Road Hazard';
  }
}

function categoryPriority(category: WhatsAheadCategory, isVerified: boolean): number {
  // Lower = higher priority
  if (category === 'CORRIDOR_CLOSED') return 1;
  if (category === 'CORRIDOR_RESTRICTED') return 2;
  if (category === 'INCIDENT' && isVerified) return 3;
  if (category === 'INCIDENT') return 4;
  return 5;
}

/**
 * Computes all route-linked "What's Ahead" items for the given route geometry.
 */
export async function computeWhatsAhead(routeGeometry: RouteGeometry): Promise<WhatsAheadResult> {
  const items: WhatsAheadItem[] = [];
  const routeCoords = routeGeometry.coordinates;

  // 1. Find incidents within proximity of the route
  const incidentCollection = await incidentService.listIncidents();
  for (const feature of incidentCollection.features) {
    const incPoint: [number, number] = feature.geometry.coordinates;
    const status = feature.properties.status;

    // Skip resolved/rejected incidents — not relevant ahead
    if (status === 'RESOLVED' || status === 'REJECTED') continue;

    const distAhead = distanceAlongRoute(routeCoords, incPoint);
    if (distAhead < 0) continue; // Not on route

    const isVerified = status === 'VERIFIED' || status === 'ACTIVE';
    const category: WhatsAheadCategory = 'INCIDENT';

    items.push({
      id: feature.properties.id,
      category,
      title: incidentTitle(feature.properties.type),
      type: feature.properties.type,
      status: feature.properties.status,
      severity: feature.properties.severity,
      description: feature.properties.description,
      isVerified,
      distanceAheadMeters: Math.round(distAhead),
      distanceLabel: formatDistanceLabel(distAhead),
      locationContext: `${feature.geometry.coordinates[1].toFixed(4)}°N, ${feature.geometry.coordinates[0].toFixed(4)}°E`,
      priority: categoryPriority(category, isVerified),
      coordinates: incPoint,
    });
  }

  // 2. Find corridors affecting this route (CLOSED or RESTRICTED)
  const corridors = await accessibilityService.listAccessibility();
  const toleranceMeters = ACCESSIBILITY_CONFIG.routing.intersectionToleranceMeters;

  for (const corridor of corridors) {
    if (corridor.status === 'OPEN') continue;

    const distance = routeToCorridorDistanceMeters(routeGeometry, corridor.geometry);
    if (distance > toleranceMeters) continue;

    // Use the midpoint of the corridor geometry for distance-along-route
    const midIdx = Math.floor(corridor.geometry.coordinates.length / 2);
    const corridorMidpoint = corridor.geometry.coordinates[midIdx];
    const distAhead = distanceAlongRoute(routeCoords, corridorMidpoint);
    const effectiveDist = distAhead >= 0 ? distAhead : 0;

    const category: WhatsAheadCategory = corridor.status === 'CLOSED' ? 'CORRIDOR_CLOSED' : 'CORRIDOR_RESTRICTED';

    items.push({
      id: corridor.id,
      category,
      title: corridor.status === 'CLOSED' ? 'Road Closure' : 'Restricted Corridor',
      type: corridor.status === 'CLOSED' ? 'ROAD_CLOSURE' : 'ROAD_RESTRICTION',
      status: corridor.status,
      severity: corridor.status === 'CLOSED' ? 'CRITICAL' : 'WARNING',
      description: corridor.reason || `${corridor.name} is currently ${corridor.status.toLowerCase()}`,
      isVerified: true, // Corridor status is always operations-verified
      distanceAheadMeters: Math.round(effectiveDist),
      distanceLabel: formatDistanceLabel(effectiveDist),
      locationContext: corridor.name,
      priority: categoryPriority(category, true),
      coordinates: corridorMidpoint,
    });
  }

  // Sort: priority first, then distance along route
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distanceAheadMeters - b.distanceAheadMeters;
  });

  return {
    items,
    totalCount: items.length,
    computedAt: new Date().toISOString(),
  };
}
