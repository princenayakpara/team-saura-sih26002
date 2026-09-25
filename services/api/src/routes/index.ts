import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';
import { getWeather } from '../controllers/weather.controller.js';
import {
  createIncident,
  listIncidents,
  updateIncidentStatus,
} from '../controllers/incident.controller.js';
import {
  listVehicles,
  updateVehicleLocation,
} from '../controllers/vehicle.controller.js';
import { getRoute, optimizeRoute, rerouteRoute } from '../controllers/route.controller.js';
import {
  getPointRisk,
  evaluateRouteRisk,
  getHazardZones,
} from '../controllers/risk.controller.js';
import {
  getMLPrediction,
  postMLPrediction,
  getMLModelInfo,
} from '../controllers/ml.controller.js';
import {
  createAccessibility,
  deleteAccessibility,
  listAccessibility,
  updateAccessibilityStatus,
} from '../controllers/accessibility.controller.js';
import { listAlerts } from '../controllers/alert.controller.js';
import { resetDemoState } from '../controllers/demo.controller.js';

const router = Router();

// Demo scenario reset
router.post('/demo/reset', resetDemoState);

// Health
router.get('/health', healthCheck);

// Weather
router.get('/weather', getWeather);

// Incidents
router.post('/incidents', createIncident);
router.get('/incidents', listIncidents);
router.patch('/incidents/:id/status', updateIncidentStatus);

// Vehicles
router.get('/vehicles', listVehicles);
router.post('/vehicles/:id/location', updateVehicleLocation);

// Road accessibility
router.get('/accessibility', listAccessibility);
router.post('/accessibility', createAccessibility);
router.patch('/accessibility/:id/status', updateAccessibilityStatus);
router.delete('/accessibility/:id', deleteAccessibility);

// Current computed accessibility alerts
router.get('/alerts', listAlerts);

// Routing
router.get('/routes', getRoute);
router.post('/routes/optimize', optimizeRoute);
router.post('/routes/reroute', rerouteRoute);

// Risk Intelligence
router.get('/risk/point', getPointRisk);
router.post('/risk/route', evaluateRouteRisk);
router.get('/risk/zones', getHazardZones);

// Machine Learning Classifiers
router.get('/ml/predict', getMLPrediction);
router.post('/ml/predict', postMLPrediction);
router.get('/ml/model', getMLModelInfo);

export default router;
