import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  RouteOptimizationResult,
  AlertRecord,
  RerouteEvaluationResult,
} from '../../types/api';
import type { LiveTripProgress } from '../../utils/eta';
import DriverHeader from './DriverHeader';
import DriverManeuverCard from './DriverManeuverCard';
import DriverNavigationCard from './DriverNavigationCard';
import DriverEtaBar from './DriverEtaBar';
import DriverSafetyBanner from './DriverSafetyBanner';
import DriverRouteSummary from './DriverRouteSummary';
import DriverSafetyStatus from './DriverSafetyStatus';
import DriverBottomNav from './DriverBottomNav';
import type { DriverTab } from './DriverBottomNav';
import DriverTripStart from './DriverTripStart';
import DriverReportIssue from './DriverReportIssue';
import DriverWhatsAhead from './DriverWhatsAhead';
import AlertsPanel from '../AlertsPanel';
import ReroutePanel from '../ReroutePanel';
import { Icon } from '../common/Icon';

interface DriverModeProps {
  optimization: RouteOptimizationResult | null;
  alerts: AlertRecord[];
  alertsUnavailable: boolean;
  isLive: boolean;
  isCheckingReroute: boolean;
  rerouteResult: RerouteEvaluationResult | null;
  rerouteError: string | null;
  onCheckReroute: () => void;
  onExit: () => void;
  onCalculate: (origin: string, dest: string, destLabel?: string) => Promise<void> | void;
  isRouting: boolean;
  routingError: string | null;
  destinationLabel?: string;
  onNewTrip?: () => void;
  liveProgress?: LiveTripProgress | null;
  onIncidentReported?: () => void;
}

