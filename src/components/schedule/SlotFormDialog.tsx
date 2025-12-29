import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slot, SlotInsert, CatalogFormat, CatalogVibeTag } from '@/hooks/useSchedule';
import { Coffee, Wine, Footprints, Utensils, Palette, Activity, Music, Sun, Bike, MoreHorizontal } from 'lucide-react';

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_BUCKETS = [
  { value: 'morning', label: 'Morning (before noon)' },
  { value: 'afternoon', label: 'Afternoon (12-5pm)' },
  { value: 'early_evening', label: 'Early Evening (5-8pm)' },
  { value: 'late_evening', label: 'Late Evening (after 8pm)' },
];

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

interface SlotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot?: Slot | null;
  formats: CatalogFormat[];
  vibeTags: CatalogVibeTag[];
  onSubmit: (data: Omit<SlotInsert, 'schedule_id'>) => Promise<{ error?: string }>;
}

export function SlotFormDialog({
  open,
  onOpenChange,
  slot,
  formats,
  vibeTags,
  onSubmit,
}: SlotFormDialogProps) {
  const [weekday, setWeekday] = useState<number>(1);
  const [timeBucket, setTimeBucket] = useState<string>('early_evening');
  const [areaLabel, setAreaLabel] = useState<string>('');
  const [format, setFormat] = useState<string | null>(null);
  const [selectedVibeTags, setSelectedVibeTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/slot changes
  useEffect(() => {
    if (open) {
      if (slot) {
        setWeekday(slot.weekday);
        setTimeBucket(slot.time_bucket);
        setAreaLabel(slot.area_label);
        setFormat(slot.format);
        setSelectedVibeTags(slot.vibe_tags || []);
      } else {
        setWeekday(1);
        setTimeBucket('early_evening');
        setAreaLabel('');
        setFormat(null);
        setSelectedVibeTags([]);
      }
      setError(null);
    }
  }, [open, slot]);

  const toggleVibeTag = (tagId: string) => {
    setSelectedVibeTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!areaLabel.trim()) {
      setError('Please enter a neighborhood/area');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await onSubmit({
      weekday,
      time_bucket: timeBucket,
      area_label: areaLabel.trim(),
      format,
      vibe_tags: selectedVibeTags,
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slot ? 'Edit Slot' : 'Add Availability Slot'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Weekday */}
          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Bucket */}
          <div className="space-y-2">
            <Label>Time of Day</Label>
            <Select value={timeBucket} onValueChange={setTimeBucket}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_BUCKETS.map((bucket) => (
                  <SelectItem key={bucket.value} value={bucket.value}>
                    {bucket.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Area */}
          <div className="space-y-2">
            <Label>Neighborhood / Area</Label>
            <Input
              value={areaLabel}
              onChange={(e) => setAreaLabel(e.target.value)}
              placeholder="e.g., Downtown, Williamsburg, The Mission"
            />
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {formats.map((f) => {
                const Icon = FORMAT_ICONS[f.icon_key || 'more-horizontal'] || MoreHorizontal;
                const isSelected = format === f.id;
                return (
                  <Button
                    key={f.id}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormat(isSelected ? null : f.id)}
                    className="gap-1"
                  >
                    <Icon className="h-4 w-4" />
                    {f.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Vibe Tags */}
          <div className="space-y-2">
            <Label>Vibe Tags (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {vibeTags.map((tag) => {
                const isSelected = selectedVibeTags.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleVibeTag(tag.id)}
                  >
                    {tag.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : slot ? 'Update' : 'Add Slot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
