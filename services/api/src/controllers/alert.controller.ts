import type { NextFunction, Request, Response } from 'express';
import { alertService } from '../services/alert.service.js';
import { ValidationError } from '../utils/validation.js';

export async function listAlerts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ status: 'success', data: await alertService.listAlerts() });
  } catch (error) {
    next(error);
  }
}

export async function getRouteAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

    const result = await alertService.computeRouteAlerts({
      type: 'LineString',
      coordinates,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
      return;
    }
    next(error);
  }
}
