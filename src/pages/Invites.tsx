import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, ArrowLeft, Users, Loader2, Calendar, MapPin, Check, X, MessageSquare, Instagram, Phone, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Invite = Tables<'invites'>;
type Invitee = Tables<'invitees'>;
type Slot = Tables<'slots'>;

interface InviteWithDetails extends Invite {
  invitee: Invitee;
  slot: Slot;
}

export default function Invites() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<InviteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;

    // First get the user's schedule
    const { data: schedule } = await supabase
      .from('schedules')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!schedule) {
      setLoading(false);
      return;
    }

    // Fetch invites with invitee and slot data
    const { data: invitesData, error } = await supabase
      .from('invites')
      .select(`
        *,
        invitee:invitees(*),
        slot:slots(*)
      `)
      .eq('schedule_id', schedule.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invites:', error);
    } else {
      setInvites((invitesData as InviteWithDetails[]) || []);
    }
    setLoading(false);
  };

  const handleDecision = async (inviteId: string, decision: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('invites')
      .update({ 
        status: decision, 
        decided_at: new Date().toISOString() 
      })
      .eq('id', inviteId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update invite status',
      });
    } else {
      toast({
        title: decision === 'accepted' ? 'Invite accepted!' : 'Invite declined',
        description: decision === 'accepted' ? "We'll notify them to exchange details" : 'The invite has been removed',
      });
      fetchInvites();
    }
  };

  const timeBucketLabels: Record<string, string> = {
    morning: 'Morning (9am-12pm)',
    afternoon: 'Afternoon (12-5pm)',
    evening: 'Evening (5-9pm)',
    night: 'Night (9pm+)',
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
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Pending Invites</h1>
          <p className="text-muted-foreground">
            Review and respond to people who want to meet you
          </p>
        </div>

        {invites.length > 0 ? (
          <div className="space-y-4">
            {invites.map((invite) => (
              <Card key={invite.id} className="overflow-hidden">
                <CardContent className="p-5">
                  {/* Header with name and date */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{invite.invitee.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Received {format(new Date(invite.created_at || ''), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/30">
                      {format(new Date(invite.target_date), 'EEE, MMM d')}
                    </Badge>
                  </div>

                  {/* Slot details */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 pl-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {timeBucketLabels[invite.slot.time_bucket] || invite.slot.time_bucket}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {invite.slot.area_label}
                    </span>
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-wrap gap-3 mb-4 text-sm">
                    {invite.invitee.phone_e164 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {invite.invitee.phone_e164}
                      </span>
                    )}
                    {invite.invitee.instagram_handle && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Instagram className="h-3.5 w-3.5" />
                        @{invite.invitee.instagram_handle.replace('@', '')}
                      </span>
                    )}
                    {invite.invitee.telegram_username && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        @{invite.invitee.telegram_username.replace('@', '')}
                      </span>
                    )}
                  </div>

                  {/* Personal note */}
                  {invite.invitee_note && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <p className="text-sm italic text-foreground">"{invite.invitee_note}"</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 gap-2"
                      onClick={() => handleDecision(invite.id, 'accepted')}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2"
                      onClick={() => handleDecision(invite.id, 'declined')}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Incoming Invites
              </CardTitle>
              <CardDescription>
                Accept or decline date requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending invites</p>
                <p className="text-sm mt-2">Share your invite link to start receiving requests!</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
