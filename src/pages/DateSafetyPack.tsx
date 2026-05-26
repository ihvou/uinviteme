import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDate } from '@/hooks/useDate';
import { useSafetyPack } from '@/hooks/useSafetyPack';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Loader2, Shield, Copy, Clock, CheckCircle,
  Phone, AlertTriangle, MapPin, Calendar, User, ChevronDown, ChevronUp,
  Pause, Square, Info
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { format, addMinutes, parse, setHours, setMinutes } from 'date-fns';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';

export default function DateSafetyPack() {
  const { dateId } = useParams<{ dateId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { dateRecord, loading: dateLoading, getInvitee } = useDate(dateId);
  const { 
    safetyPack, loading: packLoading, error,
    activate, pause, end, updateCheckinTime,
    isActive, isPaused, isDraft, isCompleted
  } = useSafetyPack(dateId);
  
  const [showActions, setShowActions] = useState(false);
  const [checkinTime, setCheckinTime] = useState('21:00');
  const [graceMinutes, setGraceMinutes] = useState(30);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (safetyPack?.default_checkin_at) {
      const checkinDate = new Date(safetyPack.default_checkin_at);
      setCheckinTime(format(checkinDate, 'HH:mm'));
    }
    if (safetyPack?.grace_minutes) {
      setGraceMinutes(safetyPack.grace_minutes);
    }
  }, [safetyPack]);

  const handleActivate = async () => {
    // Save check-in time first
    const dateOfDate = dateRecord?.date ? new Date(dateRecord.date) : new Date();
    const [hours, mins] = checkinTime.split(':').map(Number);
    const checkinAt = setMinutes(setHours(dateOfDate, hours), mins);
    
    await updateCheckinTime(checkinAt, graceMinutes);
    
    const { error: activateError } = await activate();
    if (activateError) {
      toast.error('Failed to activate Safety Pack');
    } else {
      toast.success('Safety Pack activated!');
    }
  };

  const handlePause = async () => {
    const { error: pauseError } = await pause();
    if (pauseError) {
      toast.error('Failed to pause Safety Pack');
    } else {
      toast.info('Safety Pack paused');
    }
  };

  const handleEnd = async () => {
    const { error: endError } = await end();
    if (endError) {
      toast.error('Failed to end Safety Pack');
    } else {
      toast.success('Safety Pack completed');
    }
  };

  const handleSaveCheckin = async () => {
    const dateOfDate = dateRecord?.date ? new Date(dateRecord.date) : new Date();
    const [hours, mins] = checkinTime.split(':').map(Number);
    const checkinAt = setMinutes(setHours(dateOfDate, hours), mins);
    
    const { error: updateError } = await updateCheckinTime(checkinAt, graceMinutes);
    if (updateError) {
      toast.error('Failed to update check-in time');
    } else {
      toast.success('Check-in time updated');
    }
  };

  const generateShareMessage = () => {
    if (!dateRecord || !getInvitee()) return '';
    const invitee = getInvitee()!;
    const dateStr = format(new Date(dateRecord.date), 'EEE MMM d');
    const escalationTime = checkinTime ? format(
      addMinutes(parse(checkinTime, 'HH:mm', new Date()), graceMinutes),
      'h:mm a'
    ) : '';
    
    return `📍 I'm going on a date!
Who: ${invitee.name}
When: ${dateStr}, ${checkinTime ? format(parse(checkinTime, 'HH:mm', new Date()), 'h:mm a') : 'TBD'}
Where: ${dateRecord.venue_text || dateRecord.area_label}

I'll check in by ${checkinTime ? format(parse(checkinTime, 'HH:mm', new Date()), 'h:mm a') : 'TBD'}. If you don't hear from me by ${escalationTime}, please call.`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateShareMessage());
    toast.success('Message copied to clipboard!');
  };

  const loading = authLoading || dateLoading || packLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dateRecord) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to="/dates" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error || 'Date not found'}</p>
            <Link to="/dates">
              <Button variant="outline" className="mt-4">Back to Dates</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const invitee = getInvitee();
  const escalationTime = checkinTime ? format(
    addMinutes(parse(checkinTime, 'HH:mm', new Date()), graceMinutes),
    'h:mm a'
  ) : '';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
        </div>
      </header>

      {/* Safety Pack Header */}
      <section className="py-6 px-4 bg-card border-b border-border">
        <div className="container mx-auto max-w-2xl">
          <Link to="/dates" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dates
          </Link>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Date Details</h1>
            </div>
            <Badge 
              variant={isActive ? "default" : isPaused ? "secondary" : isCompleted ? "outline" : "secondary"} 
              className={isActive ? "bg-success text-success-foreground" : ""}
            >
              {isActive ? "Active" : isPaused ? "Paused" : isCompleted ? "Completed" : "Draft"}
            </Badge>
          </div>
          
          {/* Tabs for Details / Safety Pack */}
          <Tabs value="safety" onValueChange={(val) => val === 'details' && navigate(`/dates/${dateId}`)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="gap-2">
                <Calendar className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="safety" className="gap-2">
                <Shield className="h-4 w-4" />
                Safety Pack
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <p className="text-muted-foreground mt-4 text-sm">
            {isDraft && "Draft is created automatically. Activation is manual."}
            {isActive && "Safety Pack is active. You can pause anytime."}
            {isPaused && "Safety Pack is paused. Reactivate when ready."}
            {isCompleted && "This Safety Pack has been completed."}
          </p>
        </div>
      </section>

      {/* Safety Pack Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-2xl space-y-6">
          
          {/* Block A: Safety Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Safety Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Meet in a public place for your first date</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Share your date details with a trusted friend or family member</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Arrange your own transportation to and from the venue</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Trust your instincts—if something feels off, leave</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Date Details Summary */}
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
                <span className="text-foreground">Meeting: <strong>{invitee?.name || 'Unknown'}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{format(new Date(dateRecord.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{dateRecord.venue_text || dateRecord.area_label}</span>
              </div>
            </CardContent>
          </Card>

          {/* Block B: Share with Trusted Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Copy className="h-5 w-5 text-primary" />
                Share with Trusted Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground mb-4 whitespace-pre-line">
                {generateShareMessage()}
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
                <Copy className="h-4 w-4" /> Copy message
              </Button>
            </CardContent>
          </Card>

          {/* Block C: Check-in Time */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Check-in Reminder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-secondary/50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkin_time">Check-in time</Label>
                    <Input
                      id="checkin_time"
                      type="time"
                      value={checkinTime}
                      onChange={(e) => setCheckinTime(e.target.value)}
                      disabled={isActive || isCompleted}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grace_minutes">Grace period (min)</Label>
                    <Input
                      id="grace_minutes"
                      type="number"
                      min={10}
                      max={60}
                      value={graceMinutes}
                      onChange={(e) => setGraceMinutes(Number(e.target.value))}
                      disabled={isActive || isCompleted}
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Escalation at</span>
                    <span className="font-medium text-destructive">{escalationTime}</span>
                  </div>
                </div>
                {isDraft && (
                  <Button variant="outline" size="sm" onClick={handleSaveCheckin}>
                    Save Check-in Settings
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Check-in arrives via SMS with small links. If you don't check in by the escalation time, we'll notify your trusted contacts.
              </p>
            </CardContent>
          </Card>

          {/* Block D: Discreet SMS Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Discreet SMS Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You'll receive quiet SMS links you can tap during your date—no visible buttons needed.
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
                    <div className="p-4 bg-success/10 rounded-xl text-center">
                      <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                      <span className="text-sm font-medium text-success">All good</span>
                      <p className="text-xs text-muted-foreground mt-1">Check in OK</p>
                    </div>
                    <div className="p-4 bg-warning/10 rounded-xl text-center">
                      <Phone className="h-8 w-8 text-warning mx-auto mb-2" />
                      <span className="text-sm font-medium text-warning">Call me</span>
                      <p className="text-xs text-muted-foreground mt-1">Need an exit</p>
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-xl text-center">
                      <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <span className="text-sm font-medium text-destructive">Emergency</span>
                      <p className="text-xs text-muted-foreground mt-1">Alert contacts</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Activation Controls */}
          {!isCompleted && (
            <Card className={isActive ? "border-success/50 bg-success/5" : ""}>
              <CardContent className="p-6">
                {isDraft && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Ready for your date? Activate to enable reminders and escalation.
                    </p>
                    <Button size="lg" className="gap-2" onClick={handleActivate}>
                      <Shield className="h-4 w-4" /> Activate Safety Pack
                    </Button>
                  </div>
                )}
                {isActive && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-success mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Safety Pack is active</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Reminder scheduled. Escalation at {escalationTime} if no check-in.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" size="sm" onClick={handlePause} className="gap-2">
                        <Pause className="h-4 w-4" /> Pause
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleEnd} className="gap-2">
                        <Square className="h-4 w-4" /> End
                      </Button>
                    </div>
                  </div>
                )}
                {isPaused && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Safety Pack is paused. Reactivate when you're ready.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button size="sm" onClick={handleActivate} className="gap-2">
                        <Shield className="h-4 w-4" /> Reactivate
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleEnd} className="gap-2">
                        <Square className="h-4 w-4" /> End
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isCompleted && (
            <Card className="border-muted">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="font-medium text-foreground">Safety Pack Completed</p>
                <p className="text-sm text-muted-foreground">This date's safety pack has been ended.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
