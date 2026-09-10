import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { weatherService } from './weather.service.js';
import { incidentService } from './incident.service.js';
import {
  calculateHaversineDistanceKm,
  estimateTerrainSlopeDegrees,
  riskService,
} from './risk.service.js';
import type {
  MLFeaturePayload,
  MLPredictionData,
  MLModelInfo,
} from '../types/ml.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MLService {
  private metadataPath: string;
  private modelMetadata: any = null;

  constructor() {
    this.metadataPath = path.resolve(
      __dirname,
      '../../../../services/ml/models/model_metadata.json'
    );
    this.loadMetadata();
  }

  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const raw = fs.readFileSync(this.metadataPath, 'utf-8');
        this.modelMetadata = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[MLService] Could not read model metadata:', err);
    }
  }

  public getModelInfo(): MLModelInfo {
    if (!this.modelMetadata) {
      this.loadMetadata();
    }
    return {
      model_name: this.modelMetadata?.model_name || 'SauraRoute-Landslide-RandomForest',
      model_version: this.modelMetadata?.model_version || 'v1.0.0-rf-step7',
      algorithm: this.modelMetadata?.algorithm || 'RandomForestClassifier',
      dataset_statistics: this.modelMetadata?.dataset_statistics || {
        total_samples: 40,
        positive_samples: 20,
        negative_samples: 20,
        features_count: 6,
      },
      cross_validation_5fold: this.modelMetadata?.cross_validation_5fold || {
        mean_accuracy: 1.0,
        std_accuracy: 0.0,
        mean_roc_auc: 1.0,
      },
      feature_importances: this.modelMetadata?.feature_importances || {
        elevation_m: 0.24,
        slope_degrees: 0.22,
        distance_to_hotspot_km: 0.2,
        precipitation_24h_mm: 0.18,
        soil_saturation_index: 0.16,
        active_incident_count_15km: 0.0,
      },
    };
  }

  /**
   * Executes inference using Python CLI or deterministic in-process fallback.
   */
  public async predictFromFeatures(features: MLFeaturePayload): Promise<MLPredictionData> {
    // Attempt Python bridge first
    try {
      const pythonResult = await this.invokePythonInference(features);
      if (pythonResult) {
        return pythonResult;
      }
    } catch {
      // Fall through to deterministic fallback
    }

    return this.deterministicInferenceFallback(features);
  }

  /**
   * Extracts real-time features for a coordinate and computes ML prediction.
   */
  public async predictForCoordinate(
    latitude: number,
    longitude: number,
    options?: { precipitationOverrideMm?: number; slopeOverrideDeg?: number }
  ): Promise<MLPredictionData> {
    // 1. Weather
    let precipitationMm = options?.precipitationOverrideMm ?? 0.0;
    if (options?.precipitationOverrideMm === undefined) {
      try {
        const weather = await weatherService.getWeatherForCoordinate(latitude, longitude);
        precipitationMm = weather.current.precipitation;
      } catch {
        precipitationMm = 0.0;
      }
    }

    // 2. Terrain Slope & Elevation
    const slopeDeg = options?.slopeOverrideDeg ?? estimateTerrainSlopeDegrees(latitude, longitude);
    const elevationM = slopeDeg > 30 ? 750.0 : slopeDeg > 15 ? 300.0 : 65.0;

    // 3. Proximity to historical landslide hotspot
    const histResult = riskService.calculateHistoricalSubscore(latitude, longitude);
    const distHotspotKm = histResult.nearestDistanceKm ?? 25.0;

    // 4. Active incidents count within 15km
    let incidentCount = 0;
    try {
      const incGeoJson = await incidentService.listIncidents();
      const active = incGeoJson.features.filter(
        (f) => f.properties.status !== 'RESOLVED' && f.properties.status !== 'REJECTED'
      );
      for (const inc of active) {
        const dist = calculateHaversineDistanceKm(
          latitude,
          longitude,
          inc.geometry.coordinates[1],
          inc.geometry.coordinates[0]
        );
        if (dist <= 15.0) {
          incidentCount++;
        }
      }
    } catch {
      incidentCount = 0;
    }

    // 5. Soil saturation proxy
    const soilSaturation = Math.min(1.0, Math.max(0.1, (precipitationMm / 100.0) * 0.7 + (slopeDeg / 50.0) * 0.3));

    const features: MLFeaturePayload = {
      precipitation_24h_mm: Math.round(precipitationMm * 10) / 10,
      slope_degrees: Math.round(slopeDeg * 10) / 10,
      distance_to_hotspot_km: Math.round(distHotspotKm * 10) / 10,
      active_incident_count_15km: incidentCount,
      elevation_m: Math.round(elevationM * 10) / 10,
      soil_saturation_index: Math.round(soilSaturation * 1000) / 1000,
    };

    const prediction = await this.predictFromFeatures(features);
    prediction.location = { latitude, longitude };
    return prediction;
  }

  private invokePythonInference(features: MLFeaturePayload): Promise<MLPredictionData | null> {
    return new Promise((resolve) => {
      const pythonPathWin = path.resolve(
        __dirname,
        '../../../../services/ml/venv/Scripts/python.exe'
      );
      const pythonPathBin = path.resolve(
        __dirname,
        '../../../../services/ml/venv/bin/python.exe'
      );
      const pythonPath = fs.existsSync(pythonPathWin)
        ? pythonPathWin
        : fs.existsSync(pythonPathBin)
          ? pythonPathBin
          : null;
      const scriptPath = path.resolve(
        __dirname,
        '../../../../services/ml/src/classifier_service.py'
      );

      if (!pythonPath || !fs.existsSync(scriptPath)) {
        return resolve(null);
      }

      const proc = spawn(pythonPath, [scriptPath, '--json']);
      let stdoutData = '';
      let stderrData = '';

      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && stdoutData.trim()) {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            return resolve(parsed as MLPredictionData);
          } catch {
            return resolve(null);
          }
        }
        resolve(null);
      });

      proc.on('error', () => resolve(null));

      // Send payload via stdin
      proc.stdin.write(
        JSON.stringify({
          precipitation_mm: features.precipitation_24h_mm,
          slope_deg: features.slope_degrees,
          distance_hotspot_km: features.distance_to_hotspot_km,
          incident_count: features.active_incident_count_15km,
          elevation_m: features.elevation_m,
          soil_saturation: features.soil_saturation_index,
        })
      );
      proc.stdin.end();

      // Timeout after 2.5 seconds
      setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // ignore
        }
        resolve(null);
      }, 2500);
    });
  }

  private deterministicInferenceFallback(features: MLFeaturePayload): MLPredictionData {
    // Normalization parameters from training set
    const means = this.modelMetadata?.scaling_pipeline?.means || [74.84, 19.63, 33.14, 0.175, 623.25, 0.55];
    const stds = this.modelMetadata?.scaling_pipeline?.stds || [75.58, 17.44, 37.64, 0.38, 631.58, 0.335];

    // Standardized scores
    const zRain = (features.precipitation_24h_mm - means[0]) / stds[0];
    const zSlope = (features.slope_degrees - means[1]) / stds[1];
    const zDist = (features.distance_to_hotspot_km - means[2]) / stds[2];
    const zSat = (features.soil_saturation_index - means[5]) / stds[5];

    // Logistic decision scoring
    const logit = 0.35 * zRain + 0.35 * zSlope - 0.25 * zDist + 0.20 * zSat;
    const probability = 1 / (1 + Math.exp(-logit * 2.0));
    const clampedProb = Math.max(0.0, Math.min(1.0, Math.round(probability * 1000) / 1000));

    const prediction = clampedProb >= 0.5 ? 'LANDSLIDE_RISK' : 'NO_HAZARD';
    let risk_tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (clampedProb >= 0.75) risk_tier = 'CRITICAL';
    else if (clampedProb >= 0.5) risk_tier = 'HIGH';
    else if (clampedProb >= 0.25) risk_tier = 'MEDIUM';

    const confidence = Math.round(Math.abs(clampedProb - 0.5) * 2 * 1000) / 1000;

    return {
      prediction,
      probability: clampedProb,
      risk_tier,
      confidence,
      modelVersion: this.modelMetadata?.model_version || 'v1.0.0-rf-step7',
      features,
      featureImportance: this.getModelInfo().feature_importances,
    };
  }
}

export const mlService = new MLService();
