import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, ArrowLeft, CalendarDays, Loader2, MapPin, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tables, Json } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type DateRecord = Tables<'dates'>;

interface InviteeSnapshot {
  name: string;
  phone_e164?: string;
  email?: string;
  instagram_handle?: string;
  telegram_username?: string;
}

const timeBucketLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  late_evening: 'Late Evening',
};

export default function Dates() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dates, setDates] = useState<DateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    async function fetchDates() {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('dates')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', today)
        .eq('status', 'upcoming')
        .order('date', { ascending: true });

      if (!error && data) {
        setDates(data);
      }
      setLoading(false);
    }

    fetchDates();
  }, [user]);

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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">My Dates</h1>
          <p className="text-muted-foreground">
            View upcoming dates and manage Safety Packs
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming Dates
            </CardTitle>
            <CardDescription>
              Confirmed dates with Safety Pack options
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming dates</p>
                <p className="text-sm mt-2">Accept an invite to schedule your first date!</p>
              </div>
            ) : (
              <div className="space-y-4">
{dates.map((dateRecord) => {
                  const invitee = dateRecord.invitee_snapshot as unknown as InviteeSnapshot;
                  return (
                    <Link 
                      key={dateRecord.id} 
                      to={`/dates/${dateRecord.id}`}
                      className="block border border-border rounded-lg p-4 space-y-3 hover:border-primary/50 hover:bg-card/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{invitee.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(dateRecord.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {dateRecord.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {timeBucketLabels[dateRecord.time_bucket] || dateRecord.time_bucket}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {dateRecord.area_label}
                        </div>
                      </div>
                      {invitee.instagram_handle && (
                        <p className="text-sm text-muted-foreground">
                          IG: {invitee.instagram_handle}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
