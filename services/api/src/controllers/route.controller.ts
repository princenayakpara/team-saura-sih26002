import { Request, Response, NextFunction } from 'express';
import { routingService, RoutingEngineError } from '../services/routing.service.js';
import { validateCoordinates, ValidationError } from '../utils/validation.js';
import type { Coordinate, RouteResponse, RoutingOptions, RoutingPreference } from '../types/routing.types.js';

function validateRouteRequestCoordinates(body: unknown): { origin: Coordinate; destination: Coordinate } {
  const request = body as {
    origin?: { latitude?: unknown; longitude?: unknown };
    destination?: { latitude?: unknown; longitude?: unknown };
  };

  if (!request?.origin || !request.destination) {
    throw new ValidationError('Request body must include origin and destination coordinate objects.');
  }

  return {
    origin: validateCoordinates(request.origin.latitude, request.origin.longitude),
    destination: validateCoordinates(request.destination.latitude, request.destination.longitude),
  };
}

function validateRoutingPreference(value: unknown): RoutingPreference {
  if (value === undefined) return 'BALANCED';
  if (value === 'FASTEST' || value === 'BALANCED' || value === 'SAFEST') return value;
  throw new ValidationError('routingPreference must be one of FASTEST, BALANCED, or SAFEST.');
}

function readRoutingOptions(value: unknown): RoutingOptions | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('routingOptions must be an object when provided.');
  }

  const options = value as RoutingOptions;
  if (options.maxPaths !== undefined && (!Number.isInteger(options.maxPaths) || options.maxPaths < 1)) {
    throw new ValidationError('routingOptions.maxPaths must be a positive integer when provided.');
  }

  return options;
}

function validateCurrentRoute(value: unknown, origin: Coordinate, destination: Coordinate): RouteResponse {
  const route = value as Partial<RouteResponse>;
  const coordinates = route?.geometry?.coordinates;

  if (
    !route
    || !Number.isFinite(route.distanceMeters)
    || !Number.isFinite(route.durationSeconds)
    || (route.distanceMeters ?? 0) <= 0
    || (route.durationSeconds ?? 0) <= 0
    || route.geometry?.type !== 'LineString'
    || !Array.isArray(coordinates)
    || coordinates.length < 2
  ) {
    throw new ValidationError('currentRoute must include positive distanceMeters, durationSeconds, and a LineString with at least two coordinates.');
  }

  const validatedCoordinates = coordinates.map((point, index) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw new ValidationError(`currentRoute geometry coordinate at index ${index} is invalid.`);
    }
    const coordinate = validateCoordinates(point[1], point[0]);
    return [coordinate.longitude, coordinate.latitude] as [number, number];
  });

  return {
    origin,
    destination,
    distanceMeters: route.distanceMeters!,
    durationSeconds: route.durationSeconds!,
    geometry: { type: 'LineString', coordinates: validatedCoordinates },
    instructions: Array.isArray(route.instructions) ? route.instructions : [],
  };
}

function handleRouteError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }
  if (err instanceof RoutingEngineError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
    });
    return;
  }
  next(err);
}

export async function getRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const originLat = req.query.originLat ?? req.query.origin_lat ?? req.query.originLatitude;
    const originLon = req.query.originLon ?? req.query.origin_lon ?? req.query.originLongitude;
    const destLat = req.query.destinationLat ?? req.query.dest_lat ?? req.query.destinationLatitude;
    const destLon = req.query.destinationLon ?? req.query.dest_lon ?? req.query.destinationLongitude;

    if (!originLat || !originLon || !destLat || !destLon) {
      res.status(400).json({
        status: 'error',
        message: 'Origin and destination coordinates (originLat, originLon, destinationLat, destinationLon) are all required.',
      });
      return;
    }

    const origin = validateCoordinates(originLat, originLon);
    const destination = validateCoordinates(destLat, destLon);

    const route = await routingService.calculateRoute(origin, destination);

    res.json({
      status: 'success',
      data: route,
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
}

export async function optimizeRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { origin, destination } = validateRouteRequestCoordinates(req.body);
    const request = req.body as { routingPreference?: unknown; routingOptions?: unknown };
    const routingPreference = validateRoutingPreference(request.routingPreference);
    const routingOptions = readRoutingOptions(request.routingOptions);
    const result = await routingService.optimizeRoute(origin, destination, routingPreference, routingOptions);

    res.json({ status: 'success', data: result });
  } catch (err) {
    handleRouteError(err, res, next);
  }
}

export async function rerouteRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { origin, destination } = validateRouteRequestCoordinates(req.body);
    const request = req.body as { currentRoute?: unknown; routingOptions?: unknown };
    const currentRoute = validateCurrentRoute(request.currentRoute, origin, destination);
    const routingOptions = readRoutingOptions(request.routingOptions);
    const result = await routingService.evaluateRerouteForRoute(currentRoute, origin, destination, routingOptions);

    res.json({ status: 'success', data: result });
  } catch (err) {
    handleRouteError(err, res, next);
  }
}

export async function getWhatsAhead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { computeWhatsAhead } = await import('../services/whatsahead.service.js');
    const body = req.body as { geometry?: { type?: string; coordinates?: unknown } };

    if (!body?.geometry || body.geometry.type !== 'LineString' || !Array.isArray(body.geometry.coordinates) || body.geometry.coordinates.length < 2) {
      res.status(400).json({
        status: 'error',
        message: 'Request body must include a valid GeoJSON LineString geometry with at least 2 coordinate pairs.',
      });
      return;
    }

    const coordinates = body.geometry.coordinates.map((pt: unknown, idx: number) => {
      if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
        throw new ValidationError(`Geometry coordinate at index ${idx} must be [longitude, latitude] numbers.`);
      }
      return [pt[0], pt[1]] as [number, number];
    });

    const result = await computeWhatsAhead({
      type: 'LineString',
      coordinates,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
}
