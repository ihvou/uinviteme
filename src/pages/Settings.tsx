import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Heart, ArrowLeft, User, Bell, Loader2, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScreeningConfigCard } from '@/components/settings/ScreeningConfigCard';
import { PhotoUpload } from '@/components/settings/PhotoUpload';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bioOneLiner, setBioOneLiner] = useState('');
  const [cityLabel, setCityLabel] = useState('');
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setHandle(data.handle || '');
      setBioOneLiner(data.bio_one_liner || '');
      setCityLabel(data.city_label || '');
      setPublicProfileEnabled(data.public_profile_enabled || false);
      setPhotoUrl(data.photo_url || null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio_one_liner: bioOneLiner,
        city_label: cityLabel,
        public_profile_enabled: publicProfileEnabled,
      })
      .eq('id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error saving',
        description: error.message,
      });
    } else {
      toast({
        title: 'Saved',
        description: 'Your profile has been updated.',
      });
      fetchProfile();
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and preferences
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Information visible on your public invite page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <PhotoUpload
                  userId={user?.id || ''}
                  currentPhotoUrl={photoUrl}
                  displayName={displayName}
                  onPhotoUpdated={setPhotoUrl}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="handle">Handle</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">uinvite.me/invite/</span>
                  <Input
                    id="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourhandle"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, and underscores only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">One-liner Bio</Label>
                <Input
                  id="bio"
                  value={bioOneLiner}
                  onChange={(e) => setBioOneLiner(e.target.value)}
                  placeholder="A short description about yourself"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={cityLabel}
                  onChange={(e) => setCityLabel(e.target.value)}
                  placeholder="e.g., San Francisco, CA"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label htmlFor="publicProfile" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Public Profile
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow others to find you via your invite link
                  </p>
                </div>
                <Switch
                  id="publicProfile"
                  checked={publicProfileEnabled}
                  onCheckedChange={setPublicProfileEnabled}
                />
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          <ScreeningConfigCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                How you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon - notification preferences
              </p>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => {
                signOut();
                navigate('/');
              }}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
