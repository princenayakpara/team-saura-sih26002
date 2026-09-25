import type { FC, SVGProps } from 'react';

export type IconName =
  | 'compass'
  | 'map'
  | 'shield'
  | 'truck'
  | 'terminal'
  | 'barrier'
  | 'alert-triangle'
  | 'cloud-rain'
  | 'mountain'
  | 'landslide'
  | 'clock'
  | 'scale'
  | 'reroute'
  | 'pin-start'
  | 'pin-end'
  | 'check'
  | 'bell'
  | 'route'
  | 'turn-straight'
  | 'turn-right'
  | 'turn-left'
  | 'turn-slight-right'
  | 'turn-slight-left'
  | 'turn-sharp-right'
  | 'turn-sharp-left'
  | 'u-turn'
  | 'cross'
  | 'target'
  | 'info'
  | 'refresh'
  | 'bulb'
  | 'camera';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  className?: string;
}

export const Icon: FC<IconProps> = ({
  name,
  size = 16,
  className = '',
  style,
  ...rest
}) => {
  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `saura-icon ${className}`.trim(),
    style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    ...rest,
  };

  switch (name) {
    case 'compass':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );

    case 'map':
      return (
        <svg {...commonProps}>
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      );

    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );

    case 'truck':
      return (
        <svg {...commonProps}>
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );

    case 'terminal':
      return (
        <svg {...commonProps}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <polyline points="7 8 10 10 7 12" />
          <line x1="12" y1="12" x2="16" y2="12" />
        </svg>
      );

    case 'barrier':
      return (
        <svg {...commonProps}>
          <rect x="2" y="6" width="20" height="9" rx="1" />
          <line x1="6" y1="6" x2="11" y2="15" />
          <line x1="13" y1="6" x2="18" y2="15" />
          <line x1="5" y1="15" x2="5" y2="20" />
          <line x1="19" y1="15" x2="19" y2="20" />
        </svg>
      );

    case 'alert-triangle':
      return (
        <svg {...commonProps}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );

    case 'cloud-rain':
      return (
        <svg {...commonProps}>
          <line x1="16" y1="13" x2="16" y2="21" />
          <line x1="8" y1="13" x2="8" y2="21" />
          <line x1="12" y1="15" x2="12" y2="23" />
          <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
      );

    case 'mountain':
      return (
        <svg {...commonProps}>
          <path d="M8 3l4 8 5-5 5 15H2L8 3z" />
        </svg>
      );

    case 'landslide':
      return (
        <svg {...commonProps}>
          <path d="M2 20h20" />
          <path d="M5 20l7-14 4 6 2-3 4 11" />
          <circle cx="15" cy="14" r="1.5" fill="currentColor" />
          <circle cx="18" cy="17" r="1" fill="currentColor" />
        </svg>
      );

    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );

    case 'scale':
      return (
        <svg {...commonProps}>
          <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
          <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h18" />
        </svg>
      );

    case 'reroute':
      return (
        <svg {...commonProps}>
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <polyline points="12 2 15 5 12 8" />
        </svg>
      );

    case 'pin-start':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );

    case 'pin-end':
      return (
        <svg {...commonProps}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor" fillOpacity="0.2" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );

    case 'check':
      return (
        <svg {...commonProps}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );

    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );

    case 'route':
      return (
        <svg {...commonProps}>
          <circle cx="6" cy="19" r="3" />
          <circle cx="18" cy="5" r="3" />
          <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12" />
        </svg>
      );

    case 'turn-straight':
      return (
        <svg {...commonProps}>
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      );

    case 'turn-right':
      return (
        <svg {...commonProps}>
          <path d="M6 19v-7a4 4 0 0 1 4-4h8" />
          <polyline points="14 4 18 8 14 12" />
        </svg>
      );

    case 'turn-left':
      return (
        <svg {...commonProps}>
          <path d="M18 19v-7a4 4 0 0 0-4-4H6" />
          <polyline points="10 4 6 8 10 12" />
        </svg>
      );

    case 'turn-slight-right':
      return (
        <svg {...commonProps}>
          <path d="M8 19l6-10h4" />
          <polyline points="14 5 18 9 14 13" />
        </svg>
      );

    case 'turn-slight-left':
      return (
        <svg {...commonProps}>
          <path d="M16 19l-6-10H6" />
          <polyline points="10 5 6 9 10 13" />
        </svg>
      );

    case 'turn-sharp-right':
      return (
        <svg {...commonProps}>
          <path d="M7 19v-9l9 4" />
          <polyline points="12 10 16 14 11 17" />
        </svg>
      );

    case 'turn-sharp-left':
      return (
        <svg {...commonProps}>
          <path d="M17 19v-9l-9 4" />
          <polyline points="12 10 8 14 13 17" />
        </svg>
      );

    case 'u-turn':
      return (
        <svg {...commonProps}>
          <path d="M18 20V9a6 6 0 0 0-12 0v11" />
          <polyline points="10 16 6 20 2 16" />
        </svg>
      );

    case 'cross':
      return (
        <svg {...commonProps}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );

    case 'target':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );

    case 'info':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );

    case 'refresh':
      return (
        <svg {...commonProps}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      );

    case 'bulb':
      return (
        <svg {...commonProps}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
        </svg>
      );

    case 'camera':
      return (
        <svg {...commonProps}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );

    default:
      return null;
  }
};
