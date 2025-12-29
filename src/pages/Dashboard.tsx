import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { InviteLinkCard } from '@/components/schedule/InviteLinkCard';
import {
  Calendar,
  Heart,
  LogOut,
  Users,
  Settings,
  Loader2,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Circle,
  Shield,
  ChevronDown,
  ChevronUp,
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
  const [hasSlots, setHasSlots] = useState(false);
  const [hasScreening, setHasScreening] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);

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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

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
        const { count: inviteCount } = await supabase
          .from('invites')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_id', scheduleData.id)
          .eq('status', 'pending');
        setPendingInvites(inviteCount || 0);

        const { count: slotCount } = await supabase
          .from('slots')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_id', scheduleData.id)
          .eq('is_active', true);
        setHasSlots((slotCount || 0) > 0);

        const { data: screeningConfig } = await supabase
          .from('screening_configs')
          .select('enabled_questions')
          .eq('schedule_id', scheduleData.id)
          .single();
        
        const enabledQuestions = (screeningConfig?.enabled_questions as string[]) || [];
        setHasScreening(enabledQuestions.length > 0);
      }

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

  const handleTogglePublicProfile = async (enabled: boolean) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ public_profile_enabled: enabled })
      .eq('id', user.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } else {
      setProfile(prev => prev ? { ...prev, public_profile_enabled: enabled } : null);
      toast({ title: enabled ? 'Public profile enabled' : 'Public profile disabled' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const setupSteps = [
    { id: 'schedule', label: 'Add availability slots', completed: hasSlots, link: '/schedule', description: "Set when you're free" },
    { id: 'screening', label: 'Configure screening', completed: hasScreening, link: '/schedule', description: 'Set expectations' },
  ];

  const completedSteps = setupSteps.filter((s) => s.completed).length;
  const allComplete = completedSteps === setupSteps.length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h1>
        </div>

        {/* Invite Links Card */}
        <div className="mb-6">
          <InviteLinkCard
            scheduleId={schedule?.id || null}
            handle={profile?.handle}
            publicProfileEnabled={profile?.public_profile_enabled || false}
            onTogglePublicProfile={handleTogglePublicProfile}
          />
        </div>

        {/* Setup Checklist */}
        {!allComplete && (
          <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
            <Card className="mb-6 border-accent/30 bg-accent/5">
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-accent" />
                        Get started
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{completedSteps} of {setupSteps.length}</span>
                        {checklistOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(completedSteps / setupSteps.length) * 100}%` }} />
                    </div>
                  </button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {setupSteps.map((step) => (
                      <Link key={step.id} to={step.link} className={`flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-left ${step.completed ? 'bg-success/10 cursor-default' : 'bg-card hover:bg-muted/50 cursor-pointer border border-border'}`}>
                        {step.completed ? <CircleCheck className="h-5 w-5 text-success shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${step.completed ? 'text-success' : 'text-foreground'}`}>{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                        {!step.completed && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Action Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/invites" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Invites</CardTitle>
                      <p className={`text-sm ${pendingInvites > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {pendingInvites > 0 ? `${pendingInvites} pending` : 'No invites yet'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dates" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-success/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Dates</CardTitle>
                      <p className={`text-sm ${upcomingDates > 0 ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                        {upcomingDates > 0 ? `${upcomingDates} upcoming` : 'No dates scheduled'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/schedule" className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-accent/30 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Schedule</CardTitle>
                      <p className={`text-sm ${schedule?.is_active ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                        {schedule?.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/settings" className="group">
            <Card className="h-full transition-all hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Profile</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {profile?.public_profile_enabled ? 'Public' : 'Private'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}