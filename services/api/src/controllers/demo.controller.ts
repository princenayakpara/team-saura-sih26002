import type { Request, Response, NextFunction } from 'express';
import { incidentService } from '../services/incident.service.js';
import { accessibilityService } from '../services/accessibility.service.js';

export async function resetDemoState(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await Promise.all([
      incidentService.resetIncidentState(),
      accessibilityService.resetAccessibilityState(),
    ]);

    res.json({
      status: 'success',
      message: 'Demo scenario reset to initial baseline state.',
    });
  } catch (error) {
    next(error);
  }
}
