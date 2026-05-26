import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Lock, AlertCircle, Coffee, Wine, UtensilsCrossed, Sparkles } from 'lucide-react';
import { usePublicInvite, SlotWithDate } from '@/hooks/usePublicInvite';
import { InviteSubmitSuccess, InviteWizard } from '@/components/invite/InviteWizard';
import { InviteSubmittedCard } from '@/components/invite/InviteSubmittedCard';
import { BrandLogo } from '@/components/BrandLogo';

const formatIcons: Record<string, typeof Coffee> = {
  Coffee: Coffee,
  Drinks: Wine,
  Dinner: UtensilsCrossed,
  Activity: Sparkles,
};

export default function PublicInvite() {
  const { token } = useParams<{ token: string }>();
  const {
    inviteLink,
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
  } = usePublicInvite(token);

  const [selectedSlot, setSelectedSlot] = useState<SlotWithDate | null>(null);
  const [submittedInvite, setSubmittedInvite] = useState<InviteSubmitSuccess | null>(null);

  const timeBucketLabels: Record<string, string> = {
    morning: 'Morning (9 AM - 12 PM)',
    afternoon: 'Afternoon (12 - 5 PM)',
    early_evening: 'Early Evening (5 - 8 PM)',
    late_evening: 'Late Evening (8 PM+)',
  };

  const getFormatIcon = (formatId: string | null) => {
    if (!formatId) return Coffee;
    const format = formats.find(f => f.id === formatId);
    if (!format?.icon_key) return Coffee;
    return formatIcons[format.icon_key] || Coffee;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <nav className="bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
          </div>
        </nav>
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <div className="space-y-4 mt-8">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !inviteLink) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-xl font-bold text-foreground mb-2">
              Link Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              {error || 'This invite link is invalid, expired, or has already been used.'}
            </p>
            <Link to="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submittedInvite) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <nav className="bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
          </div>
        </nav>
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <InviteSubmittedCard
            hostName={profile?.display_name}
            hostHandle={profile?.handle}
            hostCity={profile?.city_label}
            inviteId={submittedInvite.inviteId}
          />
        </div>
      </div>
    );
  }

  if (selectedSlot) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <nav className="bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
          </div>
        </nav>
        <div className="container mx-auto max-w-2xl px-4 py-8">
          <InviteWizard
            slot={selectedSlot}
            screeningConfig={screeningConfig}
            questions={questions}
            formats={formats}
            vibeTags={vibeTags}
            intentTags={intentTags}
            boundaryTags={boundaryTags}
            onSubmit={submitInvite}
            onCancel={() => setSelectedSlot(null)}
            onSuccess={(result) => setSubmittedInvite(result || { success: true })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Navigation */}
      <nav className="bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
        </div>
      </nav>

      {/* Profile Header */}
      <section className="py-12 px-4 bg-card border-b border-border">
        <div className="container mx-auto max-w-2xl text-center">
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              alt={profile.display_name || 'Host'}
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-hero mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl font-display font-bold text-primary-foreground">
                {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {profile?.display_name ? `${profile.display_name}'s Invite Page` : 'Invite Page'}
          </h1>
          {(profile?.age || profile?.city_label) && (
            <p className="text-muted-foreground mb-4">
              {profile.age && `${profile.age}`}
              {profile.age && profile.city_label && ' · '}
              {profile.city_label}
            </p>
          )}
          {profile?.bio_one_liner && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              "{profile.bio_one_liner}"
            </p>
          )}
        </div>
      </section>

      {/* Available Slots */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Available This Week
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Showing the next 7 days. Pick a slot that works for you.
          </p>

          {slots.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No availability this week. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => {
                const FormatIcon = getFormatIcon(slot.format);
                const formatLabel = formats.find(f => f.id === slot.format)?.label || '';
                const intentLabel = intentTags.find(t => t.id === slot.intent_tag)?.label || '';
                const vibeLabels = vibeTags.filter(t => slot.vibe_tags?.includes(t.id)).map(t => t.label);
                const boundaryLabels = boundaryTags.filter(t => slot.boundary_tags?.includes(t.id)).map(t => t.label);

                return (
                  <Card key={`${slot.id}-${slot.targetDate}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FormatIcon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">
                              {slot.dayLabel} · {timeBucketLabels[slot.time_bucket] || slot.time_bucket}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" /> {slot.area_label}
                              {formatLabel && ` · ${formatLabel}`}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {intentLabel && (
                                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                  {intentLabel}
                                </Badge>
                              )}
                              {vibeLabels.map((label) => (
                                <Badge key={label} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              ))}
                              {boundaryLabels.map((label) => (
                                <Badge key={label} variant="outline" className="text-xs border-destructive/30 text-destructive">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Button size="sm" onClick={() => setSelectedSlot(slot)}>
                            Invite
                          </Button>
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-[100px]">
                            Not a commitment—just a signal
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Privacy reassurance */}
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Lock className="h-3 w-3" />
            <span>Your details are private. Only the host sees your answers.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
