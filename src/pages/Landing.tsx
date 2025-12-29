import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Shield, Clock, Heart, CheckCircle, ArrowRight } from 'lucide-react';

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
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium mb-6">
              Dating Made Intentional & Safe
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Your Schedule, Your Terms,{' '}
              <span className="text-gradient">Your Peace of Mind</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Create your dating availability, share a secure invite link, and let genuine connections come to you—with built-in safety features for every date.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="gap-2 shadow-glow">
                  Create Your Schedule <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline">
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Dating on Your Terms
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to take control of your dating life while staying safe
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-background rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Weekly Availability</h3>
              <p className="text-muted-foreground">
                Set your weekly date slots—morning coffee, evening drinks, or weekend adventures. You decide when you're open to meeting.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-background rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Safety Pack</h3>
              <p className="text-muted-foreground">
                Share your date details with trusted contacts. Automated check-ins and one-tap emergency alerts for peace of mind.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-background rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Smart Screening</h3>
              <p className="text-muted-foreground">
                Customizable screening questions help filter for compatibility. Auto-decline options save you time on obvious mismatches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
          </div>
          
          <div className="space-y-12">
            {[
              {
                step: '01',
                title: 'Create Your Schedule',
                description: 'Define your weekly availability slots with preferred locations, date formats, and vibes.',
              },
              {
                step: '02',
                title: 'Share Your Link',
                description: 'Post your unique invite link on your dating profile or share it directly with matches.',
              },
              {
                step: '03',
                title: 'Review Invites',
                description: 'See who wants to meet you, review their answers to your screening questions, and accept the best fits.',
              },
              {
                step: '04',
                title: 'Date with Confidence',
                description: 'Activate your Safety Pack before each date. Check-in during, get help instantly if needed.',
              },
            ].map((item, index) => (
              <div key={item.step} className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-display font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-hero">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Date Smarter?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Join thousands of singles who are taking control of their dating lives.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" variant="secondary" className="gap-2">
              Create Your Free Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-card border-t border-border">
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
