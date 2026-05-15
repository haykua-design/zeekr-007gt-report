/**
 * Leaflet entry point: import map primitives from here, not from `react-leaflet`.
 *
 * This module exists for two invisible-but-required Vite quirks:
 *   1. Leaflet's CSS must be loaded for the tile/overlay panes to size correctly.
 *   2. Leaflet's default marker icons reference paths that Vite doesn't resolve;
 *      we re-point them at bundled image URLs so <Marker> works in production.
 *
 * Beyond that, this module is a thin pass-through to `react-leaflet`. Pages
 * compose `<MapContainer>`, `<TileLayer>`, `<Marker>` etc. directly — no
 * opinionated wrappers, no custom DSL.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

(L.Icon.Default.prototype.options as Record<string, string>).iconUrl = markerIconUrl;
(L.Icon.Default.prototype.options as Record<string, string>).iconRetinaUrl = markerIconRetinaUrl;
(L.Icon.Default.prototype.options as Record<string, string>).shadowUrl = markerShadowUrl;
L.Icon.Default.imagePath = '';

/**
 * Convenience tile-server URL/attribution pairs. Spread into <TileLayer {...TILES.cartoLight} />.
 * Pasting your own URL is also fine.
 */
export const TILES = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  cartoLight: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  cartoDark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
} as const;

export {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  CircleMarker,
  Polygon,
  Polyline,
  GeoJSON,
  LayersControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';

export type {
  MapContainerProps,
  MarkerProps,
  PopupProps,
  TooltipProps,
  CircleMarkerProps,
  GeoJSONProps,
} from 'react-leaflet';
