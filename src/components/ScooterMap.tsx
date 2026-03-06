import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Navigation, X, Loader2, AlertTriangle } from "lucide-react";

// Fix default marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ANTWERP_CENTER: [number, number] = [51.2194, 4.4025];
const ANTWERP_BOUNDS = { south: 51.15, north: 51.30, west: 4.30, east: 4.50 };

// Forbidden zones (pedestrian areas) - approximate polygons
const FORBIDDEN_ZONES: { name: string; coords: [number, number][] }[] = [
  {
    name: "Meir & winkelstraten",
    coords: [
      [51.2195, 4.4050], [51.2210, 4.4070], [51.2200, 4.4120],
      [51.2185, 4.4100], [51.2180, 4.4060],
    ],
  },
  {
    name: "Groenplaats & Grote Markt",
    coords: [
      [51.2190, 4.3990], [51.2200, 4.4010], [51.2195, 4.4040],
      [51.2185, 4.4030], [51.2183, 4.4000],
    ],
  },
];

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

const ScooterMap = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromResults, setFromResults] = useState<SearchResult[]>([]);
  const [toResults, setToResults] = useState<SearchResult[]>([]);
  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const [usingLocation, setUsingLocation] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: ANTWERP_CENTER,
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Draw forbidden zones
    FORBIDDEN_ZONES.forEach((zone) => {
      L.polygon(zone.coords, {
        color: "hsl(0, 72%, 55%)",
        fillColor: "hsl(0, 72%, 55%)",
        fillOpacity: 0.2,
        weight: 2,
        dashArray: "5, 5",
      })
        .addTo(map)
        .bindPopup(`<strong>🚫 ${zone.name}</strong><br/>Verboden voor scooters`);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Search locations using Nominatim
  const searchLocation = useCallback(async (query: string, field: "from" | "to") => {
    if (query.length < 3) {
      field === "from" ? setFromResults([]) : setToResults([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Antwerpen, Belgium"
        )}&limit=5&bounded=1&viewbox=${ANTWERP_BOUNDS.west},${ANTWERP_BOUNDS.north},${ANTWERP_BOUNDS.east},${ANTWERP_BOUNDS.south}`
      );
      const data: SearchResult[] = await res.json();
      field === "from" ? setFromResults(data) : setToResults(data);
    } catch {
      // Silently fail
    }
  }, []);

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const handleSearch = (query: string, field: "from" | "to") => {
    if (field === "from") setFromQuery(query);
    else setToQuery(query);

    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(query, field), 400);
  };

  const selectResult = (result: SearchResult, field: "from" | "to") => {
    const coord: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
    const shortName = result.display_name.split(",").slice(0, 2).join(",");

    if (field === "from") {
      setFromCoord(coord);
      setFromQuery(shortName);
      setFromResults([]);
    } else {
      setToCoord(coord);
      setToQuery(shortName);
      setToResults([]);
    }
    setActiveField(null);
  };

  // Use current location
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setUsingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setFromCoord(coord);
        setFromQuery("📍 Mijn locatie");
        setUsingLocation(false);
      },
      () => {
        setError("Locatie niet beschikbaar");
        setUsingLocation(false);
      }
    );
  };

  // Calculate route using OSRM bicycle profile
  const calculateRoute = useCallback(async () => {
    if (!fromCoord || !toCoord || !mapRef.current) return;

    setLoading(true);
    setError(null);
    setRouteInfo(null);

    // Clear previous route
    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
    }
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];

    try {
      // Use OSRM bike profile - avoids highways, uses cycling infrastructure
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/bike/${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}?overview=full&geometries=geojson&steps=true`
      );
      const data = await res.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        setError("Geen route gevonden. Probeer andere locaties.");
        setLoading(false);
        return;
      }

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );

      // Draw route
      routeLayerRef.current = L.polyline(coords, {
        color: "hsl(160, 60%, 45%)",
        weight: 5,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(mapRef.current);

      // Start marker (green)
      const startIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:hsl(160,60%,45%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: "",
      });
      const startMarker = L.marker(fromCoord, { icon: startIcon })
        .addTo(mapRef.current)
        .bindPopup("🛴 Start");
      markersRef.current.push(startMarker);

      // End marker (red)
      const endIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:hsl(0,72%,55%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: "",
      });
      const endMarker = L.marker(toCoord, { icon: endIcon })
        .addTo(mapRef.current)
        .bindPopup("📍 Bestemming");
      markersRef.current.push(endMarker);

      // Fit bounds
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60] });

      // Route info
      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.ceil(route.duration / 60);
      setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });
    } catch {
      setError("Fout bij het berekenen van de route. Probeer opnieuw.");
    }

    setLoading(false);
  }, [fromCoord, toCoord]);

  // Auto-calculate when both coords are set
  useEffect(() => {
    if (fromCoord && toCoord) calculateRoute();
  }, [fromCoord, toCoord, calculateRoute]);

  const clearRoute = () => {
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    setFromQuery("");
    setToQuery("");
    setFromCoord(null);
    setToCoord(null);
    setRouteInfo(null);
    setError(null);
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Search panel */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 z-[1000]">
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-sm text-foreground">🛴 Route plannen</span>
            {(fromCoord || toCoord) && (
              <button onClick={clearRoute} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* From input */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
              <input
                type="text"
                value={fromQuery}
                onChange={(e) => handleSearch(e.target.value, "from")}
                onFocus={() => setActiveField("from")}
                placeholder="Vertrekpunt..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
              <button
                onClick={useMyLocation}
                className="text-muted-foreground hover:text-primary flex-shrink-0"
                title="Gebruik mijn locatie"
              >
                {usingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </button>
            </div>
            {activeField === "from" && fromResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10">
                {fromResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectResult(r, "from")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors border-b border-border last:border-0"
                  >
                    {r.display_name.split(",").slice(0, 3).join(",")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* To input */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-destructive flex-shrink-0" />
              <input
                type="text"
                value={toQuery}
                onChange={(e) => handleSearch(e.target.value, "to")}
                onFocus={() => setActiveField("to")}
                placeholder="Bestemming..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
            {activeField === "to" && toResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10">
                {toResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectResult(r, "to")}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors border-b border-border last:border-0"
                  >
                    {r.display_name.split(",").slice(0, 3).join(",")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-primary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Route berekenen...
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Route info */}
          {routeInfo && (
            <div className="flex items-center gap-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div className="text-center">
                <div className="text-lg font-display font-bold text-primary">{routeInfo.distance}</div>
                <div className="text-xs text-muted-foreground">afstand</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-lg font-display font-bold text-primary">{routeInfo.duration}</div>
                <div className="text-xs text-muted-foreground">reistijd</div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Route via fietspaden & lokale wegen — geen snelwegen of voetgangerszones.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-1 rounded bg-primary" />
          <span className="text-foreground">Scooter route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border-2 border-destructive border-dashed bg-destructive/20" />
          <span className="text-foreground">Verboden zone</span>
        </div>
      </div>
    </div>
  );
};

export default ScooterMap;
