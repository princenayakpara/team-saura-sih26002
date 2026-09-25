import crypto from 'crypto';
import { pool, getDbAvailability } from '../db/connection.js';
import {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  IncidentFeature,
  IncidentFeatureCollection,
  IncidentRecord,
} from '../types/incident.types.js';
import { validateStatusTransition } from '../utils/validation.js';
import { accessibilityService } from './accessibility.service.js';

// Extend the incident data model to support photoUrl and photoUrls
declare module '../types/incident.types.js' {
  interface IncidentRecord {
    photoUrl?: string | null;
    photoUrls?: string[];
  }
}

export interface IncidentRecordWithPhoto extends IncidentRecord {
  photoUrl?: string | null;
  photoUrls?: string[];
}

function createInitialIncidents(): Map<string, IncidentRecord> {
  const now = new Date().toISOString();
  return new Map<string, IncidentRecord>([
    [
      'inc_sample_001',
      {
        id: 'inc_sample_001',
        type: 'LANDSLIDE',
        severity: 'CRITICAL',
        description: 'Major rockfall on NH-40 near Nongpoh',
        latitude: 25.9021,
        longitude: 91.8012,
        status: 'REPORTED',
        created_at: now,
        updated_at: now,
        resolved_at: null,
        photoUrl: null,
        photoUrls: [],
      },
    ],
  ]);
}

// In-memory store fallback with initial seed data
const inMemoryIncidents = createInitialIncidents();

export class IncidentService {
  async createIncident(params: {
    type: IncidentType;
    severity: IncidentSeverity;
    description: string;
    latitude: number;
    longitude: number;
    photoUrl?: string | null;
    photoUrls?: string[];
  }): Promise<IncidentRecord> {
    const id = `inc_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const photoUrl = params.photoUrl ?? (params.photoUrls && params.photoUrls.length > 0 ? params.photoUrls[0] : null);
    const photoUrls = params.photoUrls ?? (photoUrl ? [photoUrl] : []);

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const query = `
            INSERT INTO incidents (id, type, severity, description, location, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), 'REPORTED', NOW(), NOW())
            RETURNING id, type, severity, description, ST_X(location) as longitude, ST_Y(location) as latitude, status, created_at, updated_at, resolved_at;
          `;
          const { rows } = await client.query(query, [
            id,
            params.type,
            params.severity,
            params.description,
            params.longitude, // PostGIS MakePoint takes (X/lon, Y/lat)
            params.latitude,
          ]);
          const record = {
            ...rows[0],
            photoUrl,
            photoUrls,
          } as IncidentRecord;
          inMemoryIncidents.set(record.id, record);
          return record;
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    // Fallback in-memory
    const fallbackRecord: IncidentRecord = {
      id,
      type: params.type,
      severity: params.severity,
      description: params.description,
      latitude: params.latitude,
      longitude: params.longitude,
      status: 'REPORTED',
      created_at: now,
      updated_at: now,
      resolved_at: null,
      photoUrl,
      photoUrls,
    };
    inMemoryIncidents.set(id, fallbackRecord);
    return fallbackRecord;
  }

  async listIncidents(filters?: {
    status?: string;
    severity?: string;
    type?: string;
  }): Promise<IncidentFeatureCollection> {
    let records: IncidentRecord[] = [];

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          let query = `
            SELECT id, type, severity, description, ST_X(location) as longitude, ST_Y(location) as latitude, status, created_at, updated_at, resolved_at
            FROM incidents
            WHERE 1=1
          `;
          const values: unknown[] = [];
          let paramIdx = 1;

          if (filters?.status) {
            query += ` AND status = $${paramIdx++}`;
            values.push(filters.status);
          }
          if (filters?.severity) {
            query += ` AND severity = $${paramIdx++}`;
            values.push(filters.severity);
          }
          if (filters?.type) {
            query += ` AND type = $${paramIdx++}`;
            values.push(filters.type);
          }

          query += ' ORDER BY created_at DESC;';
          const { rows } = await client.query(query, values);
          records = rows as IncidentRecord[];
        } finally {
          client.release();
        }
      } catch {
        // Fallback below
      }
    }

    if (records.length === 0) {
      // Fallback in-memory
      records = Array.from(inMemoryIncidents.values());
      if (filters?.status) {
        records = records.filter(r => r.status === filters.status);
      }
      if (filters?.severity) {
        records = records.filter(r => r.severity === filters.severity);
      }
      if (filters?.type) {
        records = records.filter(r => r.type === filters.type);
      }
    }

    // Convert records to GeoJSON FeatureCollection
    // NOTE: GeoJSON requires coordinates: [longitude, latitude]
    const features: IncidentFeature[] = records.map(r => {
      const mem = inMemoryIncidents.get(r.id);
      const photoUrl = r.photoUrl ?? mem?.photoUrl ?? (r.photoUrls && r.photoUrls.length > 0 ? r.photoUrls[0] : null);
      const photoUrls = r.photoUrls ?? mem?.photoUrls ?? (photoUrl ? [photoUrl] : []);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(r.longitude), Number(r.latitude)], // [lon, lat]
        },
        properties: {
          id: r.id,
          type: r.type,
          severity: r.severity,
          description: r.description,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          resolvedAt: r.resolved_at || null,
          photoUrl: photoUrl ?? null,
          photoUrls: photoUrls ?? [],
        } as any,
      };
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  async updateIncidentStatus(id: string, newStatus: IncidentStatus): Promise<IncidentRecord | null> {
    const now = new Date().toISOString();

    if (getDbAvailability()) {
      try {
        const client = await pool.connect();
        try {
          const { rows: existingRows } = await client.query(
            'SELECT status FROM incidents WHERE id = $1',
            [id]
          );
          if (existingRows.length === 0) return null;

          const currentStatus = existingRows[0].status as IncidentStatus;
          validateStatusTransition(currentStatus, newStatus);

          const query = `
            UPDATE incidents
            SET status = $1,
                updated_at = NOW(),
                resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END
            WHERE id = $2
            RETURNING id, type, severity, description, ST_X(location) as longitude, ST_Y(location) as latitude, status, created_at, updated_at, resolved_at;
          `;
          const { rows } = await client.query(query, [newStatus, id]);
          const mem = inMemoryIncidents.get(id);
            const record = {
            ...rows[0],
            photoUrl: mem?.photoUrl ?? null,
            photoUrls: mem?.photoUrls ?? [],
          } as IncidentRecord;
          inMemoryIncidents.set(record.id, record);

          if (newStatus === 'VERIFIED') {
            await accessibilityService.handleIncidentVerification(record);
          }

          return record;
        } finally {
          client.release();
        }
      } catch (err) {
        if ((err as Error).name === 'ValidationError') throw err;
      }
    }

    // Fallback in-memory
    const existing = inMemoryIncidents.get(id);
    if (!existing) return null;

    validateStatusTransition(existing.status, newStatus);
    existing.status = newStatus;
    existing.updated_at = now;
    if (newStatus === 'RESOLVED') {
      existing.resolved_at = now;
    }

    if (newStatus === 'VERIFIED') {
      await accessibilityService.handleIncidentVerification(existing);
    }

    return existing;
  }

  /**
   * Resets incident store to baseline initial state.
   */
  async resetIncidentState(): Promise<void> {
    const initial = createInitialIncidents();
    inMemoryIncidents.clear();
    for (const [key, value] of initial.entries()) {
      inMemoryIncidents.set(key, value);
    }
  }
}

export const incidentService = new IncidentService();
