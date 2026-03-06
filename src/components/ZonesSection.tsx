import { MapPin } from "lucide-react";

const zones = [
  {
    name: "Meir & winkelstraten",
    status: "forbidden" as const,
    desc: "Voetgangerszone — scooters zijn hier verboden, ook klasse B.",
  },
  {
    name: "Groenplaats & Grote Markt",
    status: "forbidden" as const,
    desc: "Voetgangerszone — afstappen en aan de hand meenemen.",
  },
  {
    name: "Stadspark & Nachtegalenpark",
    status: "forbidden" as const,
    desc: "Parken zijn verboden voor gemotoriseerd verkeer.",
  },
  {
    name: "Leien (Frankrijklei, Italielei...)",
    status: "warning" as const,
    desc: "Toegestaan op de rijbaan, maar druk en gevaarlijk. Fietspad waar aanwezig.",
  },
  {
    name: "Scheldekaaien",
    status: "allowed" as const,
    desc: "Toegestaan op het fietspad langs de Schelde.",
  },
  {
    name: "Fietstunnels (Sint-Annatunnel)",
    status: "allowed" as const,
    desc: "Toegestaan — rijd stapvoets en geef voetgangers voorrang.",
  },
  {
    name: "Eilandje & Haven",
    status: "allowed" as const,
    desc: "Toegestaan op de rijbaan en fietspaden.",
  },
  {
    name: "Linkeroever",
    status: "allowed" as const,
    desc: "Toegestaan op fietspaden en de rijbaan.",
  },
];

const statusConfig = {
  allowed: {
    label: "Toegestaan",
    dotClass: "bg-allowed",
    borderClass: "border-allowed/20 hover:border-allowed/40",
  },
  forbidden: {
    label: "Verboden",
    dotClass: "bg-forbidden",
    borderClass: "border-forbidden/20 hover:border-forbidden/40",
  },
  warning: {
    label: "Opgelet",
    dotClass: "bg-warning",
    borderClass: "border-warning/20 hover:border-warning/40",
  },
};

const ZonesSection = () => {
  return (
    <section className="py-20 px-6 bg-secondary/30">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">
          Bekende plekken in <span className="text-primary">Antwerpen</span>
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Snel zien of je er met je klasse B scooter mag komen.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {zones.map((zone) => {
            const config = statusConfig[zone.status];
            return (
              <div
                key={zone.name}
                className={`bg-card border ${config.borderClass} rounded-xl p-5 transition-colors`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">{zone.name}</span>
                </div>
                <p className="text-muted-foreground text-xs mb-3">{zone.desc}</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                  <span className="text-xs font-medium">{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ZonesSection;
