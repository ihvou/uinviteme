import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Heart,
  LogOut,
  Plus,
  Users,
  Settings,
  Shield,
  Loader2,
  CalendarDays,
  Link as LinkIcon,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Schedule = Tables<'schedules'>;
type Profile = Tables<'profiles'>;

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [upcomingDates, setUpcomingDates] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // Fetch or create schedule
      let { data: scheduleData } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!scheduleData) {
        const { data: newSchedule } = await supabase
          .from('schedules')
          .insert({ user_id: user.id })
          .select()
          .single();
        scheduleData = newSchedule;
      }
      setSchedule(scheduleData);

      if (scheduleData) {
        // Fetch pending invites count
        const { count: inviteCount } = await supabase
          .from('invites')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_id', scheduleData.id)
          .eq('status', 'pending');
        setPendingInvites(inviteCount || 0);
      }

      // Fetch upcoming dates count
      const today = new Date().toISOString().split('T')[0];
      const { count: dateCount } = await supabase
        .from('dates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', today)
        .eq('status', 'upcoming');
      setUpcomingDates(dateCount || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.display_name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Manage your dating schedule and review incoming invites.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingInvites}</div>
              <p className="text-xs text-muted-foreground">
                People waiting for your response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Dates</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingDates}</div>
              <p className="text-xs text-muted-foreground">
                Confirmed dates on your calendar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Schedule Status</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {schedule?.is_active ? (
                  <span className="text-success">Active</span>
                ) : (
                  <span className="text-muted-foreground">Inactive</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {schedule?.is_active ? 'Accepting invites' : 'Not accepting invites'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/schedule">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">My Schedule</CardTitle>
                <CardDescription>
                  Set your weekly availability and date preferences
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/invites">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-lg">Review Invites</CardTitle>
                <CardDescription>
                  See who wants to meet you and respond
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/dates">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-2">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <CardTitle className="text-lg">My Dates</CardTitle>
                <CardDescription>
                  View upcoming dates and activate Safety Packs
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/settings">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">Settings</CardTitle>
                <CardDescription>
                  Profile, screening questions, and preferences
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Share Link Section */}
        {schedule && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Share Your Invite Link
              </CardTitle>
              <CardDescription>
                Copy this link to your dating profiles or share directly with matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm font-mono text-muted-foreground truncate">
                  {window.location.origin}/invite/{profile?.handle || user?.id}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/invite/${profile?.handle || user?.id}`
                    );
                  }}
                >
                  Copy
                </Button>
              </div>
              {!profile?.handle && (
                <p className="text-xs text-muted-foreground mt-2">
                  <Link to="/settings" className="text-primary hover:underline">
                    Set a custom handle
                  </Link>{' '}
                  for a friendlier invite link.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
