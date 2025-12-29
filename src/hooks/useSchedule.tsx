import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Schedule = Tables<'schedules'>;
export type Slot = Tables<'slots'>;
export type SlotInsert = TablesInsert<'slots'>;
export type SlotUpdate = TablesUpdate<'slots'>;

export type CatalogFormat = Tables<'catalog_formats'>;
export type CatalogVibeTag = Tables<'catalog_vibe_tags'>;
export type CatalogIntentTag = Tables<'catalog_intent_tags'>;
export type CatalogBoundaryTag = Tables<'catalog_boundary_tags'>;

export function useSchedule() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [formats, setFormats] = useState<CatalogFormat[]>([]);
  const [vibeTags, setVibeTags] = useState<CatalogVibeTag[]>([]);
  const [intentTags, setIntentTags] = useState<CatalogIntentTag[]>([]);
  const [boundaryTags, setBoundaryTags] = useState<CatalogBoundaryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create schedule
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchSchedule() {
      try {
        // First try to get existing schedule
        const { data: existingSchedule, error: fetchError } = await supabase
          .from('schedules')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingSchedule) {
          setSchedule(existingSchedule);
        } else {
          // Create a new schedule for the user
          const { data: newSchedule, error: createError } = await supabase
            .from('schedules')
            .insert({ user_id: user!.id })
            .select()
            .single();

          if (createError) throw createError;
          setSchedule(newSchedule);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, [user]);

  // Fetch slots when schedule is available
  useEffect(() => {
    if (!schedule) return;

    async function fetchSlots() {
      const { data, error: fetchError } = await supabase
        .from('slots')
        .select('*')
        .eq('schedule_id', schedule!.id)
        .order('weekday', { ascending: true })
        .order('time_bucket', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setSlots(data || []);
      }
    }

    fetchSlots();
  }, [schedule]);

  // Fetch catalogs
  useEffect(() => {
    async function fetchCatalogs() {
      const [formatsRes, vibeTagsRes, intentTagsRes, boundaryTagsRes] = await Promise.all([
        supabase.from('catalog_formats').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('catalog_vibe_tags').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('catalog_intent_tags').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('catalog_boundary_tags').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (formatsRes.data) setFormats(formatsRes.data);
      if (vibeTagsRes.data) setVibeTags(vibeTagsRes.data);
      if (intentTagsRes.data) setIntentTags(intentTagsRes.data);
      if (boundaryTagsRes.data) setBoundaryTags(boundaryTagsRes.data);
    }

    fetchCatalogs();
  }, []);

  const addSlot = async (slot: Omit<SlotInsert, 'schedule_id'>) => {
    if (!schedule) return { error: 'No schedule found' };

    const { data, error: insertError } = await supabase
      .from('slots')
      .insert({ ...slot, schedule_id: schedule.id })
      .select()
      .single();

    if (insertError) return { error: insertError.message };

    setSlots((prev) => [...prev, data].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.time_bucket.localeCompare(b.time_bucket);
    }));

    return { data };
  };

  const updateSlot = async (id: string, updates: SlotUpdate) => {
    const { data, error: updateError } = await supabase
      .from('slots')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) return { error: updateError.message };

    setSlots((prev) =>
      prev.map((s) => (s.id === id ? data : s)).sort((a, b) => {
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return a.time_bucket.localeCompare(b.time_bucket);
      })
    );

    return { data };
  };

  const deleteSlot = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('slots')
      .delete()
      .eq('id', id);

    if (deleteError) return { error: deleteError.message };

    setSlots((prev) => prev.filter((s) => s.id !== id));
    return { success: true };
  };

  return {
    schedule,
    slots,
    formats,
    vibeTags,
    intentTags,
    boundaryTags,
    loading,
    error,
    addSlot,
    updateSlot,
    deleteSlot,
  };
}
