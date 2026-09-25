import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  SEVERITY_THEME,
  SELECTED_ROUTE_THEME,
  BASELINE_ROUTE_THEME,
  HAZARD_ZONE_THEME,
  ACCESSIBILITY_THEME,
} from '../config/map-theme';
import type {
  IncidentFeatureCollection,
  VehicleFeatureCollection,
  HazardZoneFeatureCollection,
  AccessibilityFeatureCollection,
  CandidateRouteProfile,
} from '../types/api';

const OSM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export interface MapHandle {
  flyToCorridor: (originCoord: [number, number], destCoord: [number, number]) => void;
  fitRouteBounds: (coords: [number, number][]) => void;
  updateRoutesOnMap: (selected: CandidateRouteProfile, baseline: CandidateRouteProfile) => void;
}

interface MapProps {
  incidentsData: IncidentFeatureCollection;
  vehiclesData: VehicleFeatureCollection;
  hazardZonesData: HazardZoneFeatureCollection;
  accessibilityData: AccessibilityFeatureCollection;
  showHazardZones: boolean;
  selectedRoute: CandidateRouteProfile | null;
  baselineRoute: CandidateRouteProfile | null;
  isDriverMode?: boolean;
}

export const MapComponent = forwardRef<MapHandle, MapProps>(function MapComponent(
  {
    incidentsData,
    vehiclesData,
    hazardZonesData,
    accessibilityData,
    showHazardZones,
    selectedRoute,
    baselineRoute,
    isDriverMode = false,
  },
  ref
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Latest telemetry snapshot, kept current by the sync effect near the bottom of
  // this component. setupLayers runs once (on the map's 'load' event) and seeds
  // each source from this ref. Reading the *latest* data here — rather than a
  // snapshot frozen at mount — ensures data that arrived during the style-loading
  // window is still used. This matters for hazard zones, which are fetched once
  // (no polling): if their fetch resolved before the style finished loading, the
  // data-update effect below would no-op and the source would otherwise stay empty.
  const latestDataRef = useRef({
    incidents: incidentsData,
    vehicles: vehiclesData,
    hazardZones: hazardZonesData,
    accessibility: accessibilityData,
  });

  const routeDataRef = useRef<{
    selected: CandidateRouteProfile | null;
    baseline: CandidateRouteProfile | null;
  }>({ selected: null, baseline: null });

  const getResponsivePadding = (driver: boolean) => {
    if (driver) {
      return { top: 150, bottom: 240, left: 40, right: 40 };
    }
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    if (width <= 820) {
      return { top: 70, bottom: 70, left: 30, right: 30 };
    }
    if (width <= 1024) {
      return { top: 80, bottom: 80, left: 360, right: 40 };
    }
    return { top: 90, bottom: 90, left: 410, right: 400 };
  };

  const raiseRouteLayers = (map: maplibregl.Map) => {
    const orderedLayers = [
      'baseline-route-casing',
      'baseline-route-line',
      'selected-route-casing',
      'selected-route-halo',
      'selected-route-line',
    ];
    orderedLayers.forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      map.moveLayer(layerId);
    });
  };

  const renderRouteData = (selected: CandidateRouteProfile, baseline: CandidateRouteProfile) => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    const selectedSrc = map.getSource('selected-route-source') as maplibregl.GeoJSONSource;
    if (selectedSrc) {
      selectedSrc.setData({
        type: 'Feature',
        geometry: selected.geometry,
        properties: {},
      });
    }

    const baselineSrc = map.getSource('baseline-route-source') as maplibregl.GeoJSONSource;
    if (baselineSrc) {
      baselineSrc.setData({
        type: 'Feature',
        geometry: baseline.geometry,
        properties: {},
      });
    }

    // Update Origin and Destination Markers
    const coords = selected.geometry.coordinates;
    if (coords.length > 1) {
      const start = coords[0];
      const end = coords[coords.length - 1];

      if (originMarkerRef.current) originMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();

      const originEl = document.createElement('div');
      originEl.innerHTML = `
        <div style="background: #2E8B57; color: #FFFFFF; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); border: 1.5px solid #FFFFFF; display: flex; align-items: center; gap: 5px; font-family: var(--font-sans);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="9"/></svg>
          <span>ORIGIN</span>
        </div>
      `;
      originMarkerRef.current = new maplibregl.Marker({ element: originEl })
        .setLngLat(start)
        .addTo(map);

      const destEl = document.createElement('div');
      destEl.innerHTML = `
        <div style="background: #D9383A; color: #FFFFFF; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); border: 1.5px solid #FFFFFF; display: flex; align-items: center; gap: 5px; font-family: var(--font-sans);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          <span>DESTINATION</span>
        </div>
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: destEl })
        .setLngLat(end)
        .addTo(map);
    }

    raiseRouteLayers(map);
  };

  useImperativeHandle(ref, () => ({
    flyToCorridor: (originCoord: [number, number], destCoord: [number, number]) => {
      if (!mapRef.current) return;
      const bounds = new maplibregl.LngLatBounds(originCoord, originCoord);
      bounds.extend(destCoord);
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 1200 });
    },
    fitRouteBounds: (coords: [number, number][]) => {
      if (!mapRef.current || coords.length === 0) return;
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      mapRef.current.fitBounds(bounds, { padding: getResponsivePadding(false), maxZoom: 14, duration: 1200 });
    },
    updateRoutesOnMap: (selected: CandidateRouteProfile, baseline: CandidateRouteProfile) => {
      renderRouteData(selected, baseline);
    },
  }));

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_RASTER_STYLE,
      center: [92.2, 26.0], // NER corridor center
      zoom: 7.4,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    const setupLayers = () => {
      if (!map.isStyleLoaded()) return;

      // 1a. Baseline Route Layer (Visually secondary)
      if (!map.getSource('baseline-route-source')) {
        map.addSource('baseline-route-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {},
          },
        });

        map.addLayer({
          id: 'baseline-route-casing',
          type: 'line',
          source: 'baseline-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': BASELINE_ROUTE_THEME.casingColor,
            'line-width': BASELINE_ROUTE_THEME.lineWidth + 2.5,
            'line-opacity': 0.7,
          },
        });

        map.addLayer({
          id: 'baseline-route-line',
          type: 'line',
          source: 'baseline-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': BASELINE_ROUTE_THEME.lineColor,
            'line-width': BASELINE_ROUTE_THEME.lineWidth,
            'line-opacity': BASELINE_ROUTE_THEME.lineOpacity,
            'line-dasharray': [2, 2],
          },
        });
      }

      // 1b. Selected/Optimized Route Layer (Dominant, high-contrast, halo glow)
      if (!map.getSource('selected-route-source')) {
        map.addSource('selected-route-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {},
          },
        });

        // Deep dark outer casing
        map.addLayer({
          id: 'selected-route-casing',
          type: 'line',
          source: 'selected-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': SELECTED_ROUTE_THEME.casingColor,
            'line-width': SELECTED_ROUTE_THEME.casingWidth,
            'line-opacity': 0.9,
          },
        });

        // Vibrant mid-glow halo
        map.addLayer({
          id: 'selected-route-halo',
          type: 'line',
          source: 'selected-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': SELECTED_ROUTE_THEME.haloColor,
            'line-width': SELECTED_ROUTE_THEME.haloWidth,
            'line-opacity': 0.95,
          },
        });

        // Vivid sky blue core
        map.addLayer({
          id: 'selected-route-line',
          type: 'line',
          source: 'selected-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': SELECTED_ROUTE_THEME.lineColor,
            'line-width': SELECTED_ROUTE_THEME.lineWidth,
            'line-opacity': SELECTED_ROUTE_THEME.lineOpacity,
          },
        });
      }

      // 2. Road Accessibility Layer
      if (!map.getSource('accessibility-source')) {
        map.addSource('accessibility-source', {
          type: 'geojson',
          data: latestDataRef.current.accessibility,
        });

        (Object.keys(ACCESSIBILITY_THEME) as Array<keyof typeof ACCESSIBILITY_THEME>).forEach((status) => {
          map.addLayer({
            id: `accessibility-${status.toLowerCase()}-line`,
            type: 'line',
            source: 'accessibility-source',
            filter: ['==', ['get', 'status'], status],
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': ACCESSIBILITY_THEME[status].color,
              'line-width': status === 'CLOSED' ? 7 : 5,
              'line-opacity': status === 'OPEN' ? 0.7 : 0.95,
              ...(status === 'RESTRICTED' ? { 'line-dasharray': [2, 1.5] } : {}),
            },
          });

          const layerId = `accessibility-${status.toLowerCase()}-line`;
          map.on('click', layerId, (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            const properties = feature.properties as Record<string, string | undefined>;
            const coordinates = (feature.geometry as { coordinates: [number, number][] }).coordinates;
            const anchor = coordinates[0];
            if (!anchor) return;
            new maplibregl.Popup({ offset: 12 })
              .setLngLat(anchor)
              .setHTML(`
                <div style="font-size: 12px; min-width: 220px;">
                  <div style="font-size: 11px; font-weight: 800; color: ${ACCESSIBILITY_THEME[status].color}; margin-bottom: 3px;">
                    HIGHWAY ${status} CORRIDOR
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #F8FAFC; margin-bottom: 4px;">
                    ${properties.name ?? 'Highway Corridor'}
                  </div>
                  <div style="font-size: 12px; color: #CBD5E1; margin-bottom: 4px;">
                    ${properties.reason ?? 'Active corridor status advisory'}
                  </div>
                  <div style="font-size: 10px; color: #94A3B8; border-top: 1px solid #334155; padding-top: 4px;">
                    Source: ${properties.source ?? 'Regional Transport Authority'}
                  </div>
                </div>
              `)
              .addTo(map);
          });
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        });
      }

      // 3. Historical Hazard Zones Layer
      if (!map.getSource('hazard-zones-source')) {
        map.addSource('hazard-zones-source', {
          type: 'geojson',
          data: latestDataRef.current.hazardZones,
        });

        map.addLayer({
          id: 'hazard-zones-circles',
          type: 'circle',
          source: 'hazard-zones-source',
          paint: {
            'circle-radius': HAZARD_ZONE_THEME.radius,
            'circle-color': HAZARD_ZONE_THEME.color,
            'circle-stroke-width': HAZARD_ZONE_THEME.strokeWidth,
            'circle-stroke-color': HAZARD_ZONE_THEME.strokeColor,
            'circle-opacity': 0.85,
          },
        });

        map.on('click', 'hazard-zones-circles', (e) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const props = f.properties;
          const geom = f.geometry as { type: string; coordinates: [number, number] };
          const coordinates = geom.coordinates.slice() as [number, number];

          new maplibregl.Popup({ offset: 12 })
            .setLngLat(coordinates)
            .setHTML(`
              <div style="font-size: 12px; min-width: 220px;">
                <div style="font-size: 11px; font-weight: 700; color: #E5983A; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 8 5-5 5 15H2L8 3z"/></svg>
                  <span>Historical Hazard Zone</span>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #F8FAFC; margin-bottom: 4px;">
                  ${props.name}
                </div>
                <div style="font-size: 12px; color: #CBD5E1; margin-bottom: 4px;">
                  ${props.description || 'Verified slope displacement & landslide zone'}
                </div>
                <div style="font-size: 10px; color: #94A3B8; border-top: 1px solid #334155; padding-top: 4px;">
                  State: <strong>${props.state}</strong> | Severity: <strong>${props.severity}</strong><br/>
                  Trigger: <strong>${props.triggerType || 'Precipitation / Slope'}</strong>
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'hazard-zones-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'hazard-zones-circles', () => { map.getCanvas().style.cursor = ''; });
      }

      // 4. Active Incidents Layer
      if (!map.getSource('incidents-source')) {
        map.addSource('incidents-source', {
          type: 'geojson',
          data: latestDataRef.current.incidents,
        });

        map.addLayer({
          id: 'incidents-circles',
          type: 'circle',
          source: 'incidents-source',
          paint: {
            'circle-radius': [
              'match',
              ['get', 'severity'],
              'CRITICAL', 12,
              'HIGH', 10,
              'MEDIUM', 8,
              'LOW', 7,
              7,
            ],
            'circle-color': [
              'match',
              ['get', 'severity'],
              'CRITICAL', SEVERITY_THEME.CRITICAL.color,
              'HIGH', SEVERITY_THEME.HIGH.color,
              'MEDIUM', SEVERITY_THEME.MEDIUM.color,
              'LOW', SEVERITY_THEME.LOW.color,
              '#6B7280',
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });

        map.on('click', 'incidents-circles', (e) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const props = f.properties;
          const geom = f.geometry as { type: string; coordinates: [number, number] };
          const coordinates = geom.coordinates.slice() as [number, number];

          new maplibregl.Popup({ offset: 12 })
            .setLngLat(coordinates)
            .setHTML(`
              <div style="font-size: 12px; min-width: 210px;">
                <div style="font-size: 11px; font-weight: 700; color: ${SEVERITY_THEME[props.severity]?.color || '#D9383A'}; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>${props.severity} ${props.type}</span>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #F8FAFC; margin-bottom: 4px;">
                  ${props.description}
                </div>
                ${props.photoUrl ? `<div style="margin-bottom: 6px; border-radius: 4px; overflow: hidden; max-height: 120px;"><img src="http://localhost:3000${props.photoUrl}" alt="Evidence" style="width: 100%; max-height: 120px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" /></div>` : ''}
                <div style="font-size: 10px; color: #94A3B8; border-top: 1px solid #334155; padding-top: 4px;">
                  Status: <strong>${props.status}</strong> | ID: <code>${props.id}</code>
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'incidents-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'incidents-circles', () => { map.getCanvas().style.cursor = ''; });
      }

      // 5. Vehicles Layer
      if (!map.getSource('vehicles-source')) {
        map.addSource('vehicles-source', {
          type: 'geojson',
          data: latestDataRef.current.vehicles,
        });

        map.addLayer({
          id: 'vehicles-circles',
          type: 'circle',
          source: 'vehicles-source',
          paint: {
            'circle-radius': 9,
            'circle-color': '#10B981',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF',
          },
        });

        map.on('click', 'vehicles-circles', (e) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const props = f.properties;
          const geom = f.geometry as { type: string; coordinates: [number, number] };
          const coordinates = geom.coordinates.slice() as [number, number];

          new maplibregl.Popup({ offset: 12 })
            .setLngLat(coordinates)
            .setHTML(`
              <div style="font-size: 12px; min-width: 190px;">
                <div style="font-size: 13px; font-weight: 700; color: #2E8B57; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <span>Vehicle ${props.vehicleCode}</span>
                </div>
                <div style="font-size: 12px; color: #CBD5E1; margin-bottom: 4px;">
                  Speed: <strong>${props.speed} km/h</strong> | Heading: <strong>${props.heading}°</strong><br/>
                  Status: <strong style="color: #2E8B57;">${props.status}</strong>
                </div>
                <div style="font-size: 10px; color: #94A3B8; border-top: 1px solid #334155; padding-top: 3px;">
                  Telemetry: ${new Date(props.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'vehicles-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'vehicles-circles', () => { map.getCanvas().style.cursor = ''; });
      }

      if (routeDataRef.current.selected && routeDataRef.current.baseline) {
        renderRouteData(routeDataRef.current.selected, routeDataRef.current.baseline);
      }
    };

    map.on('load', setupLayers);

    return () => {
      if (originMarkerRef.current) originMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Routes and Fit Bounds when route props or view mode change
  useEffect(() => {
    routeDataRef.current = { selected: selectedRoute, baseline: baselineRoute };
    if (!mapRef.current) return;
    mapRef.current.resize();
    if (selectedRoute && baselineRoute) {
      renderRouteData(selectedRoute, baselineRoute);
      const coords = selectedRoute.geometry.coordinates;
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        mapRef.current.fitBounds(bounds, {
          padding: getResponsivePadding(isDriverMode),
          maxZoom: 14,
          duration: 1200,
        });
      }
    }
  }, [selectedRoute, baselineRoute, isDriverMode]);

  // Update Hazard Layer Visibility
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const layer = mapRef.current.getLayer('hazard-zones-circles');
    if (layer) {
      mapRef.current.setLayoutProperty(
        'hazard-zones-circles',
        'visibility',
        showHazardZones ? 'visible' : 'none'
      );
    }
  }, [showHazardZones]);

  // Keep the latest-data ref current so setupLayers (which runs once on 'load')
  // always seeds sources from the freshest snapshot. Runs after every render.
  useEffect(() => {
    latestDataRef.current = {
      incidents: incidentsData,
      vehicles: vehiclesData,
      hazardZones: hazardZonesData,
      accessibility: accessibilityData,
    };
  });

  // Update Data Sources
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const incSrc = mapRef.current.getSource('incidents-source') as maplibregl.GeoJSONSource;
    if (incSrc) incSrc.setData(incidentsData);
  }, [incidentsData]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const vhSrc = mapRef.current.getSource('vehicles-source') as maplibregl.GeoJSONSource;
    if (vhSrc) vhSrc.setData(vehiclesData);
  }, [vehiclesData]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const hzSrc = mapRef.current.getSource('hazard-zones-source') as maplibregl.GeoJSONSource;
    if (hzSrc) hzSrc.setData(hazardZonesData);
  }, [hazardZonesData]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const accSrc = mapRef.current.getSource('accessibility-source') as maplibregl.GeoJSONSource;
    if (accSrc) accSrc.setData(accessibilityData);
  }, [accessibilityData]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />;
});

export default MapComponent;
