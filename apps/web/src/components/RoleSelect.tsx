import { useTranslation } from 'react-i18next';
import { Icon } from './common/Icon';

interface RoleSelectProps {
  onSelectMode: (mode: 'driver' | 'operations') => void;
}

export default function RoleSelect({ onSelectMode }: RoleSelectProps) {
  const { t } = useTranslation();

  return (
    <div className="role-select-backdrop" role="dialog" aria-modal="true" aria-labelledby="role-select-title">
      <div className="role-select-card">
        <div className="role-select-header">
          <div className="brand-badge" style={{ marginBottom: 12 }}>
            <div className="brand-icon" aria-hidden="true">
              SR
            </div>
            <div>
              <div className="brand-title">SauraRoute</div>
              <div className="brand-subtitle">{t('header.subtitle')}</div>
            </div>
          </div>
          <h2 id="role-select-title" className="role-select-title">
            {t('role.chooseExperience')}
          </h2>
          <p className="role-select-subtitle">
            {t('role.chooseSubtitle')}
          </p>
        </div>

        <div className="role-select-options">
          {/* Driver Mode Choice */}
          <button
            type="button"
            className="role-option-btn role-option-driver"
            onClick={() => onSelectMode('driver')}
            aria-label={t('role.driverName')}
          >
            <div className="role-option-icon" aria-hidden="true">
              <Icon name="truck" size={26} color="var(--color-accent-amber)" />
            </div>
            <div className="role-option-content">
              <div className="role-option-headline">
                <span className="role-option-name">{t('role.driverName')}</span>
                <span className="role-option-badge">{t('role.driverBadge')}</span>
              </div>
              <p className="role-option-desc">
                {t('role.driverFullDesc')}
              </p>
            </div>
            <span className="role-option-arrow" aria-hidden="true">
              →
            </span>
          </button>

          {/* Operations Command Center Choice */}
          <button
            type="button"
            className="role-option-btn role-option-operations"
            onClick={() => onSelectMode('operations')}
            aria-label={t('role.operationsName')}
          >
            <div className="role-option-icon" aria-hidden="true">
              <Icon name="terminal" size={26} color="var(--color-accent-amber)" />
            </div>
            <div className="role-option-content">
              <div className="role-option-headline">
                <span className="role-option-name">{t('role.operationsName')}</span>
                <span className="role-option-badge role-badge-ops">{t('role.operationsBadge')}</span>
              </div>
              <p className="role-option-desc">
                {t('role.operationsFullDesc')}
              </p>
            </div>
            <span className="role-option-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>

        <div className="role-select-footer">
          <span>{t('role.footer')}</span>
        </div>
      </div>
    </div>
  );
}
