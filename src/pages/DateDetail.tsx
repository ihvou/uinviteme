import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDate, DateUpdateData } from '@/hooks/useDate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, ArrowLeft, Loader2, Shield, Calendar, MapPin, Clock, User, Save, Instagram, Phone, Mail, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  const { dateRecord, loading, error, updateDate, getInvitee } = useDate(dateId);
  
  const [formData, setFormData] = useState<DateUpdateData>({});
  const [saving, setSaving] = useState(false);

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
              <Heart className="h-6 w-6 text-primary" fill="currentColor" />
              <span className="font-display text-xl font-semibold text-foreground">uInvite.Me</span>
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

        <div className="space-y-6">
          {/* Invitee Summary */}
          {invitee && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Meeting With
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-foreground text-lg">{invitee.name}</p>
                {invitee.instagram_handle && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Instagram className="h-4 w-4" />
                    <span>@{invitee.instagram_handle.replace('@', '')}</span>
                  </div>
                )}
                {invitee.telegram_username && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Send className="h-4 w-4" />
                    <span>@{invitee.telegram_username.replace('@', '')}</span>
                  </div>
                )}
                {invitee.phone_e164 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{invitee.phone_e164}</span>
                  </div>
                )}
                {invitee.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{invitee.email}</span>
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="format">Format (optional)</Label>
                <Input
                  id="format"
                  value={formData.format || ''}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value || null })}
                  placeholder="e.g., Drinks, Coffee, Dinner"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intent_tag">Intent (optional)</Label>
                <Input
                  id="intent_tag"
                  value={formData.intent_tag || ''}
                  onChange={(e) => setFormData({ ...formData, intent_tag: e.target.value || null })}
                  placeholder="e.g., Casual, Romantic"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
            <Link to={`/dates/${dateId}/safety`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Shield className="h-4 w-4" />
                Open Safety Pack
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
