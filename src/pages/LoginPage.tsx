import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccess("Account aangemaakt! Check je e-mail om te bevestigen.");
      }
    } catch (err: any) {
      setError(err.message || "Er ging iets mis.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🛴</span>
          <h1 className="font-display text-2xl font-bold text-foreground mt-3">B-Map</h1>
          <p className="text-sm text-muted-foreground mt-1">Antwerpen</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <div className="flex mb-6 bg-secondary rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inloggen
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Registreren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">Naam</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Je naam" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.be" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">Wachtwoord</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            {success && <p className="text-xs text-primary">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isLogin ? "Inloggen" : "Account aanmaken"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
