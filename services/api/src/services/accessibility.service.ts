import crypto from 'crypto';
import { pool, getDbAvailability } from '../db/connection.js';
import { ACCESSIBILITY_CONFIG } from '../config/accessibility.config.js';
import {
  AccessibilityStatus,
  AccessibilityRecord,
  AccessibilityFeature,
  AccessibilityFeatureCollection,
  VALID_ACCESSIBILITY_STATUSES,
  ALLOWED_ACCESSIBILITY_STATUS_TRANSITIONS,
} from '../types/accessibility.types.js';
import type { RouteGeometry } from '../types/routing.types.js';
import { ValidationError } from '../utils/validation.js';

// Baseline seeded corridors for NER highway network
function createInitialCorridors(): Map<string, AccessibilityRecord> {
  const now = new Date().toISOString();
  return new Map<string, AccessibilityRecord>([
    [
      'acc_nh6_nongpoh',
      {
        id: 'acc_nh6_nongpoh',
        name: 'NH-6 GS Road Corridor (Nongpoh Segment)',
        road_code: 'NH-6',
        status: 'OPEN',
        reason: 'All lanes open for regular commercial transit',
        source: 'National Highway Authority / State PWD',
        geometry: {
          type: 'LineString',
          coordinates: [
            [91.7821, 25.9810],
            [91.8012, 25.9021],
            [91.8400, 25.7800],
          ],
        },
        created_at: now,
        updated_at: now,
      },
    ],
    [
      'acc_nh27_tezpur',
      {
        id: 'acc_nh27_tezpur',
        name: 'NH-27 / NH-15 North Bank Corridor',
        road_code: 'NH-27',
        status: 'OPEN',
        reason: 'Normal transit',
        source: 'Assam PWD',
        geometry: {
          type: 'LineString',
          coordinates: [
            [91.7362, 26.1445],
            [92.1500, 26.3500],
            [92.5000, 26.5000],
            [92.7926, 26.6338],
          ],
        },
        created_at: now,
        updated_at: now,
      },
    ],
    [
      'acc_sh5_cherrapunji',
      {
        id: 'acc_sh5_cherrapunji',
        name: 'SH-5 Sohra Hill Pass',
        road_code: 'SH-5',
        status: 'OPEN',
        reason: 'Normal transit',
        source: 'Meghalaya PWD',
        geometry: {
          type: 'LineString',
          coordinates: [
            [91.8933, 25.5788],
            [91.8300, 25.4200],
            [91.7323, 25.2702],
          ],
        },
        created_at: now,
        updated_at: now,
      },
    ],
  ]);
}

// In-memory fallback store (authoritative when PostGIS is unavailable).
const inMemoryAccessibility = createInitialCorridors();

function validateAccessibilityStatus(status: unknown): AccessibilityStatus {
  if (typeof status !== 'string' || !VALID_ACCESSIBILITY_STATUSES.includes(status as AccessibilityStatus)) {
    throw new ValidationError(
      `Invalid accessibility status "${status}". Allowed values: ${VALID_ACCESSIBILITY_STATUSES.join(', ')}`
    );
  }
  return status as AccessibilityStatus;
}

