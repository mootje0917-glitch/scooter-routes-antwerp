import ScooterMap from "@/components/ScooterMap";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const MapPage = () => {
  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border z-20">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Terug</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-display font-semibold text-sm">Scooter Route Planner</span>
        </div>
      </header>
      <div className="flex-1 relative">
        <ScooterMap />
      </div>
    </div>
  );
};

export default MapPage;
