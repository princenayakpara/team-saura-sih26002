import { useState } from 'react';
import type { IncidentFeatureCollection, IncidentFeature } from '../types/api';
import { Icon } from './common/Icon';
import type { IconName } from './common/Icon';

interface ObservationPanelProps {
  incidentsData: IncidentFeatureCollection;
  onIncidentUpdated: () => void;
  selectedIncidentId?: string | null;
  onSelectIncident?: (id: string | null) => void;
  onFocusCoordinates?: (coordinates: [number, number]) => void;
}

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'recently';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function getTypeIcon(type: string): IconName {
  switch (type) {
    case 'FALLEN_ROCKS':
      return 'mountain';
    case 'LANDSLIDE':
      return 'mountain';
    case 'FLOOD':
      return 'cloud-rain';
    case 'ACCIDENT':
      return 'truck';
    case 'BLOCKAGE':
    case 'ROAD_DAMAGE':
      return 'barrier';
    default:
      return 'alert-triangle';
  }
}

function formatTypeLabel(type: string): string {
  switch (type) {
    case 'FALLEN_ROCKS':
      return 'Fallen Rocks / Debris';
    case 'LANDSLIDE':
      return 'Landslide / Mudslide';
    case 'FLOOD':
      return 'Flash Flooding';
    case 'ROAD_DAMAGE':
      return 'Road Surface Damage';
    case 'ACCIDENT':
      return 'Vehicle Accident';
    case 'BLOCKAGE':
      return 'Corridor Blockage';
    default:
      return type;
  }
}

