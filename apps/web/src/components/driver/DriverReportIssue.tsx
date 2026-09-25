import { useState, useEffect } from 'react';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

interface DriverReportIssueProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  currentCoordinates?: { latitude: number; longitude: number } | null;
  vehicleCode?: string;
}

interface IssueTypeOption {
  id: string;
  label: string;
  icon: IconName;
  defaultSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  quickDesc: string;
}

const ISSUE_TYPES: IssueTypeOption[] = [
  {
    id: 'LANDSLIDE',
    label: 'Landslide / Mudslide',
    icon: 'alert-triangle',
    defaultSeverity: 'HIGH',
    quickDesc: 'Mud and soil displacement across road corridor',
  },
  {
    id: 'FALLEN_ROCKS',
    label: 'Fallen Rocks / Boulders',
    icon: 'mountain',
    defaultSeverity: 'CRITICAL',
    quickDesc: 'Large rocks and debris blocking roadway',
  },
  {
    id: 'ROAD_DAMAGE',
    label: 'Damaged Road / Cave-in',
    icon: 'barrier',
    defaultSeverity: 'HIGH',
    quickDesc: 'Severe pavement damage or road edge collapse',
  },
  {
    id: 'FLOOD',
    label: 'Flooding / Waterlogging',
    icon: 'cloud-rain',
    defaultSeverity: 'HIGH',
    quickDesc: 'Water flowing over highway, reduced traction',
  },
  {
    id: 'ACCIDENT',
    label: 'Vehicle Accident',
    icon: 'truck',
    defaultSeverity: 'MEDIUM',
    quickDesc: 'Collision obstructing traffic flow',
  },
  {
    id: 'BLOCKAGE',
    label: 'Fallen Tree / Blockage',
    icon: 'barrier',
    defaultSeverity: 'MEDIUM',
    quickDesc: 'Fallen tree or obstruction blocking passage',
  },
];

const QUICK_PHRASES = [
  'Boulders blocking southbound lane',
  'Active mudslide on hillside',
  'Water over road, pass with extreme care',
  'Single lane passable, heavy debris',
  'Complete highway blockage',
];

