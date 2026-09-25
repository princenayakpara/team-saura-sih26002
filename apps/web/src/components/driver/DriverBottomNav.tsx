import type { IconName } from '../common/Icon';
import { Icon } from '../common/Icon';

export type DriverTab = 'navigate' | 'ahead' | 'route' | 'safety' | 'alerts' | 'more';

interface DriverBottomNavProps {
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  alertCount: number;
}

const TABS: { key: DriverTab; label: string; icon: IconName }[] = [
  { key: 'navigate', label: 'Navigate', icon: 'compass' },
  { key: 'ahead', label: 'Ahead', icon: 'mountain' },
  { key: 'route', label: 'Route', icon: 'route' },
  { key: 'safety', label: 'Safety', icon: 'shield' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'more', label: 'More', icon: 'terminal' },
];

export default function DriverBottomNav({ activeTab, onTabChange, alertCount }: DriverBottomNavProps) {
  return (
    <nav className="driver-bottom-nav" aria-label="Driver Mode Navigation">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`driver-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
          aria-current={activeTab === tab.key ? 'page' : undefined}
        >
          <span className="driver-nav-icon">
            <Icon name={tab.icon} size={18} />
          </span>
          <span className="driver-nav-label">{tab.label}</span>
          {tab.key === 'alerts' && alertCount > 0 && (
            <span className="driver-nav-badge">{alertCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}