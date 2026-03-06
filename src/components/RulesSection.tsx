import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const allowed = [
  "Fietspaden (aangeduid met bord D7, D9, D10)",
  "Wegen met snelheidslimiet ≤ 50 km/u (op de rijbaan)",
  "Fietsstraten — je mag de volledige rijbaan gebruiken",
  "Gemengd verkeer zones zonder gescheiden fietspad",
  "Fietstunnels en fietsbruggen (tenzij verboden)",
];

const forbidden = [
  "Voetpaden en trottoirs",
  "Autosnelwegen en expreswegen",
  "Voetgangerszones (bv. Meir, Groenplaats)",
  "Zones waar een verkeersbord fietsen verbiedt (C11)",
  "Eénrichtingsstraten tegen de richting in (tenzij bord M2 aanwezig)",
];

const warnings = [
  "In zone 30: je mag max 30 km/u, maar met klasse B zit je al onder die limiet",
  "Leien & ring: druk verkeer — wees extra voorzichtig op de rijbaan",
  "Parken: vaak verboden voor gemotoriseerd verkeer, ook scooters",
  "Nieuw circulatieplan: check altijd de actuele knips en lussen",
];

const RulesSection = () => {
  return (
    <section id="regels" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
          De regels op een rij
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Allowed */}
          <div className="bg-allowed/5 border border-allowed/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-7 h-7 text-allowed" />
              <h3 className="font-display font-bold text-xl text-allowed">Hier mag je rijden</h3>
            </div>
            <ul className="space-y-4">
              {allowed.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-allowed shrink-0 mt-0.5" />
                  <span className="text-foreground/90 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Forbidden */}
          <div className="bg-forbidden/5 border border-forbidden/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <XCircle className="w-7 h-7 text-forbidden" />
              <h3 className="font-display font-bold text-xl text-forbidden">Hier mag je NIET rijden</h3>
            </div>
            <ul className="space-y-4">
              {forbidden.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-forbidden shrink-0 mt-0.5" />
                  <span className="text-foreground/90 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-7 h-7 text-warning" />
            <h3 className="font-display font-bold text-xl text-warning">Let op in Antwerpen</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {warnings.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <span className="text-foreground/90 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RulesSection;
