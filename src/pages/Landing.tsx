import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Shield, CheckCircle, MessageCircle, Clock, Phone, AlertTriangle, Heart, ArrowRight, Lock } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button>Create my invite page</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="animate-fade-in">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Skip the small talk.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-2 max-w-2xl mx-auto">
              Pre-qualify meetups with a shareable invite page. Show your availability, expectations, and dealbreakers—then activate a Safety Pack when you accept.
            </p>
            <p className="text-sm text-muted-foreground/70 mb-2">
              Share it in DMs or add to your bio to attract invites beyond your matches.
            </p>
            <p className="text-sm text-muted-foreground/70 mb-8">
              Not a dating app. Works with Tinder, Hinge, Instagram—anywhere you chat.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="gap-2 shadow-glow">
                  Create my invite page <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/demo/invite">
                <Button size="lg" variant="outline">
                  See live demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-xl font-semibold text-center text-foreground mb-8">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="font-display font-bold text-primary">1</span>
              </div>
              <p className="text-sm text-muted-foreground">Set your weekly availability, area, and vibe</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="font-display font-bold text-primary">2</span>
              </div>
              <p className="text-sm text-muted-foreground">Share the link in chats or your bio</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="font-display font-bold text-primary">3</span>
              </div>
              <p className="text-sm text-muted-foreground">Accept an invite—Safety Pack activates</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Case 1: Invite Schedule */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Your Week, Your Terms
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Show open slots for the next 7 days—invitees pick one that works.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Set your area and format (coffee, drinks, dinner, activity).</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Tag each slot with vibe and intent—filter for readiness, not just interest.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Surface dealbreakers before meeting—skip the awkward mismatch.</span>
                </li>
              </ul>
              <div className="mt-8">
                <Link to="/demo/invite">
                  <Button variant="outline" className="gap-2">
                    See live demo <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-background rounded-2xl p-8 shadow-lg border border-border">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">M</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Monday Evening</p>
                    <p className="text-xs text-muted-foreground">Drinks · Downtown · Chill vibes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">W</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Wednesday Afternoon</p>
                    <p className="text-xs text-muted-foreground">Coffee · Midtown · Casual chat</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Saturday Morning</p>
                    <p className="text-xs text-muted-foreground">Brunch · Brooklyn · Adventure ready</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Case 2: Date Safety Pack */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-background rounded-2xl p-8 shadow-lg border border-border">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Share date details with trusted contacts</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Check-in reminder at 9:00 PM</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="p-3 bg-success/10 rounded-lg text-center">
                    <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                    <span className="text-xs text-success">All good</span>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-lg text-center">
                    <Phone className="h-5 w-5 text-warning mx-auto mb-1" />
                    <span className="text-xs text-warning">Call me</span>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-lg text-center">
                    <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <span className="text-xs text-destructive">Emergency</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Meet with backup.
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Require phone validation—verify invitees before accepting.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Copy a share-ready message with time, place, and invitee details to a trusted contact.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Get a check-in SMS with discreet links: All good / Call me / Emergency.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Miss check-in? Your trusted contact gets an automatic alert.</span>
                </li>
              </ul>
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>You activate it. You control who knows.</span>
              </div>
              <div className="mt-8">
                <Link to="/demo/safety-pack">
                  <Button variant="outline" className="gap-2">
                    See live demo <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Slimmed down */}
      <section className="py-12 px-4 bg-card border-y border-border">
        <div className="container mx-auto text-center max-w-2xl">
          <p className="text-muted-foreground mb-4">
            Ready in 2 minutes. Share anywhere.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gap-2">
              Create my invite page <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-card">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" fill="currentColor" />
              <span className="font-display font-semibold text-foreground">uInvite.Me</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} uInvite.Me. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
