import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, ArrowLeft, Calendar, MapPin, Coffee, Wine, Sun } from 'lucide-react';

export default function DemoInvite() {
  const demoSlots = [
    {
      id: '1',
      day: 'Monday',
      time: 'Evening (6-9 PM)',
      area: 'Downtown',
      format: 'Drinks',
      vibes: ['Chill', 'Getting to know you'],
      icon: Wine,
    },
    {
      id: '2',
      day: 'Wednesday',
      time: 'Afternoon (2-5 PM)',
      area: 'Midtown',
      format: 'Coffee',
      vibes: ['Casual', 'Quick meet'],
      icon: Coffee,
    },
    {
      id: '3',
      day: 'Saturday',
      time: 'Morning (10 AM-1 PM)',
      area: 'Brooklyn',
      format: 'Brunch',
      vibes: ['Adventure', 'Weekend energy'],
      icon: Sun,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Demo Banner */}
      <div className="bg-warning text-warning-foreground text-center py-2 px-4 text-sm font-medium">
        🎭 DEMO — not a real profile. Submissions are sandboxed.
      </div>

      {/* Navigation */}
      <nav className="bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Profile Header */}
      <section className="py-12 px-4 bg-card border-b border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-hero mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-primary-foreground">JD</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Jamie's Invite Page
          </h1>
          <p className="text-muted-foreground mb-4">
            28 · NYC · Looking for genuine connections
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            "I'm over endless texting. If we vibe, let's grab a drink and see where it goes. Swipe right if you're ready to actually meet!"
          </p>
        </div>
      </section>

      {/* Available Slots */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Available This Week
          </h2>

          <div className="space-y-4">
            {demoSlots.map((slot) => {
              const Icon = slot.icon;
              return (
                <Card key={slot.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">
                            {slot.day} · {slot.time}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {slot.area} · {slot.format}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {slot.vibes.map((vibe) => (
                              <Badge key={vibe} variant="secondary" className="text-xs">
                                {vibe}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="sm">Request</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-secondary/30 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-3">
              In the real flow, clicking "Request" opens the invite wizard with screening questions.
            </p>
            <Link to="/auth?mode=signup">
              <Button className="gap-2">
                Create your own invite page
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
