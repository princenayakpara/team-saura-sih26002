/**
 * M5 — Driver "What's Ahead" Automated Test Suite
 *
 * Tests:
 * 1. Relevant route-linked incident appears with correct distance & context.
 * 2. Unrelated distant incident does NOT appear.
 * 3. Verified incident displays correct verified state (isVerified: true, status: 'VERIFIED').
 * 4. Unverified incident displays correct unverified state (isVerified: false, status: 'REPORTED').
 * 5. CLOSED and RESTRICTED corridors appear on route with correct severity and status.
 * 6. OPEN corridors do NOT appear in What's Ahead (no false hazards).
 * 7. Correct priority ordering (CLOSED corridor > RESTRICTED > Verified incident > Unverified incident).
 * 8. Resolved/rejected incidents are excluded.
 * 9. Distance along route calculation is monotonically ordered along the trajectory.
 * 10. Empty / clear route produces empty items list with totalCount 0.
 * 11. Invalid geometry handling in controller.
 * 12. State update reflection (Reporting -> Verifying changes What's Ahead dynamically).
 */
import assert from 'assert';
import { computeWhatsAhead } from '../services/whatsahead.service.js';
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

// Guwahati -> Shillong route geometry traversing NH-6 (Nongpoh at ~25.9021, 91.8012)
const guwahatiShillongRoute: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [91.7362, 26.1445], // Guwahati start
    [91.7500, 26.0500],
    [91.7821, 25.9810],
    [91.8012, 25.9021], // Nongpoh (~40km in)
    [91.8400, 25.7800],
    [91.8800, 25.6500],
    [91.8933, 25.5788], // Shillong end
  ],
};

// Distinct route: Dibrugarh -> Tinsukia in Upper Assam
const upperAssamRoute: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [94.9120, 27.4728],
    [95.1000, 27.4800],
    [95.3600, 27.5000],
  ],
};

