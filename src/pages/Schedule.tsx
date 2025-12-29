import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchedule, Slot } from '@/hooks/useSchedule';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Heart, ArrowLeft, Calendar, Plus, Loader2, Pencil, Trash2, Coffee, Wine, Footprints, Utensils, Palette, Activity, Music, Sun, Bike, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlotFormDialog } from '@/components/schedule/SlotFormDialog';
import { toast } from '@/hooks/use-toast';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_BUCKET_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  early_evening: 'Early Eve',
  late_evening: 'Late Eve',
};

const FORMAT_ICONS: Record<string, React.ElementType> = {
  coffee: Coffee,
  wine: Wine,
  footprints: Footprints,
  utensils: Utensils,
  palette: Palette,
  activity: Activity,
  music: Music,
  sun: Sun,
  bike: Bike,
  'more-horizontal': MoreHorizontal,
};

export default function Schedule() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { schedule, slots, formats, vibeTags, loading, error, addSlot, updateSlot, deleteSlot } = useSchedule();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAdd = () => {
    setEditingSlot(null);
    setDialogOpen(true);
  };

  const handleEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setDialogOpen(true);
  };

  const handleDelete = async (slot: Slot) => {
    const result = await deleteSlot(slot.id);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Slot deleted' });
    }
  };

  const handleSubmit = async (data: Parameters<typeof addSlot>[0]) => {
    if (editingSlot) {
      const result = await updateSlot(editingSlot.id, data);
      if (!result.error) {
        toast({ title: 'Slot updated' });
      }
      return result;
    } else {
      const result = await addSlot(data);
      if (!result.error) {
        toast({ title: 'Slot added' });
      }
      return result;
    }
  };

  const getFormatLabel = (formatId: string | null) => {
    if (!formatId) return null;
    const format = formats.find((f) => f.id === formatId);
    if (!format) return null;
    const Icon = FORMAT_ICONS[format.icon_key || 'more-horizontal'] || MoreHorizontal;
    return (
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {format.label}
      </span>
    );
  };

  const getVibeTagLabels = (tagIds: string[] | null) => {
    if (!tagIds || tagIds.length === 0) return null;
    return tagIds
      .map((id) => vibeTags.find((t) => t.id === id)?.label)
      .filter(Boolean);
  };

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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">My Schedule</h1>
              <p className="text-muted-foreground">
                Configure your weekly availability slots
              </p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Slot
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Slots
            </CardTitle>
            <CardDescription>
              Define when you're available for dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">No slots configured yet</p>
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Slot
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Vibe</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">
                        {WEEKDAY_LABELS[slot.weekday]}
                      </TableCell>
                      <TableCell>{TIME_BUCKET_LABELS[slot.time_bucket]}</TableCell>
                      <TableCell>{slot.area_label}</TableCell>
                      <TableCell>{getFormatLabel(slot.format)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getVibeTagLabels(slot.vibe_tags)?.map((label) => (
                            <Badge key={label} variant="secondary" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(slot)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(slot)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <SlotFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slot={editingSlot}
        formats={formats}
        vibeTags={vibeTags}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
