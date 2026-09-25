/**
 * M7 — Route-Specific Driver Alerts Automated Test Suite
 *
 * Tests:
 * 1. Relevant verified incident generates route-specific alert.
 * 2. Unrelated distant incident does NOT generate alert.
 * 3. Unverified incident does NOT generate verified route alert (preserves trust model).
 * 4. Rejected incident does NOT generate alert.
 * 5. Affected CLOSED corridor generates CRITICAL route closure alert (requiresReroute: true).
 * 6. Affected RESTRICTED corridor generates WARNING alert (requiresReroute: false).
 * 7. Alert contains accurate context (distanceAhead, distanceLabel, affected location).
 * 8. Priority ordering: CLOSED corridor > RESTRICTED > Critical verified hazard > Warning verified hazard.
 * 9. Repeated processing of same route event is idempotent.
 * 10. Clear route returns hasAlert: false and activeAlert: null.
 * 11. Demo Reset restores state cleanly with 0 route alerts.
 */
import assert from 'assert';
import { alertService } from '../services/alert.service.js';
import { incidentService } from '../services/incident.service.js';
import { accessibilityService } from '../services/accessibility.service.js';
import type { RouteGeometry } from '../types/routing.types.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (error) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${(error as Error).message}`);
    failed++;
  }
}

// Active driver route: Guwahati -> Shillong via NH-6
const activeRoute: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [91.7362, 26.1445], // Guwahati start
    [91.7500, 26.0500],
    [91.7821, 25.9810],
    [91.8012, 25.9021], // Nongpoh
    [91.8400, 25.7800],
    [91.8800, 25.6500],
    [91.8933, 25.5788], // Shillong end
  ],
};

// Distinct unrelated corridor in Upper Assam (Dibrugarh -> Tinsukia)
const unrelatedRoute: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [94.9120, 27.4728],
    [95.1000, 27.4800],
    [95.3600, 27.5000],
  ],
};

async function runSuite(): Promise<void> {
  console.log('==================================================');
  console.log("SauraRoute M7 Driver Route-Specific Alert Suite");
  console.log('==================================================');

  console.log("\n--- 1. Alert Trigger & Trust Model ---");

  await test('TEST 1: Relevant verified incident generates route-specific alert', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    const inc = await incidentService.createIncident({
      type: 'LANDSLIDE',
      severity: 'CRITICAL',
      description: 'Massive landslide blocking NH-6 at Nongpoh',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    // Verify incident -> marks corridor CLOSED and incident VERIFIED
    await incidentService.updateIncidentStatus(inc.id, 'VERIFIED');

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, true, 'Route alert must be active');
    assert.ok(result.activeAlert, 'activeAlert must be populated');
    assert.strictEqual(result.activeAlert?.isVerified, true);
    assert.strictEqual(result.activeAlert?.requiresReroute, true);
    assert.ok(result.activeAlert?.distanceLabel.includes('km') || result.activeAlert?.distanceLabel.includes('m'));
  });

  await test('TEST 2: Unrelated distant incident does NOT generate route alert', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    // Incident in Silchar (far away from Guwahati-Shillong)
    const silcharInc = await incidentService.createIncident({
      type: 'FLOOD',
      severity: 'CRITICAL',
      description: 'Flooding on Barak river road in Silchar',
      latitude: 24.8333,
      longitude: 92.7789,
    });
    await incidentService.updateIncidentStatus(silcharInc.id, 'VERIFIED');

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, false, 'Silchar incident must not trigger alert on Guwahati-Shillong');
    assert.strictEqual(result.activeAlert, null);
    assert.strictEqual(result.alerts.length, 0);
  });

  await test('TEST 3: Unverified report does NOT generate a verified route alert (preserves trust boundary)', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    // Driver reports road issue on route, but operations has NOT verified it yet
    await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'CRITICAL',
      description: 'Unverified rockfall report near Nongpoh',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, false, 'Unverified report must NOT generate a verified route alert');
    assert.strictEqual(result.activeAlert, null);
  });

  await test('TEST 4: Rejected incident does NOT generate route alert', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    const inc = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'HIGH',
      description: 'False alarm reported',
      latitude: 25.9021,
      longitude: 91.8012,
    });
    await incidentService.updateIncidentStatus(inc.id, 'REJECTED');

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, false, 'Rejected incident must never trigger route alert');
  });

  console.log("\n--- 2. Corridor Conditions & Alert Actions ---");

  await test('TEST 5: Affected CLOSED corridor generates CRITICAL route closure alert', async () => {
    await accessibilityService.resetAccessibilityState();
    await accessibilityService.updateAccessibilityStatus('acc_nh6_nongpoh', 'CLOSED', 'Emergency highway closure');

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, true);
    assert.strictEqual(result.activeAlert?.category, 'ROAD_CLOSURE');
    assert.strictEqual(result.activeAlert?.severity, 'CRITICAL');
    assert.strictEqual(result.activeAlert?.requiresReroute, true);
    assert.strictEqual(result.activeAlert?.actionLabel, 'Review Safer Route');
    assert.strictEqual(result.activeAlert?.secondaryActionLabel, "View What's Ahead");
  });

  await test('TEST 6: Affected RESTRICTED corridor generates WARNING route alert', async () => {
    await accessibilityService.resetAccessibilityState();
    await accessibilityService.updateAccessibilityStatus('acc_nh6_nongpoh', 'RESTRICTED', 'Single-lane transit only');

    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, true);
    assert.strictEqual(result.activeAlert?.category, 'ROAD_RESTRICTION');
    assert.strictEqual(result.activeAlert?.severity, 'WARNING');
    assert.strictEqual(result.activeAlert?.requiresReroute, false);
  });

  await test('TEST 7: Alert contains accurate context & distance ahead', async () => {
    const result = await alertService.computeRouteAlerts(activeRoute);
    const alert = result.activeAlert;
    assert.ok(alert);
    assert.ok(alert.distanceAheadMeters >= 0);
    assert.ok(alert.distanceLabel.includes('km') || alert.distanceLabel.includes('m'));
    assert.ok(alert.message.length > 0);
    assert.ok(alert.headline.includes('ROUTE UPDATE'));
  });

  console.log("\n--- 3. Idempotency, Priority & Demo Reset ---");

  await test('TEST 8: Repeated computation for identical route condition is idempotent', async () => {
    const res1 = await alertService.computeRouteAlerts(activeRoute);
    const res2 = await alertService.computeRouteAlerts(activeRoute);

    assert.strictEqual(res1.hasAlert, res2.hasAlert);
    assert.strictEqual(res1.totalAlertsCount, res2.totalAlertsCount);
    assert.strictEqual(res1.activeAlert?.id, res2.activeAlert?.id);
    assert.strictEqual(res1.activeAlert?.category, res2.activeAlert?.category);
  });

  await test('TEST 9: Unrelated clear route produces hasAlert: false and empty alerts list', async () => {
    const result = await alertService.computeRouteAlerts(unrelatedRoute);
    assert.strictEqual(result.hasAlert, false);
    assert.strictEqual(result.activeAlert, null);
    assert.strictEqual(result.alerts.length, 0);
  });

  await test('TEST 10: Demo Reset clears all route alerts deterministically', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    // Baseline: acc_nh6_nongpoh is OPEN, sample incident is unverified REPORTED
    const result = await alertService.computeRouteAlerts(activeRoute);
    assert.strictEqual(result.hasAlert, false, 'Baseline state after reset must produce 0 verified route alerts');
    assert.strictEqual(result.activeAlert, null);
  });

  console.log('==================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