function validateAccessibilityTransition(
  currentStatus: AccessibilityStatus,
  newStatus: AccessibilityStatus,
): void {
  const allowed = ALLOWED_ACCESSIBILITY_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Invalid accessibility status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(', ')}`
    );
  }
}

/**
 * Approximate distance in meters from a point to a finite great-circle segment.
 *
 * This is a prototype proximity heuristic using an equirectangular projection
 * around the segment, not exact road-segment topology. It is intentionally
 * dependency-free (no PostGIS/turf) and deterministic.
 */
function pointToSegmentDistanceMeters(
  point: [longitude: number, latitude: number],
  start: [longitude: number, latitude: number],
  end: [longitude: number, latitude: number],
): number {
  const metersPerDegreeLat = 111_320;
  const midLatRad = (((start[1] + end[1]) / 2) * Math.PI) / 180;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(midLatRad);

  const segX = (end[0] - start[0]) * metersPerDegreeLon;
  const segY = (end[1] - start[1]) * metersPerDegreeLat;
  const segLengthSq = segX * segX + segY * segY;

  const dX = (point[0] - start[0]) * metersPerDegreeLon;
  const dY = (point[1] - start[1]) * metersPerDegreeLat;

  let t = 0;
  if (segLengthSq > 0) {
    t = (dX * segX + dY * segY) / segLengthSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projX = t * segX;
  const projY = t * segY;
  return Math.sqrt((dX - projX) * (dX - projX) + (dY - projY) * (dY - projY));
}

/**
 * Minimum distance in meters between a route LineString and a corridor LineString.
 */
export function routeToCorridorDistanceMeters(route: RouteGeometry, corridor: RouteGeometry): number {
  const corridorCoords = corridor.coordinates;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of route.coordinates) {
    for (let i = 0; i < corridorCoords.length - 1; i++) {
      const distance = pointToSegmentDistanceMeters(point, corridorCoords[i], corridorCoords[i + 1]);
      if (distance < minDistance) minDistance = distance;
    }
  }

  return minDistance;
}

function recordToFeature(record: AccessibilityRecord): AccessibilityFeature {
  return {
    type: 'Feature',
    geometry: record.geometry,
    properties: {
      id: record.id,
      name: record.name,
      roadCode: record.road_code,
      status: record.status,
      reason: record.reason,
      source: record.source,
      updatedAt: record.updated_at,
    },
  };
}

export class AccessibilityService {
  async listAccessibility(): Promise<AccessibilityRecord[]> {
    let records: AccessibilityRecord[] = [];

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const query = `
            SELECT id, name, road_code, status, reason, source,
                   ST_AsGeoJSON(geometry)::json as geometry_geojson,
                   created_at, updated_at
            FROM road_accessibility
            ORDER BY updated_at DESC;
          `;
          const { rows } = await client.query(query);
          records = rows.map((row) => this.rowToRecord(row));
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    if (records.length === 0) {
      records = Array.from(inMemoryAccessibility.values()).sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at)
      );
    }

    return records;
  }

  async getAccessibilityById(id: string): Promise<AccessibilityRecord | null> {
    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const query = `
            SELECT id, name, road_code, status, reason, source,
                   ST_AsGeoJSON(geometry)::json as geometry_geojson,
                   created_at, updated_at
            FROM road_accessibility
            WHERE id = $1;
          `;
          const { rows } = await client.query(query, [id]);
          if (rows.length > 0) return this.rowToRecord(rows[0]);
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    return inMemoryAccessibility.get(id) ?? null;
  }

  async createAccessibility(params: {
    name: string;
    road_code?: string;
    status: AccessibilityStatus;
    reason?: string;
    source: string;
    geometry: RouteGeometry;
  }): Promise<AccessibilityRecord> {
    const status = validateAccessibilityStatus(params.status);
    const id = `acc_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const query = `
            INSERT INTO road_accessibility (id, name, road_code, status, reason, source, geometry, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromGeoJSON($7), NOW(), NOW())
            RETURNING id, name, road_code, status, reason, source,
                      ST_AsGeoJSON(geometry)::json as geometry_geojson, created_at, updated_at;
          `;
          const { rows } = await client.query(query, [
            id,
            params.name,
            params.road_code ?? null,
            status,
            params.reason ?? null,
            params.source,
            JSON.stringify(params.geometry),
          ]);
          const record = this.rowToRecord(rows[0]);
          inMemoryAccessibility.set(record.id, record);
          return record;
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    const record: AccessibilityRecord = {
      id,
      name: params.name,
      road_code: params.road_code,
      status,
      reason: params.reason,
      source: params.source,
      geometry: params.geometry,
      created_at: now,
      updated_at: now,
    };
    inMemoryAccessibility.set(id, record);
    return record;
  }

  async updateAccessibilityStatus(
    id: string,
    newStatus: AccessibilityStatus,
    reason?: string,
  ): Promise<AccessibilityRecord | null> {
    const validatedStatus = validateAccessibilityStatus(newStatus);
    const now = new Date().toISOString();

    const existing = await this.getAccessibilityById(id);
    if (!existing) return null;

    validateAccessibilityTransition(existing.status, validatedStatus);

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const query = `
            UPDATE road_accessibility
            SET status = $1, reason = COALESCE($2, reason), updated_at = NOW()
            WHERE id = $3
            RETURNING id, name, road_code, status, reason, source,
                      ST_AsGeoJSON(geometry)::json as geometry_geojson, created_at, updated_at;
          `;
          const { rows } = await client.query(query, [validatedStatus, reason ?? null, id]);
          const record = this.rowToRecord(rows[0]);
          inMemoryAccessibility.set(record.id, record);
          return record;
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    existing.status = validatedStatus;
    existing.updated_at = now;
    if (reason !== undefined) existing.reason = reason;
    inMemoryAccessibility.set(existing.id, existing);
    return existing;
  }

  async deleteAccessibility(id: string): Promise<boolean> {
    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const result = await client.query('DELETE FROM road_accessibility WHERE id = $1', [id]);
          if ((result.rowCount ?? 0) > 0) {
            inMemoryAccessibility.delete(id);
            return true;
          }
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    return inMemoryAccessibility.delete(id);
  }

  async getAccessibilityFeatures(): Promise<AccessibilityFeatureCollection> {
    const records = await this.listAccessibility();
    return {
      type: 'FeatureCollection',
      features: records.map(recordToFeature),
    };
  }

  /**
   * Returns corridors whose geometry is within the configured intersection
   * tolerance of the given route geometry. The status of each returned corridor
   * is preserved so the routing layer can decide CLOSED vs RESTRICTED handling.
   */
  async findAccessibilityAffectingRoute(routeGeometry: RouteGeometry): Promise<AccessibilityRecord[]> {
    const records = await this.listAccessibility();
    const toleranceMeters = ACCESSIBILITY_CONFIG.routing.intersectionToleranceMeters;

    return records.filter((record) => {
      const distance = routeToCorridorDistanceMeters(routeGeometry, record.geometry);
      // Inclusive boundary: distance <= tolerance counts as affected.
      return distance <= toleranceMeters;
    });
  }

  /**
   * Connects a VERIFIED incident to corridor accessibility closure.
   * Only VERIFIED incidents trigger closure. Unverified / Rejected incidents are ignored.
   */
  async handleIncidentVerification(incident: {
    id: string;
    type: string;
    description: string;
    latitude: number;
    longitude: number;
    status: string;
  }): Promise<AccessibilityRecord[]> {
    if (incident.status !== 'VERIFIED') {
      return [];
    }

    const records = await this.listAccessibility();
    const updatedCorridors: AccessibilityRecord[] = [];
    const incidentPoint: [number, number] = [Number(incident.longitude), Number(incident.latitude)];

    for (const record of records) {
      let minDistance = Number.POSITIVE_INFINITY;
      const coords = record.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        const dist = pointToSegmentDistanceMeters(incidentPoint, coords[i], coords[i + 1]);
        if (dist < minDistance) minDistance = dist;
      }

      // Proximity threshold: within 2500m of the corridor segment
      if (minDistance <= 2500) {
        if (record.status === 'OPEN' || record.status === 'RESTRICTED') {
          const reason = `Verified ${incident.type}: ${incident.description}`;
          const updated = await this.updateAccessibilityStatus(record.id, 'CLOSED', reason);
          if (updated) {
            updatedCorridors.push(updated);
          }
        }
      }
    }

    return updatedCorridors;
  }

  /**
   * Resets accessibility corridors to baseline initial state (OPEN).
   */
  async resetAccessibilityState(): Promise<void> {
    const initial = createInitialCorridors();
    inMemoryAccessibility.clear();
    for (const [key, value] of initial.entries()) {
      inMemoryAccessibility.set(key, value);
    }
  }

  private rowToRecord(row: {
    id: string;
    name: string;
    road_code: string | null;
    status: AccessibilityStatus;
    reason: string | null;
    source: string;
    geometry_geojson: unknown;
    created_at: string;
    updated_at: string;
  }): AccessibilityRecord {
    const geometry = (row.geometry_geojson as { coordinates?: [number, number][] }) ?? {
      type: 'LineString',
      coordinates: [],
    };
    return {
      id: row.id,
      name: row.name,
      road_code: row.road_code ?? undefined,
      status: row.status,
      reason: row.reason ?? undefined,
      source: row.source,
      geometry: {
        type: 'LineString',
        coordinates: geometry.coordinates ?? [],
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const accessibilityService = new AccessibilityService();