export default function DriverReportIssue({
  isOpen,
  onClose,
  onSubmitted,
  currentCoordinates,
  vehicleCode = 'SAURA-002',
}: DriverReportIssueProps) {
  const [selectedType, setSelectedType] = useState<string>('FALLEN_ROCKS');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL');
  const [description, setDescription] = useState<string>('Large boulders and rockfall on highway corridor');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(() => ({
    latitude: currentCoordinates?.latitude ?? 25.9021,
    longitude: currentCoordinates?.longitude ?? 91.8012,
  }));
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedIncident, setSubmittedIncident] = useState<{
    id: string;
    type: string;
    severity: string;
    status: string;
    created_at: string;
  } | null>(null);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleSelectType = (item: IssueTypeOption) => {
    setSelectedType(item.id);
    setSeverity(item.defaultSeverity);
    if (!description || QUICK_PHRASES.includes(description) || description.includes('corridor')) {
      setDescription(item.quickDesc);
    }
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setSubmitError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: parseFloat(pos.coords.latitude.toFixed(4)),
          longitude: parseFloat(pos.coords.longitude.toFixed(4)),
        });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setSubmitError(`GPS lookup failed: ${err.message}. Using route coordinates.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setSubmitError('Please provide a description of the road issue.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('type', selectedType);
        formData.append('severity', severity);
        formData.append('description', description.trim());
        formData.append('latitude', String(coords.latitude));
        formData.append('longitude', String(coords.longitude));
        formData.append('file', selectedFile);

        res = await fetch('http://localhost:3000/api/incidents', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('http://localhost:3000/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedType,
            severity,
            description: description.trim(),
            latitude: coords.latitude,
            longitude: coords.longitude,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Submission failed with status ${res.status}`);
      }

      setSubmittedIncident(json.data);
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (err) {
      setSubmitError((err as Error).message || 'Failed to submit road observation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="role-select-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-issue-title"
      style={{ zIndex: 10000, overflowY: 'auto', padding: '16px 12px' }}
    >
      <div
        className="role-select-card"
        style={{
          maxWidth: 540,
          width: '100%',
          backgroundColor: '#0F172A',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 20px 40px rgba(0,0,0,0.75)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                Driver Road Observation
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                Vehicle: {vehicleCode}
              </span>
            </div>
            <h2 id="report-issue-title" style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
              Report Road Hazard / Issue
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: 20,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Success Confirmation View */}
        {submittedIncident ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10B981',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                fontSize: 24,
              }}
            >
              ✓
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F8FAFC', marginBottom: 6 }}>
              Road Observation Submitted
            </h3>
            <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5, marginBottom: 16 }}>
              Your report has been logged and transmitted to the Operations Command Center for corroboration.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                textAlign: 'left',
                marginBottom: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Report ID:</span>
                <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {submittedIncident.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Initial Status:</span>
                <span
                  style={{
                    color: '#F59E0B',
                    fontWeight: 700,
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {submittedIncident.status} (UNVERIFIED)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Type &amp; Severity:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
                  {submittedIncident.severity} {submittedIncident.type}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Location:</span>
                <span style={{ color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
                  {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Trust notice */}
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 11,
                color: '#FCD34D',
                textAlign: 'left',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="shield" size={16} color="#F59E0B" />
              <span>
                <strong>Trust Policy:</strong> Reported ≠ Verified. This observation remains unverified until verified by Operations.
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{ width: '100%', minHeight: 42 }}
            >
              Return to Navigation
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Trust Banner */}
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                color: '#FCD34D',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="shield" size={14} color="#F59E0B" />
              <span>
                <strong>Reported ≠ Verified:</strong> All driver observations enter as <em>UNVERIFIED</em>.
              </span>
            </div>

            {/* 1. Issue Type Selection */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                1. Select Hazard / Issue Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {ISSUE_TYPES.map((item) => {
                  const isSelected = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectType(item)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: isSelected ? '1.5px solid #38BDF8' : '1px solid #334155',
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                        color: isSelected ? '#FFFFFF' : '#CBD5E1',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon name={item.icon} size={15} color={isSelected ? '#38BDF8' : '#94A3B8'} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Severity Level */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                2. Assessed Severity
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((lvl) => {
                  const isSelected = severity === lvl;
                  const color =
                    lvl === 'CRITICAL' ? '#EF4444' : lvl === 'HIGH' ? '#F97316' : lvl === 'MEDIUM' ? '#F59E0B' : '#3B82F6';
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverity(lvl)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 6,
                        border: isSelected ? `1.5px solid ${color}` : '1px solid #334155',
                        backgroundColor: isSelected ? `${color}22` : 'rgba(30, 41, 59, 0.6)',
                        color: isSelected ? color : '#94A3B8',
                        fontSize: 10,
                        fontWeight: 700,
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Location Capture */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  3. Incident Coordinates
                </label>
                <button
                  type="button"
                  onClick={handleUseGPS}
                  disabled={isLocating}
                  style={{
                    background: 'transparent',
                    border: '1px solid #38BDF8',
                    color: '#38BDF8',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: isLocating ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="pin-start" size={11} color="#38BDF8" />
                  <span>{isLocating ? 'Locating...' : 'Use Live GPS'}</span>
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: '#F8FAFC',
                }}
              >
                <span style={{ color: '#10B981', fontSize: 11 }}>● GPS</span>
                <span>Lat: {coords.latitude.toFixed(4)}, Lon: {coords.longitude.toFixed(4)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94A3B8' }}>
                  NH-6 Corridor
                </span>
              </div>
            </div>

            {/* 4. Description & Quick Phrases */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                4. Description / Situation Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe road blockage, size of rockfall, lane obstruction..."
                rows={2}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: '#F8FAFC',
                  resize: 'none',
                  fontFamily: 'inherit',
                  marginBottom: 6,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {QUICK_PHRASES.slice(0, 3).map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setDescription(phrase)}
                    style={{
                      background: 'rgba(51, 65, 85, 0.6)',
                      border: '1px solid #475569',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    + {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Optional Photo/Evidence Upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                5. Photo Evidence (Optional)
              </label>
              {previewUrl ? (
                <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid #334155', maxHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
                  <img src={previewUrl} alt="Evidence preview" style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }} />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: 'rgba(239, 68, 68, 0.9)',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    border: '1px dashed #475569',
                    borderRadius: 6,
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    color: '#94A3B8',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name="camera" size={16} color="#94A3B8" />
                  <span>Attach Hazard Photo / Camera Capture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {/* Error Banner */}
            {submitError && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: '#FCA5A5',
                  marginBottom: 14,
                }}
              >
                {submitError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  color: '#CBD5E1',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#EF4444',
                  borderColor: '#EF4444',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#FFFFFF',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>TRANSMITTING REPORT...</span>
                  </>
                ) : (
                  <>
                    <Icon name="alert-triangle" size={14} color="#FFFFFF" />
                    <span>SUBMIT ROAD OBSERVATION</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
