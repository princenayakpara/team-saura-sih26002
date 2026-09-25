import { useTranslation } from 'react-i18next';
import type { RoutingPreference } from '../types/api';
import { PRESET_CORRIDORS } from '../config/map-theme';
import { Icon } from './common/Icon';

interface RoutePlannerProps {
  originInput: string;
  setOriginInput: (val: string) => void;
  destInput: string;
  setDestInput: (val: string) => void;
  preference: RoutingPreference;
  setPreference: (pref: RoutingPreference) => void;
  onCalculate: (customOrig?: string, customDest?: string) => void;
  isRouting: boolean;
}

export default function RoutePlanner({
  originInput,
  setOriginInput,
  destInput,
  setDestInput,
  preference,
  setPreference,
  onCalculate,
  isRouting,
}: RoutePlannerProps) {
  const { t } = useTranslation();

  const activePreset = PRESET_CORRIDORS.find(
    (p) => p.origin === originInput && p.destination === destInput
  );

  const handleApplyPreset = (preset: typeof PRESET_CORRIDORS[0]) => {
    setOriginInput(preset.origin);
    setDestInput(preset.destination);
    onCalculate(preset.origin, preset.destination);
  };

  return (
    <div className="intel-card">
      <div className="intel-card-header">
        <span className="intel-card-title">
          <Icon name="compass" size={15} style={{ color: 'var(--accent-action)' }} />
          <span>{t('route.planner')}</span>
        </span>
        {activePreset && (
          <span style={{ fontSize: 11, color: 'var(--accent-action)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {activePreset.highway}
          </span>
        )}
      </div>

      {/* Preset Corridor Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {PRESET_CORRIDORS.map((p) => {
          const isSelected = p.origin === originInput && p.destination === destInput;
          return (
            <button
              key={p.name}
              onClick={() => handleApplyPreset(p)}
              disabled={isRouting}
              className={`btn-preset ${isSelected ? 'active' : ''}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <Icon name="pin-start" size={13} style={{ color: 'var(--status-safe)' }} /> {t('route.originLabel')}
          </label>
          <input
            type="text"
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            placeholder="26.1445, 91.7362"
            disabled={isRouting}
            className="coord-input"
            aria-label={t('route.originLabel')}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <Icon name="pin-end" size={13} style={{ color: 'var(--status-critical)' }} /> {t('route.destLabel')}
          </label>
          <input
            type="text"
            value={destInput}
            onChange={(e) => setDestInput(e.target.value)}
            placeholder="25.5788, 91.8933"
            disabled={isRouting}
            className="coord-input"
            aria-label={t('route.destLabel')}
          />
        </div>
      </div>

      {/* Routing Preference Selector */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          {t('route.routingObjective')}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['FASTEST', 'BALANCED', 'SAFEST'] as RoutingPreference[]).map((mode) => {
            const isSelected = preference === mode;
            const label = mode === 'FASTEST' ? t('route.fastest') : mode === 'BALANCED' ? t('route.balanced') : t('route.safest');
            return (
              <button
                key={mode}
                onClick={() => setPreference(mode)}
                disabled={isRouting}
                style={{
                  flex: 1,
                  padding: '7px 6px',
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: 6,
                  cursor: isRouting ? 'not-allowed' : 'pointer',
                  border: `1px solid ${isSelected ? 'var(--accent-action)' : 'var(--border-subtle)'}`,
                  backgroundColor: isSelected ? 'var(--accent-action-bg)' : 'var(--bg-card-inset)',
                  color: isSelected ? 'var(--accent-action)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  transition: 'all 0.15s',
                }}
              >
                <Icon
                  name={mode === 'FASTEST' ? 'clock' : mode === 'BALANCED' ? 'scale' : 'shield'}
                  size={12}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={() => onCalculate()}
        disabled={isRouting}
        className="btn-primary"
        aria-busy={isRouting}
      >
        {isRouting ? (
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
            <span>{t('route.calculating')}</span>
          </>
        ) : (
          <span>{t('route.calculate')}</span>
        )}
      </button>
    </div>
  );
}
