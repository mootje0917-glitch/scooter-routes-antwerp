import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search, Navigation, X, Loader2, AlertTriangle,
  ChevronRight, ChevronUp, ChevronDown, Play, Square, BookOpen
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

const BELGIUM_CENTER: [number, number] = [50.85, 4.35];
const BELGIUM_ZOOM = 8;

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
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const stepMarkerRef = useRef<L.Marker | null>(null);

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
  const [showSteps, setShowSteps] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: BELGIUM_CENTER,
      zoom: BELGIUM_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Search locations using Nominatim - Belgium wide
  const searchLocation = useCallback(async (query: string, field: "from" | "to") => {
    if (query.length < 3) {
      field === "from" ? setFromResults([]) : setToResults([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Belgium"
        )}&limit=5&countrycodes=be`
      );
      const data: SearchResult[] = await res.json();
      field === "from" ? setFromResults(data) : setToResults(data);
    } catch {
      // Silently fail
    }
  }, []);

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

  // Calculate route
  const calculateRoute = useCallback(async () => {
    if (!fromCoord || !toCoord || !mapRef.current) return;

    setLoading(true);
    setError(null);
    setRouteInfo(null);
    setSteps([]);
    setNavigating(false);
    setCurrentStep(0);

    // Clear previous
    if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    if (stepMarkerRef.current) { mapRef.current.removeLayer(stepMarkerRef.current); stepMarkerRef.current = null; }

    try {
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

      // Markers
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

      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [80, 80] });

      // Parse steps
      const routeSteps: RouteStep[] = route.legs[0].steps.map((s: any) => ({
        instruction: "",
        distance: s.distance,
        duration: s.duration,
        name: s.name || "",
        maneuver: s.maneuver,
        coord: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
      }));

      // Generate Dutch instructions
      routeSteps.forEach((step) => {
        step.instruction = formatInstruction(step);
      });

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

    // Remove old step marker
    if (stepMarkerRef.current) mapRef.current.removeLayer(stepMarkerRef.current);

    const icon = L.divIcon({
      html: `<div style="width:32px;height:32px;background:hsl(160,60%,45%);border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:16px">${getManeuverIcon(step.maneuver.type, step.maneuver.modifier)}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], className: "",
    });

    stepMarkerRef.current = L.marker(step.coord, { icon }).addTo(mapRef.current);
    mapRef.current.flyTo(step.coord, 17, { duration: 0.8 });
  }, [navigating, currentStep, steps]);

  const startNavigation = () => {
    setNavigating(true);
    setCurrentStep(0);
    setShowSteps(true);
    setPanelMinimized(true);
  };

  const stopNavigation = () => {
    setNavigating(false);
    setCurrentStep(0);
    if (stepMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(stepMarkerRef.current);
      stepMarkerRef.current = null;
    }
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [80, 80] });
    }
    setPanelMinimized(false);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const clearRoute = () => {
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    markersRef.current = [];
    if (stepMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(stepMarkerRef.current);
      stepMarkerRef.current = null;
    }
    setFromQuery(""); setToQuery("");
    setFromCoord(null); setToCoord(null);
    setRouteInfo(null); setError(null);
    setSteps([]); setNavigating(false); setCurrentStep(0);
    setShowSteps(false); setPanelMinimized(false);
    if (mapRef.current) mapRef.current.flyTo(BELGIUM_CENTER, BELGIUM_ZOOM, { duration: 0.8 });
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top-right: Rules link */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Link
          to="/regels"
          className="flex items-center gap-2 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-card transition-colors shadow-lg"
        >
          <BookOpen className="w-4 h-4 text-primary" />
          Regels
        </Link>
      </div>

      {/* Search panel - top left */}
      <div className={`absolute top-4 left-4 ${panelMinimized ? "right-auto w-auto" : "right-4 md:right-auto md:w-96"} z-[1000]`}>
        {panelMinimized ? (
          <button
            onClick={() => setPanelMinimized(false)}
            className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-display font-semibold text-foreground"
          >
            🛴 Route
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-sm text-foreground">🛴 Scooter Route</span>
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
                  type="text"
                  value={fromQuery}
                  onChange={(e) => handleSearch(e.target.value, "from")}
                  onFocus={() => setActiveField("from")}
                  placeholder="Vertrekpunt..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
                <button onClick={useMyLocation} className="text-muted-foreground hover:text-primary flex-shrink-0" title="Gebruik mijn locatie">
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

            {/* Route info + Start button */}
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
                  <Play className="w-4 h-4" />
                  Start route
                </button>
              </>
            )}

            {!routeInfo && !loading && !error && (
              <p className="text-xs text-muted-foreground">
                Voer een vertrekpunt en bestemming in — route via fietspaden & lokale wegen.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation overlay - bottom */}
      {navigating && steps.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000]">
          {/* Current step card */}
          <div className="mx-4 mb-4">
            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {/* Current instruction */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">
                    {getManeuverIcon(steps[currentStep].maneuver.type, steps[currentStep].maneuver.modifier)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-foreground text-sm">
                      {steps[currentStep].instruction}
                    </p>
                    {steps[currentStep].distance > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {steps[currentStep].distance < 1000
                          ? `${Math.round(steps[currentStep].distance)} m`
                          : `${(steps[currentStep].distance / 1000).toFixed(1)} km`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {currentStep + 1}/{steps.length}
                  </span>
                </div>
              </div>

              {/* Nav controls */}
              <div className="flex border-t border-border">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex-1 flex items-center justify-center gap-1 py-3 text-sm text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-border"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Vorige
                </button>
                <button
                  onClick={stopNavigation}
                  className="flex items-center justify-center gap-1 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors border-r border-border"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="flex items-center justify-center px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-r border-border"
                >
                  {showSteps ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <button
                  onClick={nextStep}
                  disabled={currentStep === steps.length - 1}
                  className="flex-1 flex items-center justify-center gap-1 py-3 text-sm text-primary font-medium hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Volgende <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* All steps list */}
              {showSteps && (
                <div className="border-t border-border max-h-48 overflow-y-auto">
                  {steps.map((step, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-b border-border last:border-0 ${
                        i === currentStep ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                      } ${i < currentStep ? "opacity-50" : ""}`}
                    >
                      <span className="text-base flex-shrink-0">
                        {getManeuverIcon(step.maneuver.type, step.maneuver.modifier)}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{step.instruction}</span>
                      {step.distance > 0 && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {step.distance < 1000
                            ? `${Math.round(step.distance)} m`
                            : `${(step.distance / 1000).toFixed(1)} km`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend - only when not navigating */}
      {!navigating && (
        <div className="absolute bottom-6 left-4 z-[1000] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded bg-primary" />
            <span className="text-foreground">Scooter route</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScooterMap;