export default function DriverMode({
  optimization,
  alerts,
  alertsUnavailable,
  isLive,
  isCheckingReroute,
  rerouteResult,
  rerouteError,
  onCheckReroute,
  onExit,
  onCalculate,
  isRouting,
  routingError,
  destinationLabel,
  onNewTrip,
  liveProgress,
  onIncidentReported,
}: DriverModeProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DriverTab>('navigate');
  const [isReportingIssue, setIsReportingIssue] = useState<boolean>(false);

  const showMapOverlay = Boolean(optimization) && activeTab === 'navigate';

  // Compute driver's active route corridor point for accurate geo-tagging
  const activeCorridorCoords = optimization?.selectedRoute?.geometry?.coordinates?.length
    ? {
        latitude:
          optimization.selectedRoute.geometry.coordinates[
            Math.floor(optimization.selectedRoute.geometry.coordinates.length * 0.45)
          ][1],
        longitude:
          optimization.selectedRoute.geometry.coordinates[
            Math.floor(optimization.selectedRoute.geometry.coordinates.length * 0.45)
          ][0],
      }
    : { latitude: 25.9021, longitude: 91.8012 };

  return (
    <div className="driver-shell">
      <DriverHeader isLive={isLive} onExit={onExit} />

      {showMapOverlay && optimization ? (
        <>
          <div className="driver-map-top">
            <DriverManeuverCard
              selectedRoute={optimization.selectedRoute}
              destination={optimization.destination}
              destinationLabel={destinationLabel}
            />
          </div>

          <div className="driver-map-bottom">
            {/* Quick-Action Report Road Issue Floating Prompt */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => setIsReportingIssue(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.92)',
                  color: '#FFFFFF',
                  border: '1px solid #EF4444',
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  letterSpacing: 0.3,
                }}
              >
                <Icon name="alert-triangle" size={13} color="#FFFFFF" />
                <span>Report Road Issue</span>
              </button>
            </div>

            <DriverSafetyBanner
              selectedRoute={optimization.selectedRoute}
              alerts={alerts}
              onViewAhead={() => setActiveTab('ahead')}
              onViewSafety={() => setActiveTab('safety')}
              onCheckReroute={onCheckReroute}
              canReroute={!isCheckingReroute}
              onReportIssue={() => setIsReportingIssue(true)}
            />
            <DriverEtaBar selectedRoute={optimization.selectedRoute} liveProgress={liveProgress} />
          </div>
        </>
      ) : (
        <div className="driver-sheet">
          {!optimization ? (
            <DriverTripStart
              onCalculate={onCalculate}
              isRouting={isRouting}
              routingError={routingError}
              onExit={onExit}
            />
          ) : activeTab === 'ahead' ? (
            <DriverWhatsAhead
              selectedRoute={optimization.selectedRoute}
              onCheckReroute={onCheckReroute}
              canReroute={!isCheckingReroute}
              onReportIssue={() => setIsReportingIssue(true)}
            />
          ) : activeTab === 'route' ? (
            <div className="driver-stack">
              <DriverRouteSummary
                selectedRoute={optimization.selectedRoute}
                preference={optimization.preference}
                strategy={optimization.optimization.strategy}
                liveProgress={liveProgress}
              />
              <DriverNavigationCard selectedRoute={optimization.selectedRoute} />
              {onNewTrip && (
                <button
                  type="button"
                  className="driver-empty-btn"
                  onClick={onNewTrip}
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid #334155',
                    minHeight: 44,
                  }}
                >
                  {t('driver.newTrip')}
                </button>
              )}
            </div>
          ) : activeTab === 'safety' ? (
            <div className="driver-stack">
              <DriverSafetyStatus
                selectedRoute={optimization.selectedRoute}
                safetyStatus={optimization.safetyIntelligence}
              />
              <div className="driver-card" style={{ padding: 12 }}>
                <button
                  type="button"
                  className="driver-empty-btn"
                  onClick={() => setIsReportingIssue(true)}
                  style={{
                    minHeight: 44,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1.5px solid #EF4444',
                    color: '#FCA5A5',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="alert-triangle" size={16} color="#EF4444" />
                  <span>Report Road Hazard / Issue</span>
                </button>
              </div>
              <ReroutePanel
                onCheckReroute={onCheckReroute}
                isChecking={isCheckingReroute}
                rerouteResult={rerouteResult}
                rerouteError={rerouteError}
                hasCalculatedRoute
                driverMode={true}
              />
            </div>
          ) : activeTab === 'alerts' ? (
            <div className="driver-stack">
              <AlertsPanel
                alerts={alerts}
                isUnavailable={alertsUnavailable}
                hasCalculatedRoute
                onRecalculateSaferRoute={onCheckReroute}
                driverMode={true}
              />
              <div className="driver-card" style={{ padding: 12 }}>
                <button
                  type="button"
                  className="driver-empty-btn"
                  onClick={() => setIsReportingIssue(true)}
                  style={{
                    minHeight: 44,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1.5px solid #EF4444',
                    color: '#FCA5A5',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="alert-triangle" size={16} color="#EF4444" />
                  <span>Report Unlisted Road Hazard</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="driver-stack">
              <div className="driver-card">
                <div className="driver-nav-header">
                  <span className="driver-nav-title">{t('driver.session')}</span>
                </div>
                <p className="driver-route-foot" style={{ marginBottom: 16 }}>
                  {t('driver.sessionDesc')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Report Road Issue Action in More Tab */}
                  <button
                    type="button"
                    className="driver-empty-btn"
                    onClick={() => setIsReportingIssue(true)}
                    style={{
                      minHeight: 46,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1.5px solid #EF4444',
                      color: '#FCA5A5',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="alert-triangle" size={16} color="#EF4444" />
                    <span>Report Road Hazard / Issue</span>
                  </button>

                  {onNewTrip && (
                    <button
                      type="button"
                      className="driver-empty-btn"
                      onClick={() => {
                        onNewTrip();
                        setActiveTab('navigate');
                      }}
                      style={{
                        minHeight: 46,
                        background: 'var(--color-accent-amber)',
                        color: 'var(--color-bg-deep)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Icon name="target" size={16} color="var(--color-bg-deep)" />
                      <span>{t('driver.newTrip')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="driver-empty-btn"
                    onClick={onExit}
                    style={{
                      minHeight: 46,
                      background: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="terminal" size={16} color="var(--color-text-muted)" />
                    <span>{t('driver.switchToOps')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driver Report Road Issue Modal */}
      <DriverReportIssue
        isOpen={isReportingIssue}
        onClose={() => setIsReportingIssue(false)}
        onSubmitted={() => {
          if (onIncidentReported) {
            onIncidentReported();
          }
        }}
        currentCoordinates={activeCorridorCoords}
        vehicleCode="SAURA-002"
      />

      <DriverBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={alerts.length}
      />
    </div>
  );
}