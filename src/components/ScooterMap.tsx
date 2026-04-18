import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search, Navigation, X, Loader2, AlertTriangle,
  ChevronRight, ChevronUp, ChevronDown, Play, Square,
  Crosshair, Volume2, VolumeX, User
} from "lucide-react";
import { Link } from "react-router-dom";

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
const ANTWERP_ZOOM = 13;
const ANTWERP_BOUNDS = L.latLngBounds(
  [51.12, 4.25], // SW
  [51.32, 4.55]  // NE
);

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  maneuver: { type: string; modifier?: string };
  coord: [number, number];
}

const getManeuverIcon = (type: string, modifier?: string) => {
  if (type === "depart") return "🛴";
  if (type === "arrive") return "📍";
  if (type === "turn" || type === "end of road" || type === "new name") {
    if (modifier?.includes("left")) return "⬅️";
    if (modifier?.includes("right")) return "➡️";
    return "⬆️";
  }
  if (type === "roundabout" || type === "rotary") return "🔄";
  if (type === "fork") return "🔀";
  if (type === "merge") return "↗️";
  return "⬆️";
};

type RoadType = "cycle" | "foot" | "road" | "highway" | "link" | "unknown";

const getRoadType = (name: string, ref?: string): RoadType => {
  const n = (name || "").toLowerCase();
  const r = (ref || "").toLowerCase();
  // Snelweg / autostrade detectie via ref (E17, A12, R1, N1...)
  if (/^(e\d+|a\d+|r\d+)$/.test(r.trim())) return "highway";
  if (!n && !r) return "link";
  if (/(fietspad|fietsroute|fietsweg|fietsstraat|cycle)/.test(n)) return "cycle";
  if (/(voetpad|wandelpad|voetgangers|footway)/.test(n)) return "foot";
  if (/(straat|laan|weg|baan|ring|plein|kaai|brug|tunnel|dreef|steenweg|boulevard|avenue|chauss|lei|markt|hof|dijk)/.test(n)) return "road";
  return "link";
};

