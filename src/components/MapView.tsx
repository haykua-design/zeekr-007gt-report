import { useEffect, useMemo } from 'react';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  TILES,
  useMap,
} from '@/lib/map';

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
  /** Optional metric for radius scaling. If omitted, all points get the same radius. */
  value?: number;
};

export type MapViewProps = {
  points: MapPoint[];
  /** Optional polylines (e.g. routes, supply chains). Each is a list of [lat,lng]. */
  paths?: LatLngExpression[][];
  /** Visual theme — picks the matching CARTO tile set and a default marker color. */
  theme?: 'light' | 'dark';
  /** Min/max marker radius in px when `value` is provided on points. */
  radiusRange?: [number, number];
  /** Override marker color (defaults to a theme-appropriate accent). */
  color?: string;
  /** Wrapper className — must include an explicit height (e.g. `h-[420px]`). */
  className?: string;
  /** Padding around the fitted bounds, in px. */
  padding?: number;
};

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

function scaleRadius(value: number, min: number, max: number, lo: number, hi: number) {
  if (max === min) return (lo + hi) / 2;
  const t = (value - min) / (max - min);
  return lo + t * (hi - lo);
}

/**
 * One-import map for the common case: drop N points on a real basemap, fit the
 * view to the data, no pan/zoom. Reach for `<MapContainer>` from `@/lib/map`
 * directly only when this component genuinely doesn't fit (custom GeoJSON
 * layers, complex interaction, etc.).
 */
export function MapView({
  points,
  paths,
  theme = 'light',
  radiusRange = [6, 18],
  color,
  className = 'w-full h-[420px] rounded-xl overflow-hidden',
  padding: _padding = 24,
}: MapViewProps) {
  const tile = theme === 'dark' ? TILES.cartoDark : TILES.cartoLight;
  const fillColor = color ?? (theme === 'dark' ? '#60a5fa' : '#2563eb');

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const pts: LatLngExpression[] = points.map(p => [p.lat, p.lng] as LatLngExpression);
    for (const path of paths ?? []) pts.push(...path);
    return pts.length ? (pts as LatLngBoundsExpression) : null;
  }, [points, paths]);

  const [vMin, vMax] = useMemo(() => {
    const vals = points.map(p => p.value).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return [0, 0];
    return [Math.min(...vals), Math.max(...vals)];
  }, [points]);

  const [rLo, rHi] = radiusRange;

  return (
    <div className={className}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
        touchZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <TileLayer {...tile} />
        <FitBounds bounds={bounds} />
        {(paths ?? []).map((path, i) => (
          <Polyline
            key={`path-${i}`}
            positions={path}
            pathOptions={{ color: fillColor, weight: 2, opacity: 0.7 }}
          />
        ))}
        {points.map((p, i) => {
          const radius =
            typeof p.value === 'number' ? scaleRadius(p.value, vMin, vMax, rLo, rHi) : rLo + 2;
          return (
            <CircleMarker
              key={`pt-${i}-${p.lat}-${p.lng}`}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{ color: fillColor, fillColor, fillOpacity: 0.55, weight: 1.5 }}
            >
              {p.label ? <Tooltip direction="top">{p.label}</Tooltip> : null}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
