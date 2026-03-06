import HeroSection from "@/components/HeroSection";
import WhatIsClassB from "@/components/WhatIsClassB";
import RulesSection from "@/components/RulesSection";
import ZonesSection from "@/components/ZonesSection";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const RulesPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-card transition-colors shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar kaart
        </Link>
      </div>
      <HeroSection />
      <WhatIsClassB />
      <RulesSection />
      <ZonesSection />
      <Footer />
    </div>
  );
};

export default RulesPage;
