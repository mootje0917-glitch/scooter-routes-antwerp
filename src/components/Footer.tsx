const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-muted-foreground text-sm mb-2">
          Deze informatie is gebaseerd op de Belgische wegcode en het Antwerpse circulatieplan.
        </p>
        <p className="text-muted-foreground text-xs">
          Controleer altijd de lokale verkeersborden. Regels kunnen wijzigen. Laatst bijgewerkt: maart 2026.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
