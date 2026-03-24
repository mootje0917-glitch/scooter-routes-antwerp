import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, User, Bell, Moon, Shield } from "lucide-react";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setName(data.user.user_metadata?.full_name || "");
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await supabase.auth.updateUser({ data: { full_name: name } });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display font-semibold text-foreground">Profiel</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Avatar & name */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-foreground">{name || "Gebruiker"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Edit name */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-display font-semibold text-sm text-foreground">Persoonlijke gegevens</h2>
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-xs">Naam</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Je naam" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">E-mail</Label>
            <Input value={user?.email || ""} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSave} size="sm" disabled={saving} className="w-full">
            {saved ? "✓ Opgeslagen" : saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>

        {/* Settings */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h2 className="font-display font-semibold text-sm text-foreground">Instellingen</h2>

          <SettingRow icon={<Bell className="w-4 h-4" />} label="Meldingen" checked={notifications} onChange={setNotifications} />
          <SettingRow icon={<Moon className="w-4 h-4" />} label="Donker thema" checked={darkMode} onChange={setDarkMode} />
        </div>

        {/* Logout */}
        <Button variant="destructive" onClick={handleLogout} className="w-full">
          <LogOut className="w-4 h-4 mr-2" /> Uitloggen
        </Button>
      </div>
    </div>
  );
};

const SettingRow = ({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-secondary"}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  </div>
);

export default ProfilePage;