const ROAD_LABELS: Record<RoadType, { label: string; icon: string; cls: string }> = {
  cycle:   { label: "Fietspad",  icon: "🚲", cls: "bg-allowed/20 text-allowed-foreground border-allowed/40" },
  foot:    { label: "Voetpad",   icon: "🚶", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  road:    { label: "Weg",       icon: "🛣️", cls: "bg-secondary text-secondary-foreground border-border" },
  highway: { label: "Snelweg ⚠", icon: "🚫", cls: "bg-destructive/20 text-destructive border-destructive/40" },
  link:    { label: "Verbinding",icon: "↪️", cls: "bg-muted text-muted-foreground border-border" },
  unknown: { label: "Onbekend",  icon: "❔", cls: "bg-muted text-muted-foreground border-border" },
};

const formatInstruction = (step: RouteStep) => {
  const { type, modifier } = step.maneuver;
  const name = step.name || "onbekende weg";

  if (type === "depart") return `Vertrek via ${name}`;
  if (type === "arrive") return "Je bent aangekomen!";
  if (type === "turn" || type === "end of road") {
    if (modifier?.includes("left")) return `Sla linksaf naar ${name}`;
    if (modifier?.includes("right")) return `Sla rechtsaf naar ${name}`;
    if (modifier?.includes("straight")) return `Ga rechtdoor op ${name}`;
    return `Ga verder op ${name}`;
  }
  if (type === "new name") return `Ga verder op ${name}`;
  if (type === "roundabout" || type === "rotary") return `Neem de rotonde, ga verder op ${name}`;
  if (type === "fork") {
    if (modifier?.includes("left")) return `Houd links aan naar ${name}`;
    if (modifier?.includes("right")) return `Houd rechts aan naar ${name}`;
  }
  if (type === "merge") return `Voeg samen op ${name}`;
  return `Ga verder op ${name}`;
};

const ScooterMap = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const stepMarkerRef = useRef<L.Marker | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);

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

  // Navigation state
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [navigating, setNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);

  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Initialize map - Antwerp only
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: ANTWERP_CENTER,
      zoom: ANTWERP_ZOOM,
      zoomControl: false,
      maxBounds: ANTWERP_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 12,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Audio is UI-only (no real TTS)

  // Search locations - Antwerp focused
  const searchLocation = useCallback(async (query: string, field: "from" | "to") => {
    if (query.length < 2) {
      field === "from" ? setFromResults([]) : setToResults([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Antwerpen"
        )}&limit=8&viewbox=4.25,51.12,4.55,51.32&bounded=1&countrycodes=be&addressdetails=1`
      );
      const raw: SearchResult[] = await res.json();
      const data = raw.filter((r) => {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        return lat >= 51.12 && lat <= 51.32 && lon >= 4.25 && lon <= 4.55;
      });
      field === "from" ? setFromResults(data) : setToResults(data);
    } catch { /* silent */ }
  }, []);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const handleSearch = (query: string, field: "from" | "to") => {
    if (field === "from") setFromQuery(query);
    else setToQuery(query);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(query, field), 600);
  };

  const selectResult = (result: SearchResult, field: "from" | "to") => {
    const coord: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
    const shortName = result.display_name.split(",").slice(0, 2).join(",");
    if (field === "from") {
      setFromCoord(coord); setFromQuery(shortName); setFromResults([]);
    } else {
      setToCoord(coord); setToQuery(shortName); setToResults([]);
    }
    setActiveField(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setUsingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        userLocationRef.current = coord;
        setFromCoord(coord);
        setFromQuery("📍 Mijn locatie");
        setUsingLocation(false);
      },
      () => { setError("Locatie niet beschikbaar"); setUsingLocation(false); }
    );
  };

  const centerOnUser = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        userLocationRef.current = coord;
        mapRef.current?.flyTo(coord, 16, { duration: 0.8 });
      },
      () => setError("Locatie niet beschikbaar")
    );
  };

  // Calculate route
  const calculateRoute = useCallback(async () => {
    if (!fromCoord || !toCoord || !mapRef.current) return;
    setLoading(true); setError(null); setRouteInfo(null);
    setSteps([]); setNavigating(false); setCurrentStep(0);

    if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    if (stepMarkerRef.current) { mapRef.current.removeLayer(stepMarkerRef.current); stepMarkerRef.current = null; }

    try {
      // OSM-DE routed-bike: echte fiets-profiel, vermijdt snelwegen/autostrades
      const res = await fetch(
        `https://routing.openstreetmap.de/routed-bike/route/v1/bike/${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}?overview=full&geometries=geojson&steps=true`
      );
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.length) {
        setError("Geen route gevonden."); setLoading(false); return;
      }

      const route = data.routes[0];

      // Color map per road type (HSL from design tokens)
      const ROAD_COLORS: Record<RoadType, string> = {
        cycle:   "hsl(160, 60%, 45%)", // groen — fietspad
        road:    "hsl(210, 80%, 55%)", // blauw — gewone weg
        foot:    "hsl(40, 90%, 55%)",  // amber — voetpad
        highway: "hsl(0, 72%, 55%)",   // rood — verboden
        link:    "hsl(210, 12%, 55%)", // grijs — verbinding
        unknown: "hsl(210, 12%, 55%)",
      };

      // Build per-step colored polylines + detect highway segments
      const group = L.layerGroup();
      let hasHighway = false;
      route.legs[0].steps.forEach((s: any) => {
        const segCoords: [number, number][] = (s.geometry?.coordinates || []).map(
          (c: [number, number]) => [c[1], c[0]]
        );
        if (segCoords.length < 2) return;
        const rt = getRoadType(s.name || "", s.ref);
        if (rt === "highway") hasHighway = true;
        L.polyline(segCoords, {
          color: ROAD_COLORS[rt],
          weight: 6,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
          dashArray: rt === "highway" ? "8 6" : undefined,
        }).addTo(group);
      });
      group.addTo(mapRef.current);
      routeLayerRef.current = group;
      if (hasHighway) {
        setError("⚠ Deze route bevat een snelweg/autostrade — niet toegelaten voor scooters.");
      }

      const startIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:hsl(160,60%,45%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10], className: "",
      });
      const endIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:hsl(0,72%,55%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10], className: "",
      });

      markersRef.current.push(
        L.marker(fromCoord, { icon: startIcon }).addTo(mapRef.current).bindPopup("🛴 Start"),
        L.marker(toCoord, { icon: endIcon }).addTo(mapRef.current).bindPopup("📍 Bestemming")
      );

      const allCoords: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );
      mapRef.current.fitBounds(L.latLngBounds(allCoords), { padding: [80, 80] });

      const routeSteps: RouteStep[] = route.legs[0].steps.map((s: any) => ({
        instruction: "",
        distance: s.distance,
        duration: s.duration,
        name: s.name || "",
        ref: s.ref || undefined,
        maneuver: s.maneuver,
        coord: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
      }));
      routeSteps.forEach((step) => { step.instruction = formatInstruction(step); });
      setSteps(routeSteps);

      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.ceil(route.duration / 60);
      setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });
    } catch {
      setError("Fout bij het berekenen van de route.");
    }
    setLoading(false);
  }, [fromCoord, toCoord]);

  useEffect(() => {
    if (fromCoord && toCoord) calculateRoute();
  }, [fromCoord, toCoord, calculateRoute]);

  // Navigation: zoom to current step
  useEffect(() => {
    if (!navigating || !mapRef.current || steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;
    if (stepMarkerRef.current) mapRef.current.removeLayer(stepMarkerRef.current);
    const icon = L.divIcon({
      html: `<div style="width:32px;height:32px;background:hsl(160,60%,45%);border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:16px">${getManeuverIcon(step.maneuver.type, step.maneuver.modifier)}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], className: "",
    });
    stepMarkerRef.current = L.marker(step.coord, { icon }).addTo(mapRef.current);
    mapRef.current.flyTo(step.coord, 17, { duration: 0.8 });
  }, [navigating, currentStep, steps]);

  const startNavigation = () => {
    setNavigating(true); setCurrentStep(0); setInstructionsExpanded(false); setPanelMinimized(true);
  };
  const stopNavigation = () => {
    setNavigating(false); setCurrentStep(0);
    if (stepMarkerRef.current && mapRef.current) { mapRef.current.removeLayer(stepMarkerRef.current); stepMarkerRef.current = null; }
    if (routeLayerRef.current && mapRef.current) {
      const bounds = L.latLngBounds([]);
      routeLayerRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline) bounds.extend(layer.getBounds());
      });
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [80, 80] });
    }
    setPanelMinimized(false);
  };
  const nextStep = () => { if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1); };
  const prevStep = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };

  const clearRoute = () => {
    if (routeLayerRef.current && mapRef.current) { mapRef.current.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    if (stepMarkerRef.current && mapRef.current) { mapRef.current.removeLayer(stepMarkerRef.current); stepMarkerRef.current = null; }
    setFromQuery(""); setToQuery("");
    setFromCoord(null); setToCoord(null);
    setRouteInfo(null); setError(null);
    setSteps([]); setNavigating(false); setCurrentStep(0);
    setInstructionsExpanded(false); setPanelMinimized(false);
    if (mapRef.current) mapRef.current.flyTo(ANTWERP_CENTER, ANTWERP_ZOOM, { duration: 0.8 });
  };

  const toggleTts = () => setTtsEnabled(!ttsEnabled);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Profile link - top right */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Link
          to="/profiel"
          className="flex items-center justify-center w-10 h-10 bg-card/90 backdrop-blur border border-border rounded-full text-foreground hover:bg-card transition-colors shadow-lg"
        >
          <User className="w-5 h-5" />
        </Link>
      </div>

      {/* Center on location button */}
      <div className="absolute bottom-24 right-4 z-[1000]">
        <button
          onClick={centerOnUser}
          className="flex items-center justify-center w-10 h-10 bg-card/90 backdrop-blur border border-border rounded-full text-foreground hover:bg-card transition-colors shadow-lg"
          title="Centreer op mijn locatie"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Search panel - top left */}
      <div className={`absolute top-4 left-4 ${panelMinimized ? "right-auto w-auto" : "right-16 md:right-auto md:w-96"} z-[1000]`}>
        {panelMinimized ? (
          <button
            onClick={() => setPanelMinimized(false)}
            className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-display font-semibold text-foreground"
          >
            📍 B-Map <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-sm text-foreground">📍 B-Map</span>
              <div className="flex items-center gap-1">
                {navigating && (
                  <button onClick={() => setPanelMinimized(true)} className="text-muted-foreground hover:text-foreground p-1">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                )}
                {(fromCoord || toCoord) && (
                  <button onClick={clearRoute} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* From */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                <input
                  type="text" value={fromQuery}
                  onChange={(e) => handleSearch(e.target.value, "from")}
                  onFocus={() => setActiveField("from")}
                  placeholder="Vertrekpunt..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
                <button onClick={useMyLocation} className="text-muted-foreground hover:text-primary flex-shrink-0" title="Mijn locatie">
                  {usingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                </button>
              </div>
              {activeField === "from" && fromResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {fromResults.map((r, i) => (
                    <button key={i} onClick={() => selectResult(r, "from")}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors border-b border-border last:border-0">
                      {r.display_name.split(",").slice(0, 3).join(",")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* To */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                <div className="w-3 h-3 rounded-full bg-destructive flex-shrink-0" />
                <input
                  type="text" value={toQuery}
                  onChange={(e) => handleSearch(e.target.value, "to")}
                  onFocus={() => setActiveField("to")}
                  placeholder="Bestemming..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
              {activeField === "to" && toResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {toResults.map((r, i) => (
                    <button key={i} onClick={() => selectResult(r, "to")}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors border-b border-border last:border-0">
                      {r.display_name.split(",").slice(0, 3).join(",")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Route berekenen...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}

            {routeInfo && !navigating && (
              <>
                <div className="flex items-center gap-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <div className="text-center flex-1">
                    <div className="text-lg font-display font-bold text-primary">{routeInfo.distance}</div>
                    <div className="text-xs text-muted-foreground">afstand</div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center flex-1">
                    <div className="text-lg font-display font-bold text-primary">{routeInfo.duration}</div>
                    <div className="text-xs text-muted-foreground">reistijd</div>
                  </div>
                </div>
                <button
                  onClick={startNavigation}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-3 font-display font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Play className="w-4 h-4" /> Start route
                </button>
              </>
            )}

            {!routeInfo && !loading && !error && (
              <p className="text-xs text-muted-foreground">
                Zoek een route in Antwerpen — via fietspaden & lokale wegen
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation bottom sheet */}
      {navigating && steps.length > 0 && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-[1000] transition-all duration-300 ${
            instructionsExpanded ? "top-1/3" : ""
          }`}
        >
          <div className="bg-card border-t border-border rounded-t-2xl shadow-2xl h-full flex flex-col">
            {/* Swipe handle */}
            <button
              onClick={() => setInstructionsExpanded(!instructionsExpanded)}
              className="w-full flex justify-center py-2 cursor-grab"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
            </button>

            {/* Current instruction - compact */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">
                  {getManeuverIcon(steps[currentStep].maneuver.type, steps[currentStep].maneuver.modifier)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-foreground text-xs leading-tight">
                    {steps[currentStep].instruction}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => {
                      const rt = getRoadType(steps[currentStep].name, steps[currentStep].ref);
                      const meta = ROAD_LABELS[rt];
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${meta.cls}`}>
                          <span>{meta.icon}</span>{meta.label}
                        </span>
                      );
                    })()}
                    {steps[currentStep].distance > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {steps[currentStep].distance < 1000
                          ? `${Math.round(steps[currentStep].distance)} m`
                          : `${(steps[currentStep].distance / 1000).toFixed(1)} km`}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{currentStep + 1}/{steps.length}</span>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex border-t border-border">
              <button onClick={prevStep} disabled={currentStep === 0}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-foreground hover:bg-secondary disabled:opacity-30 transition-colors border-r border-border">
                <ChevronRight className="w-3 h-3 rotate-180" /> Vorige
              </button>
              <button onClick={stopNavigation}
                className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors border-r border-border">
                <Square className="w-3 h-3" />
              </button>
              <button onClick={toggleTts}
                className="flex items-center justify-center px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-r border-border"
                title={ttsEnabled ? "Geluid dempen" : "Geluid aan"}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={nextStep} disabled={currentStep === steps.length - 1}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-primary font-medium hover:bg-primary/10 disabled:opacity-30 transition-colors">
                Volgende <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Expanded: legend + all steps */}
            {instructionsExpanded && (
              <div className="flex-1 overflow-y-auto border-t border-border">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/40 border-b border-border text-[10px]">
                  <span className="text-muted-foreground">Type:</span>
                  {(["cycle","road","foot"] as RoadType[]).map((t) => (
                    <span key={t} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${ROAD_LABELS[t].cls}`}>
                      <span>{ROAD_LABELS[t].icon}</span>{ROAD_LABELS[t].label}
                    </span>
                  ))}
                </div>
                {steps.map((step, i) => {
                  const rt = getRoadType(step.name);
                  const meta = ROAD_LABELS[rt];
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-xs transition-colors border-b border-border last:border-0 ${
                        i === currentStep ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                      } ${i < currentStep ? "opacity-40" : ""}`}
                    >
                      <span className="text-sm flex-shrink-0">{getManeuverIcon(step.maneuver.type, step.maneuver.modifier)}</span>
                      <span className="flex-1 min-w-0 truncate">{step.instruction}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${meta.cls}`}>
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                      {step.distance > 0 && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1000).toFixed(1)} km`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScooterMap;
