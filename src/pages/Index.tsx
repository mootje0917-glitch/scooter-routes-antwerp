import HeroSection from "@/components/HeroSection";
import WhatIsClassB from "@/components/WhatIsClassB";
import RulesSection from "@/components/RulesSection";
import ZonesSection from "@/components/ZonesSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <WhatIsClassB />
      <RulesSection />
      <ZonesSection />
      <Footer />
    </div>
  );
};

export default Index;
