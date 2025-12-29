import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, ArrowLeft, Shield, Copy, Clock, CheckCircle, Phone, AlertTriangle, MapPin, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function DemoSafetyPack() {
  const [isActivated, setIsActivated] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const handleCopy = () => {
    toast.success('Demo: Message copied to clipboard!');
  };

  const handleActivate = () => {
    setIsActivated(true);
    toast.success('Demo: Safety Pack activated!');
  };

  const handleDeactivate = () => {
    setIsActivated(false);
    toast.info('Demo: Safety Pack deactivated');
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-accent" />
              <h1 className="font-display text-2xl font-bold text-foreground">
                Date Safety Pack
              </h1>
            </div>
            <Badge variant={isActivated ? "default" : "secondary"} className={isActivated ? "bg-success text-success-foreground" : ""}>
              {isActivated ? "Active" : "Not activated"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Your personal safety net for every date. Nothing is sent until you activate.
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
                <p>I'll check in by 9:00 PM. If you don't hear from me by 9:30, please call.</p>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
                <Copy className="h-4 w-4" /> Copy message
              </Button>
            </CardContent>
          </Card>

          {/* Section 3: Check-in Time with explicit grace period */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Check-in Reminder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Check-in time</p>
                    <p className="text-sm text-muted-foreground">We'll remind you to check in</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-primary">9:00 PM</p>
                    <p className="text-xs text-muted-foreground">Editable</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Grace period</span>
                    <span className="font-medium text-foreground">30 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Escalation at</span>
                    <span className="font-medium text-destructive">9:30 PM</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                If you don't check in by the escalation time, we'll notify your trusted contacts.
              </p>
            </CardContent>
          </Card>

          {/* Section 4: Quick Actions - Collapsible */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Discreet SMS Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                In the real flow, you'll receive quiet SMS links you can tap during your date—no visible buttons needed.
              </p>
              
              <Collapsible open={showActions} onOpenChange={setShowActions}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2">
                    {showActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showActions ? "Hide actions preview" : "Show actions preview"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-3 gap-3 mt-4">
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
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Activation CTA */}
          <Card className={isActivated ? "border-success/50 bg-success/5" : ""}>
            <CardContent className="p-6">
              {!isActivated ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Ready for your date? Activate to enable reminders and escalation.
                  </p>
                  <Button size="lg" className="gap-2" onClick={handleActivate}>
                    <Shield className="h-4 w-4" /> Activate for tonight
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-success mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Safety Pack is active</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reminder scheduled for 9:00 PM. Escalation at 9:30 PM if no check-in.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleDeactivate}>
                    Deactivate
                  </Button>
                </div>
              )}
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
