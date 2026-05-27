import '@testing-library/jest-dom';

// Stub Leaflet — requires a real browser DOM with canvas
vi.mock('leaflet', () => ({ default: {} }));
vi.mock('react-leaflet', () => ({
  MapContainer:  ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer:     () => null,
  CircleMarker:  ({ children, eventHandlers }) => (
    <div onClick={eventHandlers?.click} data-testid="circle-marker">{children}</div>
  ),
  Popup:         ({ children }) => <div>{children}</div>,
  Tooltip:       ({ children }) => <div>{children}</div>,
  useMap:        () => ({ flyTo: vi.fn(), setView: vi.fn() }),
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
