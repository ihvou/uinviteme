import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, ArrowLeft, Shield, Copy, Clock, CheckCircle, Phone, AlertTriangle, MapPin, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

export default function DemoSafetyPack() {
  const handleCopy = () => {
    toast.success('Demo: Message copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Demo Banner */}
      <div className="bg-warning text-warning-foreground text-center py-2 px-4 text-sm font-medium">
        🎭 DEMO — not a real Safety Pack. Links are static.
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

      {/* Header */}
      <section className="py-8 px-4 bg-card border-b border-border">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-accent" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Date Safety Pack
            </h1>
          </div>
          <p className="text-muted-foreground">
            Your personal safety net for every date. Activate before you go, check in during, get help if needed.
          </p>
        </div>
      </section>

      {/* Safety Pack Sections */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-2xl space-y-6">
          
          {/* Section 1: Date Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Date Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Meeting: <strong>Alex from Hinge</strong></span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Wednesday, Jan 15 · 7:00 PM</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">The Tipsy Crow · Downtown</span>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Share with Trusted Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Copy className="h-5 w-5 text-primary" />
                Share with Trusted Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground mb-4">
                <p className="mb-2">📍 I'm going on a date!</p>
                <p className="mb-2">Who: Alex from Hinge</p>
                <p className="mb-2">When: Wed Jan 15, 7:00 PM</p>
                <p className="mb-2">Where: The Tipsy Crow, Downtown</p>
                <p>I'll check in by 9:00 PM. If you don't hear from me, please call.</p>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
                <Copy className="h-4 w-4" /> Copy message
              </Button>
            </CardContent>
          </Card>

          {/* Section 3: Check-in Time */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Check-in Reminder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Default check-in</p>
                  <p className="text-sm text-muted-foreground">We'll remind you to check in</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-primary">9:00 PM</p>
                  <p className="text-xs text-muted-foreground">Editable</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                If you don't check in within the grace period, we'll send an escalation SMS to your trusted contacts.
              </p>
            </CardContent>
          </Card>

          {/* Section 4: Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Discreet SMS Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                One-tap links sent via SMS. Click during your date if needed.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <button className="p-4 bg-success/10 hover:bg-success/20 rounded-xl text-center transition-colors">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <span className="text-sm font-medium text-success">All good</span>
                  <p className="text-xs text-muted-foreground mt-1">Check in OK</p>
                </button>
                <button className="p-4 bg-warning/10 hover:bg-warning/20 rounded-xl text-center transition-colors">
                  <Phone className="h-8 w-8 text-warning mx-auto mb-2" />
                  <span className="text-sm font-medium text-warning">Call me</span>
                  <p className="text-xs text-muted-foreground mt-1">Need an exit</p>
                </button>
                <button className="p-4 bg-destructive/10 hover:bg-destructive/20 rounded-xl text-center transition-colors">
                  <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <span className="text-sm font-medium text-destructive">Emergency</span>
                  <p className="text-xs text-muted-foreground mt-1">Alert contacts</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="p-4 bg-secondary/30 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Every accepted date includes a Safety Pack. Create your account to get started.
            </p>
            <Link to="/auth?mode=signup">
              <Button className="gap-2">
                Create my invite page
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
