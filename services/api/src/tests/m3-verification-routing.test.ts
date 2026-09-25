/**
 * M3 Integration Specification Suite
 *
 * Tests the complete chain:
 * Driver report (UNVERIFIED) -> Operations verification (VERIFIED)
 * -> Affected corridor status transition (OPEN -> CLOSED)
 * -> Route re-evaluation and closed candidate pruning
 * -> Viable alternative selection under 1.35x detour constraint
 * -> Driver update and idempotency
 */
import assert from 'assert';
import { incidentService } from '../services/incident.service.js';
import { accessibilityService } from '../services/accessibility.service.js';
import { routingService } from '../services/routing.service.js';
import type { CandidateRouteProfile, RouteResponse } from '../types/routing.types.js';

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

// Helpers to create candidate profiles for testing
function mockCandidate(
  id: string,
  distanceMeters: number,
  durationSeconds: number,
  meanRisk: number,
  coordinates: [number, number][],
  isBaseline = false
): CandidateRouteProfile {
  return {
    candidateId: id,
    name: isBaseline ? 'Baseline Highway Route (Fastest)' : `Alternative Route ${id}`,
    isBaseline,
    distanceMeters,
    durationSeconds,
    geometry: { type: 'LineString', coordinates },
    instructions: [],
    risk: {
      overallLevel: meanRisk >= 75 ? 'CRITICAL' : meanRisk >= 50 ? 'HIGH' : meanRisk >= 25 ? 'MEDIUM' : 'LOW',
      meanScore: meanRisk,
      maxScore: meanRisk + 5,
      dominantTrigger: 'Slope / Incidents',
      hazardousSegmentCount: meanRisk >= 50 ? 2 : 0,
      factors: { rainfall: 10, slope: 20, incidents: meanRisk, historical: 10 },
      waypoints: [],
    },
    optimizationMetrics: {
      distanceDetourRatio: 1.0,
      durationDetourRatio: 1.0,
      travelCost: 100,
      hazardCost: meanRisk,
      compositeScore: 100 + meanRisk,
      isViableDetour: true,
    },
  };
}

