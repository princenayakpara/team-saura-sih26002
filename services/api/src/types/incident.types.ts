export type IncidentType =
  | 'LANDSLIDE'
  | 'FALLEN_ROCKS'
  | 'FLOOD'
  | 'ROAD_DAMAGE'
  | 'ACCIDENT'
  | 'BLOCKAGE'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'REPORTED'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'REJECTED';

export const VALID_INCIDENT_TYPES: IncidentType[] = [
  'LANDSLIDE',
  'FALLEN_ROCKS',
  'FLOOD',
  'ROAD_DAMAGE',
  'ACCIDENT',
  'BLOCKAGE',
  'OTHER',
];

export const VALID_SEVERITIES: IncidentSeverity[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export const VALID_STATUSES: IncidentStatus[] = [
  'REPORTED',
  'VERIFIED',
  'ACTIVE',
  'RESOLVED',
  'REJECTED',
];

export const ALLOWED_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],
};

export interface IncidentRecord {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface IncidentFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] GeoJSON standard
  };
  properties: {
    id: string;
    type: IncidentType;
    severity: IncidentSeverity;
    description: string;
    status: IncidentStatus;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string | null;
  };
}

export interface IncidentFeatureCollection {
  type: 'FeatureCollection';
  features: IncidentFeature[];
}
