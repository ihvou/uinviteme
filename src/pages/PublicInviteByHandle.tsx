import { useParams } from 'react-router-dom';
import { usePublicInviteByHandle } from '@/hooks/usePublicInviteByHandle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Loader2, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { InviteWizard } from '@/components/invite/InviteWizard';

export default function PublicInviteByHandle() {
  const { handle } = useParams<{ handle: string }>();
  const {
    scheduleId,
    profile,
    slots,
    screeningConfig,
    formats,
    vibeTags,
    intentTags,
    boundaryTags,
    questions,
    loading,
    error,
    submitInvite,
  } = usePublicInviteByHandle(handle);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Invite Not Available</h2>
            <p className="text-muted-foreground">{error || 'This profile could not be found.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Host Profile Card */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <Avatar className="h-20 w-20 mx-auto mb-4">
              <AvatarImage src={profile.photo_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {profile.display_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{profile.display_name || 'Anonymous'}</CardTitle>
            {profile.bio_one_liner && (
              <CardDescription className="text-base">{profile.bio_one_liner}</CardDescription>
            )}
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
              {profile.city_label && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.city_label}
                </span>
              )}
              {profile.age && (
                <Badge variant="secondary">{profile.age} years old</Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Availability */}
        {slots.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No availability for the next 7 days</p>
            </CardContent>
          </Card>
        ) : (
          <InviteWizard
            slots={slots}
            screeningConfig={screeningConfig}
            formats={formats}
            vibeTags={vibeTags}
            intentTags={intentTags}
            boundaryTags={boundaryTags}
            questions={questions}
            onSubmit={submitInvite}
          />
        )}
      </main>
    </div>
  );
}
