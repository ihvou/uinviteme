import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Calendar,
  Heart,
  LogOut,
  Users,
  Settings,
  Loader2,
  CalendarDays,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  CircleCheck,
  Circle,
  Shield,
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
  const [copied, setCopied] = useState(false);
  const [hasSlots, setHasSlots] = useState(false);
  const [hasScreening, setHasScreening] = useState(false);

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

        // Check if user has slots
        const { count: slotCount } = await supabase
          .from('slots')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_id', scheduleData.id)
          .eq('is_active', true);
        setHasSlots((slotCount || 0) > 0);

        // Check if user has screening config with enabled questions
        const { data: screeningConfig } = await supabase
          .from('screening_configs')
          .select('enabled_questions')
          .eq('schedule_id', scheduleData.id)
          .single();
        
        const enabledQuestions = (screeningConfig?.enabled_questions as string[]) || [];
        setHasScreening(enabledQuestions.length > 0);
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/invite/${profile?.handle || user?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Share it on your dating profiles' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inviteLink = `${window.location.origin}/invite/${profile?.handle || user?.id}`;

  // Setup checklist items
  const setupSteps = [
    {
      id: 'schedule',
      label: 'Add availability slots',
      completed: hasSlots,
      link: '/schedule',
      description: "Set when you're free for dates",
    },
    {
      id: 'screening',
      label: 'Configure screening',
      completed: hasScreening,
      link: '/settings',
      description: 'Choose what to ask invitees',
    },
    {
      id: 'share',
      label: 'Share your link',
      completed: copied,
      action: handleCopyLink,
      description: 'Post on dating apps',
    },
  ];

  const completedSteps = setupSteps.filter((s) => s.completed).length;
  const allComplete = completedSteps === setupSteps.length;

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
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Welcome + Share Link (Hero) */}
        <Card className="mb-6 bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground mb-1">
                  Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}!
                </h1>
                <p className="text-muted-foreground text-sm">
                  Share your invite link on dating apps
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent hidden sm:block" />
              </div>
            </div>

            {/* Invite Link Box */}
            <div className="mt-5 p-4 bg-card rounded-xl border border-border shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-muted/50 rounded-lg px-4 py-3 text-sm font-mono text-foreground truncate border border-border/50">
                  {inviteLink}
                </div>
                <Button 
                  onClick={handleCopyLink}
                  className="gap-2 shrink-0"
                  size="lg"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              {!profile?.handle && (
                <p className="text-xs text-muted-foreground mt-3">
                  Want a cleaner URL?{' '}
                  <Link to="/settings" className="text-primary hover:underline font-medium">
                    Set a custom handle
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        {!allComplete && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-accent" />
                  Get started
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {completedSteps} of {setupSteps.length} complete
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${(completedSteps / setupSteps.length) * 100}%` }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {setupSteps.map((step) => {
                  const stepClassName = `flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-left ${
                    step.completed 
                      ? 'bg-success/10 cursor-default' 
                      : 'bg-card hover:bg-muted/50 cursor-pointer border border-border'
                  }`;

                  const content = (
                    <>
                      {step.completed ? (
                        <CircleCheck className="h-5 w-5 text-success shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${step.completed ? 'text-success' : 'text-foreground'}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                      {!step.completed && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </>
                  );

                  if (step.link) {
                    return (
                      <Link key={step.id} to={step.link} className={stepClassName}>
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={step.action}
                      className={stepClassName}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unified Action Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Invites Card */}
          <Link to="/invites" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Invites</CardTitle>
                      {pendingInvites > 0 ? (
                        <p className="text-sm text-primary font-medium">
                          {pendingInvites} pending
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No invites yet
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                {pendingInvites === 0 && (
                  <p className="text-xs text-muted-foreground mt-3 pl-14">
                    Share your link to start receiving invites
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Dates Card */}
          <Link to="/dates" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-success/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/15 transition-colors">
                      <CalendarDays className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Dates</CardTitle>
                      {upcomingDates > 0 ? (
                        <p className="text-sm text-success font-medium">
                          {upcomingDates} upcoming
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No dates scheduled
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-success transition-colors" />
                </div>
                {upcomingDates === 0 && (
                  <p className="text-xs text-muted-foreground mt-3 pl-14">
                    Accept invites to schedule your first date
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Schedule Card */}
          <Link to="/schedule" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-accent/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                      <Calendar className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Schedule</CardTitle>
                      {schedule?.is_active ? (
                        <p className="text-sm text-success font-medium">Active</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Inactive</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground mt-3 pl-14">
                  {schedule?.is_active 
                    ? 'Your availability is visible to invitees'
                    : 'Add slots to start accepting invites'
                  }
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Profile/Settings Card */}
          <Link to="/settings" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-border cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Profile</CardTitle>
                      {profile?.public_profile_enabled ? (
                        <p className="text-sm text-success font-medium">Public</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Private</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground mt-3 pl-14">
                  Screening questions and preferences
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}