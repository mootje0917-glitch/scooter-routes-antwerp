import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-antwerp.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Antwerpen straten met scooterpaden"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
      </div>
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-primary text-sm font-medium">Klasse B Scooter — Antwerpen</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          Waar mag je rijden<br />
          <span className="text-primary">met je scooter?</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          De regels voor klasse B scooters (max 25 km/u) in Antwerpen. 
          Eindelijk duidelijk overzicht — want op Google Maps zie je dit niet.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <a
            href="#regels"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-display font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Bekijk de regels ↓
          </a>
          <Link
            to="/kaart"
            className="inline-flex items-center gap-2 bg-card border border-primary/30 text-primary px-8 py-4 rounded-lg font-display font-semibold text-lg hover:bg-primary/10 transition-colors"
          >
            🗺️ Open de kaart
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