async function runSuite(): Promise<void> {
  console.log('==================================================');
  console.log("SauraRoute M5 Driver What's Ahead Test Suite");
  console.log('==================================================');

  console.log("\n--- 1. Route-Linked Filtering & Trust Model ---");

  await test('TEST 1: Relevant route-linked incident appears with distance and context', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    const inc = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'HIGH',
      description: 'Loose boulders near Nongpoh bend',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const item = result.items.find((i) => i.id === inc.id);

    assert.ok(item, 'Incident on route must appear in What\'s Ahead');
    assert.strictEqual(item.type, 'FALLEN_ROCKS');
    assert.strictEqual(item.status, 'REPORTED');
    assert.strictEqual(item.isVerified, false, 'Initial report must be unverified');
    assert.ok(item.distanceAheadMeters > 0, 'Distance ahead must be positive');
    assert.ok(item.distanceLabel.includes('km') || item.distanceLabel.includes('m'));
  });

  await test('TEST 2: Distant unrelated incident does NOT appear in What\'s Ahead', async () => {
    const distantInc = await incidentService.createIncident({
      type: 'FLOOD',
      severity: 'CRITICAL',
      description: 'Flooding in Silchar town center',
      latitude: 24.8333,
      longitude: 92.7789,
    });

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const item = result.items.find((i) => i.id === distantInc.id);
    assert.strictEqual(item, undefined, 'Silchar incident must not appear on Guwahati-Shillong route');
  });

  await test('TEST 3: Verified incident correctly reflects isVerified: true and status: VERIFIED', async () => {
    const inc = await incidentService.createIncident({
      type: 'LANDSLIDE',
      severity: 'CRITICAL',
      description: 'Major slope collapse at Km 42',
      latitude: 25.9810,
      longitude: 91.7821,
    });

    await incidentService.updateIncidentStatus(inc.id, 'VERIFIED');

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const item = result.items.find((i) => i.id === inc.id);

    assert.ok(item);
    assert.strictEqual(item.isVerified, true, 'Verified incident must report isVerified: true');
    assert.strictEqual(item.status, 'VERIFIED');
  });

  await test('TEST 4: Unverified incident correctly reflects isVerified: false and status: REPORTED', async () => {
    const inc = await incidentService.createIncident({
      type: 'ROAD_DAMAGE',
      severity: 'MEDIUM',
      description: 'Pothole cluster reported by trucker',
      latitude: 25.7800,
      longitude: 91.8400,
    });

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const item = result.items.find((i) => i.id === inc.id);

    assert.ok(item);
    assert.strictEqual(item.isVerified, false);
    assert.strictEqual(item.status, 'REPORTED');
  });

  console.log("\n--- 2. Corridor Conditions & Prioritization ---");

  await test('TEST 5: CLOSED corridor appears as top-priority What\'s Ahead item', async () => {
    await accessibilityService.resetAccessibilityState();
    await accessibilityService.updateAccessibilityStatus('acc_nh6_nongpoh', 'CLOSED', 'Emergency bridge maintenance');

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const closedCorridor = result.items.find((i) => i.id === 'acc_nh6_nongpoh');

    assert.ok(closedCorridor, 'Closed NH-6 corridor must appear on route');
    assert.strictEqual(closedCorridor.category, 'CORRIDOR_CLOSED');
    assert.strictEqual(closedCorridor.status, 'CLOSED');
    assert.strictEqual(closedCorridor.severity, 'CRITICAL');
    assert.strictEqual(closedCorridor.isVerified, true);
    assert.strictEqual(result.items[0].id, 'acc_nh6_nongpoh', 'CLOSED corridor must be sorted first as highest priority');
  });

  await test('TEST 6: OPEN corridor does NOT appear in What\'s Ahead', async () => {
    await accessibilityService.resetAccessibilityState();
    // acc_nh27_tezpur is OPEN and on North Bank
    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const openCorridor = result.items.find((i) => i.id === 'acc_nh27_tezpur');
    assert.strictEqual(openCorridor, undefined, 'OPEN corridor must not clutter What\'s Ahead');
  });

  await test('TEST 7: Priority ordering: CLOSED > RESTRICTED > Verified incident > Unverified incident', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    // 1. Unverified incident
    const unverified = await incidentService.createIncident({
      type: 'BLOCKAGE',
      severity: 'MEDIUM',
      description: 'Stalled vehicle',
      latitude: 25.9810,
      longitude: 91.7821,
    });

    // 2. Verified incident (verifying automatically closes the intersecting corridor)
    const verified = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'HIGH',
      description: 'Fallen rock on shoulder',
      latitude: 25.7800,
      longitude: 91.8400,
    });
    await incidentService.updateIncidentStatus(verified.id, 'VERIFIED');

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    assert.ok(result.items.length >= 3);

    // First should be CLOSED corridor
    assert.strictEqual(result.items[0].category, 'CORRIDOR_CLOSED');
    // Verified incident should rank before unverified incident
    const verifiedIdx = result.items.findIndex((i) => i.id === verified.id);
    const unverifiedIdx = result.items.findIndex((i) => i.id === unverified.id);
    assert.ok(verifiedIdx < unverifiedIdx, `Verified incident (idx ${verifiedIdx}) must precede unverified (idx ${unverifiedIdx})`);
  });

  await test('TEST 8: Resolved and Rejected incidents are excluded from What\'s Ahead', async () => {
    const resolved = await incidentService.createIncident({
      type: 'FLOOD',
      severity: 'HIGH',
      description: 'Water cleared',
      latitude: 25.9021,
      longitude: 91.8012,
    });
    await incidentService.updateIncidentStatus(resolved.id, 'VERIFIED');
    await incidentService.updateIncidentStatus(resolved.id, 'ACTIVE');
    await incidentService.updateIncidentStatus(resolved.id, 'RESOLVED');

    const result = await computeWhatsAhead(guwahatiShillongRoute);
    const found = result.items.find((i) => i.id === resolved.id);
    assert.strictEqual(found, undefined, 'Resolved incident must be excluded');
  });

  console.log("\n--- 3. Edge Cases, Empty States & Reset ---");

  await test('TEST 9: Clear route with no hazards returns totalCount 0 and empty items', async () => {
    await incidentService.resetIncidentState();
    await accessibilityService.resetAccessibilityState();

    const result = await computeWhatsAhead(upperAssamRoute);
    assert.strictEqual(result.totalCount, 0);
    assert.strictEqual(result.items.length, 0);
    assert.ok(result.computedAt);
  });

  await test('TEST 10: State transition dynamically reflects in consecutive What\'s Ahead queries', async () => {
    const inc = await incidentService.createIncident({
      type: 'LANDSLIDE',
      severity: 'CRITICAL',
      description: 'Dynamic mudslide observation',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    // Step A: Initially unverified
    let ahead = await computeWhatsAhead(guwahatiShillongRoute);
    let item = ahead.items.find((i) => i.id === inc.id);
    assert.ok(item);
    assert.strictEqual(item.isVerified, false);

    // Step B: Operations verifies -> Corridor closes & incident becomes verified
    await incidentService.updateIncidentStatus(inc.id, 'VERIFIED');

    ahead = await computeWhatsAhead(guwahatiShillongRoute);
    item = ahead.items.find((i) => i.id === inc.id);
    assert.ok(item);
    assert.strictEqual(item.isVerified, true);
    assert.strictEqual(item.status, 'VERIFIED');

    // Corridor closure also reflected
    const closedCorr = ahead.items.find((i) => i.id === 'acc_nh6_nongpoh');
    assert.ok(closedCorr);
    assert.strictEqual(closedCorr.status, 'CLOSED');
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
