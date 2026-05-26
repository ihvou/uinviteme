import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDate, DateUpdateData } from '@/hooks/useDate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Loader2, Shield, Calendar, MapPin, Clock,
  User, Save, Instagram, Phone, Mail, Send, MessageSquare
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';

const timeBucketOptions = [
  { value: 'morning', label: 'Morning (8am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-5pm)' },
  { value: 'evening', label: 'Evening (5pm-9pm)' },
  { value: 'late_evening', label: 'Late Evening (9pm+)' },
];

export default function DateDetail() {
  const { dateId } = useParams<{ dateId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { 
    dateRecord, loading, error, updateDate, getInvitee,
    getFormatLabel, getIntentLabel, getVibeLabels, getBoundaryLabels,
    getAnswersWithLabels, catalogs
  } = useDate(dateId);
  
  const [formData, setFormData] = useState<DateUpdateData>({});
  const [saving, setSaving] = useState(false);
  
  // Determine active tab from URL
  const isSafetyTab = location.pathname.endsWith('/safety');
  const activeTab = isSafetyTab ? 'safety' : 'details';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (dateRecord) {
      setFormData({
        date: dateRecord.date,
        time_bucket: dateRecord.time_bucket,
        time_start: dateRecord.time_start,
        time_end: dateRecord.time_end,
        area_label: dateRecord.area_label,
        venue_text: dateRecord.venue_text,
        format: dateRecord.format,
        intent_tag: dateRecord.intent_tag,
      });
    }
  }, [dateRecord]);

  const handleSave = async () => {
    setSaving(true);
    const { error: saveError } = await updateDate(formData);
    setSaving(false);

    if (saveError) {
      toast.error('Failed to update date');
    } else {
      toast.success('Date updated');
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'safety') {
      navigate(`/dates/${dateId}/safety`);
    } else {
      navigate(`/dates/${dateId}`);
    }
  };

  if (authLoading || loading) {
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
  const answers = getAnswersWithLabels();
  const vibeLabels = getVibeLabels(dateRecord.vibe_tags);
  const boundaryLabels = getBoundaryLabels(dateRecord.boundary_tags);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link to="/dates" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dates
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Date Details</h1>
              <p className="text-muted-foreground text-sm">
                Update details anytime. Safety Pack message updates accordingly.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              {dateRecord.status}
            </Badge>
          </div>
        </div>

        {/* Tabs for Details / Safety Pack */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
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

        <div className="space-y-6">
          {/* Compact Invitee Summary */}
          {invitee && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Selfie / Avatar */}
                  <Avatar className="h-16 w-16 flex-shrink-0">
                    {invitee.selfie_url ? (
                      <AvatarImage src={invitee.selfie_url} alt={invitee.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {invitee.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-lg">{invitee.name}</h3>
                    </div>
                    
                    {/* Social links - clickable */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {invitee.instagram_handle && (
                        <a 
                          href={`https://instagram.com/${invitee.instagram_handle.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Instagram className="h-4 w-4" />
                          @{invitee.instagram_handle.replace('@', '')}
                        </a>
                      )}
                      {invitee.telegram_username && (
                        <a 
                          href={`https://t.me/${invitee.telegram_username.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Send className="h-4 w-4" />
                          @{invitee.telegram_username.replace('@', '')}
                        </a>
                      )}
                      {invitee.phone_e164 && (
                        <a 
                          href={`tel:${invitee.phone_e164}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          {invitee.phone_e164}
                        </a>
                      )}
                      {invitee.email && (
                        <a 
                          href={`mailto:${invitee.email}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Mail className="h-4 w-4" />
                          {invitee.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Screening Answers */}
                {answers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Screening Responses</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {answers.map((a, idx) => (
                        <div key={idx}>
                          <span className="text-muted-foreground">{a.question}:</span>{' '}
                          <span className="text-foreground font-medium">{a.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Editable Date Fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Date & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time_bucket">Time</Label>
                  <Select
                    value={formData.time_bucket}
                    onValueChange={(val) => setFormData({ ...formData, time_bucket: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeBucketOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time_start">Exact Start (optional)</Label>
                  <Input
                    id="time_start"
                    type="time"
                    value={formData.time_start || ''}
                    onChange={(e) => setFormData({ ...formData, time_start: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time_end">Exact End (optional)</Label>
                  <Input
                    id="time_end"
                    type="time"
                    value={formData.time_end || ''}
                    onChange={(e) => setFormData({ ...formData, time_end: e.target.value || null })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="area_label">Area</Label>
                <Input
                  id="area_label"
                  value={formData.area_label || ''}
                  onChange={(e) => setFormData({ ...formData, area_label: e.target.value })}
                  placeholder="e.g., Downtown, Midtown"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue_text">Venue (optional)</Label>
                <Input
                  id="venue_text"
                  value={formData.venue_text || ''}
                  onChange={(e) => setFormData({ ...formData, venue_text: e.target.value || null })}
                  placeholder="e.g., The Tipsy Crow"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Format & Vibe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={formData.format || ''}
                    onValueChange={(val) => setFormData({ ...formData, format: val || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs && Object.entries(catalogs.formats).map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intent</Label>
                  <Select
                    value={formData.intent_tag || ''}
                    onValueChange={(val) => setFormData({ ...formData, intent_tag: val || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select intent" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs && Object.entries(catalogs.intents).map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Display current vibes and boundaries as badges */}
              {(vibeLabels.length > 0 || boundaryLabels.length > 0) && (
                <div className="pt-2 space-y-2">
                  {vibeLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">Vibes:</span>
                      {vibeLabels.map((label, idx) => (
                        <Badge key={idx} variant="secondary">{label}</Badge>
                      ))}
                    </div>
                  )}
                  {boundaryLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">Boundaries:</span>
                      {boundaryLabels.map((label, idx) => (
                        <Badge key={idx} variant="outline">{label}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </main>
    </div>
  );
}