export default function ObservationPanel({
  incidentsData,
  onIncidentUpdated,
  selectedIncidentId,
  onSelectIncident,
  onFocusCoordinates,
}: ObservationPanelProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'UNVERIFIED' | 'VERIFIED'>('ALL');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeId = selectedIncidentId !== undefined ? selectedIncidentId : internalSelectedId;
  const setActiveId = (id: string | null) => {
    if (onSelectIncident) {
      onSelectIncident(id);
    } else {
      setInternalSelectedId(id);
    }
    setActionError(null);
  };

  const incidents = incidentsData.features || [];
  const unverifiedCount = incidents.filter((f) => f.properties.status === 'REPORTED').length;
  const verifiedCount = incidents.filter((f) => f.properties.status === 'VERIFIED' || f.properties.status === 'ACTIVE').length;

  const filteredIncidents = incidents.filter((f) => {
    if (filter === 'UNVERIFIED') return f.properties.status === 'REPORTED';
    if (filter === 'VERIFIED') return f.properties.status === 'VERIFIED' || f.properties.status === 'ACTIVE';
    return true;
  });

  const selectedFeature = incidents.find((f) => f.properties.id === activeId) || null;

  const handleUpdateStatus = async (incidentId: string, newStatus: 'VERIFIED' | 'REJECTED' | 'RESOLVED') => {
    setIsUpdating(true);
    setActionError(null);

    try {
      const res = await fetch(`http://localhost:3000/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to update status to ${newStatus}`);
      }

      // Notify parent to refresh telemetry immediately
      onIncidentUpdated();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to update incident status.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="intel-card" aria-label="Road Observations & Incident Verification Panel">
      {/* Header */}
      <div className="intel-card-header">
        <span className="intel-card-title">
          <Icon name="shield" size={15} color="var(--color-accent-amber)" />
          <span>Road Observations &amp; Verification</span>
        </span>
        {unverifiedCount > 0 && (
          <span
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {unverifiedCount} UNVERIFIED
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          padding: 3,
          borderRadius: 6,
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: filter === 'ALL' ? 700 : 500,
            borderRadius: 4,
            border: 'none',
            backgroundColor: filter === 'ALL' ? 'rgba(51, 65, 85, 0.8)' : 'transparent',
            color: filter === 'ALL' ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          All ({incidents.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNVERIFIED')}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: filter === 'UNVERIFIED' ? 700 : 500,
            borderRadius: 4,
            border: 'none',
            backgroundColor: filter === 'UNVERIFIED' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: filter === 'UNVERIFIED' ? '#FCD34D' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          Unverified ({unverifiedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('VERIFIED')}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: filter === 'VERIFIED' ? 700 : 500,
            borderRadius: 4,
            border: 'none',
            backgroundColor: filter === 'VERIFIED' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: filter === 'VERIFIED' ? '#6EE7B7' : '#94A3B8',
            cursor: 'pointer',
          }}
        >
          Verified ({verifiedCount})
        </button>
      </div>

      {/* Selected Incident Detail / Verification Drawer */}
      {selectedFeature ? (
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span
                  style={{
                    backgroundColor:
                      selectedFeature.properties.severity === 'CRITICAL'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : selectedFeature.properties.severity === 'HIGH'
                        ? 'rgba(249, 115, 22, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color:
                      selectedFeature.properties.severity === 'CRITICAL'
                        ? '#EF4444'
                        : selectedFeature.properties.severity === 'HIGH'
                        ? '#F97316'
                        : '#F59E0B',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {selectedFeature.properties.severity}
                </span>
                <span
                  style={{
                    backgroundColor:
                      selectedFeature.properties.status === 'REPORTED'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color: selectedFeature.properties.status === 'REPORTED' ? '#F59E0B' : '#10B981',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {selectedFeature.properties.status === 'REPORTED' ? 'UNVERIFIED REPORT' : 'VERIFIED INCIDENT'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>
                {formatTypeLabel(selectedFeature.properties.type)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: 16,
                cursor: 'pointer',
                padding: 2,
              }}
              title="Close details"
            >
              ✕
            </button>
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 12,
              color: '#CBD5E1',
              lineHeight: 1.4,
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              padding: '6px 8px',
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            {selectedFeature.properties.description}
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 6,
              fontSize: 10,
              color: '#94A3B8',
              marginBottom: 8,
            }}
          >
            <div>
              ID: <span style={{ fontFamily: 'var(--font-mono)', color: '#CBD5E1' }}>{selectedFeature.properties.id}</span>
            </div>
            <div>
              Reported: <span style={{ color: '#CBD5E1' }}>{formatTimeAgo(selectedFeature.properties.createdAt)}</span>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                Coordinates: <span style={{ fontFamily: 'var(--font-mono)', color: '#CBD5E1' }}>
                  {selectedFeature.geometry.coordinates[1].toFixed(4)}, {selectedFeature.geometry.coordinates[0].toFixed(4)}
                </span>
              </span>
              {onFocusCoordinates && (
                <button
                  type="button"
                  onClick={() => onFocusCoordinates(selectedFeature.geometry.coordinates)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #38BDF8',
                    color: '#38BDF8',
                    borderRadius: 3,
                    padding: '1px 5px',
                    fontSize: 9,
                    cursor: 'pointer',
                  }}
                >
                  View on Map
                </button>
              )}
            </div>
          </div>

          {/* Photo Evidence Preview if attached */}
          {selectedFeature.properties.photoUrl && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                ATTACHED EVIDENCE PHOTO:
              </div>
              <div
                style={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid #334155',
                  maxHeight: 140,
                  backgroundColor: '#020617',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={`http://localhost:3000${selectedFeature.properties.photoUrl}`}
                  alt="Incident evidence"
                  style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Trust notice */}
          <div
            style={{
              backgroundColor:
                selectedFeature.properties.status === 'REPORTED'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(16, 185, 129, 0.08)',
              border:
                selectedFeature.properties.status === 'REPORTED'
                  ? '1px solid rgba(245, 158, 11, 0.25)'
                  : '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 10,
              color: selectedFeature.properties.status === 'REPORTED' ? '#FCD34D' : '#6EE7B7',
              marginBottom: 10,
              lineHeight: 1.4,
            }}
          >
            {selectedFeature.properties.status === 'REPORTED' ? (
              <span>
                <strong>Reported ≠ Verified:</strong> This road observation was logged by a driver and requires explicit Operations Center verification.
              </span>
            ) : (
              <span>
                <strong>Verified by Operations:</strong> This hazard is confirmed. (Does not guarantee permanent road safety).
              </span>
            )}
          </div>

          {/* Error display */}
          {actionError && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 10,
                color: '#FCA5A5',
                marginBottom: 8,
              }}
            >
              {actionError}
            </div>
          )}

          {/* Action Buttons */}
          {selectedFeature.properties.status === 'REPORTED' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedFeature.properties.id, 'REJECTED')}
                disabled={isUpdating}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #475569',
                  borderRadius: 4,
                  color: '#94A3B8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Dismiss / Reject
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedFeature.properties.id, 'VERIFIED')}
                disabled={isUpdating}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '7px 12px',
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {isUpdating ? 'UPDATING...' : '✓ VERIFY OBSERVATION'}
              </button>
            </div>
          ) : selectedFeature.properties.status === 'VERIFIED' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 4,
                  color: '#10B981',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                ✓ VERIFIED BY OPERATOR
              </div>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedFeature.properties.id, 'REJECTED')}
                disabled={isUpdating}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: 4,
                  color: '#94A3B8',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* List of Incidents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {filteredIncidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 8px', color: '#94A3B8', fontSize: 11 }}>
            No {filter !== 'ALL' ? filter.toLowerCase() : ''} road observations reported.
          </div>
        ) : (
          filteredIncidents.map((f: IncidentFeature) => {
            const isSelected = f.properties.id === activeId;
            const isUnverified = f.properties.status === 'REPORTED';
            return (
              <div
                key={f.properties.id}
                onClick={() => setActiveId(f.properties.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: isSelected ? '1.5px solid #38BDF8' : '1px solid #334155',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon
                      name={getTypeIcon(f.properties.type)}
                      size={13}
                      color={
                        f.properties.severity === 'CRITICAL'
                          ? '#EF4444'
                          : f.properties.severity === 'HIGH'
                          ? '#F97316'
                          : '#F59E0B'
                      }
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC' }}>
                      {formatTypeLabel(f.properties.type)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      backgroundColor: isUnverified ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isUnverified ? '#F59E0B' : '#10B981',
                    }}
                  >
                    {isUnverified ? 'UNVERIFIED' : 'VERIFIED'}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: '#CBD5E1',
                    lineHeight: 1.3,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.properties.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8' }}>
                  <span>📍 {f.geometry.coordinates[1].toFixed(4)}, {f.geometry.coordinates[0].toFixed(4)}</span>
                  <span>{formatTimeAgo(f.properties.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