async function runM3Tests(): Promise<void> {
  console.log('==================================================');
  console.log('SauraRoute M3 Incident-Accessibility-Routing Suite');
  console.log('==================================================\n');

  // Reset baseline state before test suite
  await accessibilityService.resetAccessibilityState();
  await incidentService.resetIncidentState();

  console.log('--- 1. Verification Trigger & Trust Boundary (M2 -> M3) ---');

  await test('TEST 1: REPORTED (unverified) incident does NOT close corridor', async () => {
    await accessibilityService.resetAccessibilityState();
    const inc = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'CRITICAL',
      description: 'Unverified rockfall report near Nongpoh',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    assert.strictEqual(inc.status, 'REPORTED');
    const corridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.ok(corridor);
    assert.strictEqual(corridor.status, 'OPEN', 'Corridor must remain OPEN for UNVERIFIED report');
  });

  await test('TEST 2: REJECTED incident does NOT close corridor', async () => {
    await accessibilityService.resetAccessibilityState();
    const inc = await incidentService.createIncident({
      type: 'LANDSLIDE',
      severity: 'HIGH',
      description: 'False alarm report',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    await incidentService.updateIncidentStatus(inc.id, 'REJECTED');
    const corridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.ok(corridor);
    assert.strictEqual(corridor.status, 'OPEN', 'Corridor must remain OPEN for REJECTED report');
  });

  await test('TEST 3: VERIFIED relevant incident changes affected corridor from OPEN to CLOSED', async () => {
    await accessibilityService.resetAccessibilityState();
    const inc = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'CRITICAL',
      description: 'Large boulder blocking GS Road at Nongpoh',
      latitude: 25.9021,
      longitude: 91.8012,
    });

    const updatedInc = await incidentService.updateIncidentStatus(inc.id, 'VERIFIED');
    assert.ok(updatedInc);
    assert.strictEqual(updatedInc.status, 'VERIFIED');

    const corridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.ok(corridor);
    assert.strictEqual(corridor.status, 'CLOSED', 'Corridor must transition to CLOSED on verification');
    assert.ok(corridor.reason?.includes('FALLEN_ROCKS'), 'Reason must include incident type');
  });

  await test('TEST 4: Verified incident on unrelated location does NOT close unrelated corridors', async () => {
    await accessibilityService.resetAccessibilityState();
    // Far away coordinate in upper Assam / Arunachal border
    const inc = await incidentService.createIncident({
      type: 'FLOOD',
      severity: 'HIGH',
      description: 'Waterlogging in remote area far from NH-6',
      latitude: 27.5000,
      longitude: 95.5000,
    });

    await incidentService.updateIncidentStatus(inc.id, 'VERIFIED');
    const nh6 = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.ok(nh6);
    assert.strictEqual(nh6.status, 'OPEN', 'Unrelated NH-6 corridor must stay OPEN');
  });

  console.log('\n--- 2. Route Evaluation & 1.35x Detour Constraint ---');

  await test('TEST 5: Closed route is rejected during route evaluation', async () => {
    // Corridor acc_nh6_nongpoh is CLOSED
    await accessibilityService.resetAccessibilityState();
    await accessibilityService.updateAccessibilityStatus('acc_nh6_nongpoh', 'CLOSED', 'Rockfall');

    // Candidate 1 passes through Nongpoh [91.8012, 25.9021]
    const candidates = [
      mockCandidate('c1', 100_000, 7200, 20, [[91.7500, 26.0500], [91.8012, 25.9021], [91.8800, 25.6500]], true),
      mockCandidate('c2', 120_000, 8500, 15, [[91.7500, 26.0500], [92.1000, 25.9000], [91.8800, 25.6500]], false),
    ];

    const annotated = await routingService.evaluateAccessibility(candidates);
    assert.strictEqual(annotated[0].accessibility?.status, 'CLOSED');
    assert.strictEqual(annotated[0].accessibility?.isEligible, false, 'Candidate intersecting closed corridor is ineligible');
    assert.strictEqual(annotated[1].accessibility?.isEligible, true, 'Bypass candidate is eligible');
  });

  await test('TEST 6: Alternative route is selected when primary route is closed', async () => {
    await accessibilityService.resetAccessibilityState();
    await accessibilityService.updateAccessibilityStatus('acc_nh6_nongpoh', 'CLOSED', 'Rockfall');

    const primaryClosed = mockCandidate('c1_closed', 100_000, 7200, 10, [[91.7500, 26.0500], [91.8012, 25.9021], [91.8800, 25.6500]], true);
    const alternativeOpen = mockCandidate('c2_bypass', 120_000, 8400, 20, [[91.7500, 26.0500], [92.1000, 25.9000], [91.8800, 25.6500]], false);

    const annotated = await routingService.evaluateAccessibility([primaryClosed, alternativeOpen]);
    const eligible = (routingService as any).eligibleAccessibilityCandidates(annotated);
    assert.strictEqual(eligible.length, 1);
    assert.strictEqual(eligible[0].candidateId, 'c2_bypass', 'Alternative bypass route is selected');
  });

  await test('TEST 7: Alternative route is rejected if distance ratio > 1.35', async () => {
    const baseline = mockCandidate('c1', 100_000, 5000, 50, [[91.7, 26.1], [91.8, 25.6]], true);
    // 140km vs 100km -> distance ratio = 1.40 > 1.35
    const excessiveDistance = mockCandidate('c2_long', 140_000, 5500, 10, [[91.7, 26.1], [92.2, 25.9], [91.8, 25.6]], false);

    const result = routingService.optimizeCandidateProfiles([baseline, excessiveDistance], 'SAFEST');
    assert.strictEqual(result.selectedRoute.candidateId, 'c1', 'Cannot select candidate exceeding 1.35x distance detour');
  });

  await test('TEST 8: Alternative route is rejected if duration ratio > 1.35', async () => {
    const baseline = mockCandidate('c1', 100_000, 5000, 50, [[91.7, 26.1], [91.8, 25.6]], true);
    // 7500s vs 5000s -> duration ratio = 1.50 > 1.35
    const excessiveDuration = mockCandidate('c2_slow', 110_000, 7500, 10, [[91.7, 26.1], [92.0, 25.9], [91.8, 25.6]], false);

    const result = routingService.optimizeCandidateProfiles([baseline, excessiveDuration], 'SAFEST');
    assert.strictEqual(result.selectedRoute.candidateId, 'c1', 'Cannot select candidate exceeding 1.35x duration detour');
  });

  await test('TEST 9: Alternative route is accepted when both distance and duration ratios <= 1.35', async () => {
    const baseline = mockCandidate('c1', 100_000, 5000, 70, [[91.7, 26.1], [91.8, 25.6]], true);
    // 120km (1.20x) and 6000s (1.20x) -> both <= 1.35
    const viableAlternative = mockCandidate('c2_viable', 120_000, 6000, 15, [[91.7, 26.1], [91.9, 25.8], [91.8, 25.6]], false);

    const result = routingService.optimizeCandidateProfiles([baseline, viableAlternative], 'SAFEST');
    assert.strictEqual(result.selectedRoute.candidateId, 'c2_viable', 'Selects viable alternative within 1.35x bounds');
  });

  console.log('\n--- 3. End-to-End Reevaluation, Idempotency & Reset ---');

  await test('TEST 10: Complete verification -> corridor closure -> reroute re-evaluation chain', async () => {
    // 1. Initial State: corridor is OPEN
    await accessibilityService.resetAccessibilityState();
    const initialCorridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.strictEqual(initialCorridor?.status, 'OPEN');

    // 2. Driver submits hazard observation
    const obs = await incidentService.createIncident({
      type: 'FALLEN_ROCKS',
      severity: 'CRITICAL',
      description: 'Major rockfall blocking NH-6 at Nongpoh',
      latitude: 25.9021,
      longitude: 91.8012,
    });
    assert.strictEqual(obs.status, 'REPORTED');

    // 3. Operator verifies observation
    await incidentService.updateIncidentStatus(obs.id, 'VERIFIED');

    // 4. Corridor is now CLOSED
    const closedCorridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.strictEqual(closedCorridor?.status, 'CLOSED');

    // 5. Reroute evaluation recommends detour
    const currentRoute = mockCandidate('c1_active', 100_000, 7200, 60, [[91.7500, 26.0500], [91.8012, 25.9021], [91.8800, 25.6500]], true);
    const alternative = mockCandidate('c2_alt', 118_000, 8100, 15, [[91.7500, 26.0500], [92.0500, 25.8500], [91.8800, 25.6500]], false);

    currentRoute.accessibility = { status: 'CLOSED', isEligible: false, affectedCorridors: [closedCorridor!] };
    alternative.accessibility = { status: 'ACCESSIBLE', isEligible: true, affectedCorridors: [] };

    const reroute = routingService.evaluateReroute(currentRoute, [currentRoute, alternative]);
    assert.strictEqual(reroute.rerouteRecommended, true, 'Reroute must be recommended when current route is CLOSED');
  });

  await test('TEST 11: Idempotency - repeated processing of verified incident is safe and consistent', async () => {
    const corridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.strictEqual(corridor?.status, 'CLOSED');

    // Re-trigger verification logic
    const dummyIncident = {
      id: 'inc_sample_001',
      type: 'FALLEN_ROCKS',
      description: 'Rockfall on NH-40',
      latitude: 25.9021,
      longitude: 91.8012,
      status: 'VERIFIED',
    };

    const reResult = await accessibilityService.handleIncidentVerification(dummyIncident);
    const corridorAfter = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.strictEqual(corridorAfter?.status, 'CLOSED', 'Corridor must remain consistently CLOSED');
  });

  await test('TEST 12: Demo reset restores baseline state cleanly', async () => {
    await accessibilityService.resetAccessibilityState();
    await incidentService.resetIncidentState();

    const corridor = await accessibilityService.getAccessibilityById('acc_nh6_nongpoh');
    assert.strictEqual(corridor?.status, 'OPEN', 'Corridor must reset to OPEN');

    const incidents = await incidentService.listIncidents();
    const sample = incidents.features.find((f) => f.properties.id === 'inc_sample_001');
    assert.ok(sample);
    assert.strictEqual(sample.properties.status, 'REPORTED', 'Sample incident must reset to REPORTED (unverified)');
  });

  console.log('==================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runM3Tests();
