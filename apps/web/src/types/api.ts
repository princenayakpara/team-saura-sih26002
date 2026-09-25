export interface IncidentFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    type: string;
    severity: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string | null;
    photoUrl?: string | null;
    photoUrls?: string[];
  };
}

export interface IncidentFeatureCollection {
  type: 'FeatureCollection';
  features: IncidentFeature[];
}

export interface VehicleFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    vehicleCode: string;
    speed: number;
    heading: number;
    status: string;
    updatedAt: string;
  };
}

export interface VehicleFeatureCollection {
  type: 'FeatureCollection';
  features: VehicleFeature[];
}

export interface RouteNavigationInstruction {
  text: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResponse {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  instructions: RouteNavigationInstruction[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskWaypoint {
  coordinates: [number, number]; // [lon, lat]
  distanceAlongRouteKm: number;
  score: number;
  level: RiskLevel;
  primaryFactor: string;
}

export interface RouteRiskSummary {
  overallLevel: RiskLevel;
  meanScore: number;
  maxScore: number;
  hazardousSegmentCount: number;
  dominantTrigger: string;
  sampledWaypointsCount: number;
  waypoints?: RiskWaypoint[];
}

export interface HazardZoneFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    name: string;
    state: string;
    severity: string;
    eventDate?: string;
    triggerType?: string;
    fatalities?: number;
    provenanceSource?: string;
    description?: string;
  };
}

export interface HazardZoneFeatureCollection {
  type: 'FeatureCollection';
  features: HazardZoneFeature[];
}

export type AccessibilityStatus = 'OPEN' | 'RESTRICTED' | 'CLOSED';

export interface AccessibilityFeature {
  type: 'Feature';
  geometry: RouteResponse['geometry'];
  properties: {
    id: string;
    name: string;
    roadCode?: string;
    status: AccessibilityStatus;
    reason?: string;
    source: string;
    updatedAt: string;
  };
}

export interface AccessibilityFeatureCollection {
  type: 'FeatureCollection';
  features: AccessibilityFeature[];
}

export interface AccessibilityRecord {
  id: string;
  name: string;
  road_code?: string;
  status: AccessibilityStatus;
  reason?: string;
  source: string;
  geometry: RouteResponse['geometry'];
  created_at: string;
  updated_at: string;
}

export type AlertCategory = 'ROAD_CLOSURE' | 'ROAD_RESTRICTION' | 'ROUTE_HAZARD';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AlertRecord {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  accessibilityCorridorId?: string;
  accessibilityStatus?: AccessibilityStatus;
  routeCandidateId?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertCollection {
  items: AlertRecord[];
}

export interface AccessibilitySummary {
  status: 'ACCESSIBLE' | 'RESTRICTED' | 'ALL_CANDIDATES_CLOSED' | 'UNKNOWN';
  affectedCorridors: AccessibilityRecord[];
  reason?: string;
}

export interface CandidateAccessibility {
  status: 'ACCESSIBLE' | 'RESTRICTED' | 'CLOSED' | 'UNKNOWN';
  isEligible: boolean;
  affectedCorridors: AccessibilityRecord[];
  exclusionReason?: string;
}

export type RoutingPreference = 'FASTEST' | 'BALANCED' | 'SAFEST';

export interface CandidateRouteProfile {
  candidateId: string;
  name: string;
  isBaseline: boolean;
  distanceMeters: number;
  durationSeconds: number;
  weatherDelaySeconds?: number;
  geometry: RouteResponse['geometry'];
  instructions: RouteNavigationInstruction[];
  risk: RouteRiskSummary;
  mlSummary?: {
    maxProbability: number;
    meanProbability: number;
    riskTier: RiskLevel;
    prediction: 'LANDSLIDE_RISK' | 'NO_HAZARD';
  };
  compositeCost: number;
  normalizedCost: {
    durationScore: number;
    distanceScore: number;
    hazardScore: number;
    totalCost: number;
  };
  accessibility?: CandidateAccessibility;
}

export interface RouteOptimizationResult {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  selectedCandidateId: string;
  selectedRoute: CandidateRouteProfile;
  baselineRoute: CandidateRouteProfile;
  candidatesCount: number;
  candidates: CandidateRouteProfile[];
  preference: RoutingPreference;
  safetyIntelligence: {
    status: 'AVAILABLE' | 'DEGRADED';
    reason?: string;
  };
  optimization: {
    strategy: 'SAFETY_OPTIMIZED' | 'SPEED_BASELINE';
    selectionReason: string;
    hazardReductionPercent: number;
    additionalDistanceKm: number;
    additionalDurationMinutes: number;
  };
  accessibility?: AccessibilitySummary;
}

export interface RerouteEvaluationResult {
  rerouteRecommended: boolean;
  reason: string;
  currentRoute: {
    riskLevel: RiskLevel;
    meanRiskScore: number;
    maxRiskScore: number;
    hazardousSegmentCount: number;
    accessibility?: CandidateAccessibility;
  };
  safetyIntelligence: {
    status: 'AVAILABLE' | 'DEGRADED';
    reason?: string;
  };
  recommendedRoute?: CandidateRouteProfile;
  metrics?: {
    hazardReductionPercent: number;
    additionalDistanceMeters: number;
    additionalDurationSeconds: number;
  };
  evaluatedCandidatesCount: number;
  accessibility?: AccessibilitySummary;
}

export type WhatsAheadCategory = 'INCIDENT' | 'CORRIDOR_CLOSED' | 'CORRIDOR_RESTRICTED';

export interface WhatsAheadItem {
  id: string;
  category: WhatsAheadCategory;
  title: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  isVerified: boolean;
  distanceAheadMeters: number;
  distanceLabel: string;
  locationContext: string;
  priority: number;
  coordinates: [number, number];
}

export interface WhatsAheadResult {
  items: WhatsAheadItem[];
  totalCount: number;
  computedAt: string;
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
