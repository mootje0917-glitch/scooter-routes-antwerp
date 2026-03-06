import { Gauge, Shield, FileText } from "lucide-react";

const specs = [
  {
    icon: Gauge,
    title: "Max 25 km/u",
    desc: "Een klasse B scooter is begrensd op 25 km/u. Geen rijbewijs nodig.",
  },
  {
    icon: Shield,
    title: "Geen helm verplicht",
    desc: "Je bent niet verplicht een helm te dragen, maar het wordt wel aangeraden.",
  },
  {
    icon: FileText,
    title: "Wel een kenteken",
    desc: "Je scooter moet ingeschreven zijn en een kentekenplaat hebben.",
  },
];

const WhatIsClassB = () => {
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">
          Wat is een <span className="text-primary">Klasse B</span> scooter?
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Een bromfiets klasse B (ook wel "speed pedelec zone" voertuig) mag maximaal 25 km/u en 
          volgt grotendeels de fietsregels — maar niet overal.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {specs.map((spec) => (
            <div
              key={spec.title}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors"
            >
              <spec.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-display font-semibold text-lg mb-2">{spec.title}</h3>
              <p className="text-muted-foreground text-sm">{spec.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatIsClassB;
