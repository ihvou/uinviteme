import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, Json } from '@/integrations/supabase/types';
import { addDays, format, getDay } from 'date-fns';

export type Slot = Tables<'slots'>;
export type Profile = Tables<'profiles'>;
export type ScreeningConfig = Tables<'screening_configs'>;
export type CatalogFormat = Tables<'catalog_formats'>;
export type CatalogVibeTag = Tables<'catalog_vibe_tags'>;
export type CatalogIntentTag = Tables<'catalog_intent_tags'>;
export type CatalogBoundaryTag = Tables<'catalog_boundary_tags'>;
export type CatalogQuestion = Tables<'catalog_questions'>;

export interface SlotWithDate extends Slot {
  targetDate: string;
  dayLabel: string;
}

export function usePublicInviteByHandle(handle: string | undefined) {
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<SlotWithDate[]>([]);
  const [screeningConfig, setScreeningConfig] = useState<ScreeningConfig | null>(null);
  const [formats, setFormats] = useState<CatalogFormat[]>([]);
  const [vibeTags, setVibeTags] = useState<CatalogVibeTag[]>([]);
  const [intentTags, setIntentTags] = useState<CatalogIntentTag[]>([]);
  const [boundaryTags, setBoundaryTags] = useState<CatalogBoundaryTag[]>([]);
  const [questions, setQuestions] = useState<CatalogQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setError('Invalid handle');
      return;
    }

    async function fetchInviteData() {
      try {
        // Fetch profile by handle
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('handle', handle.toLowerCase())
          .eq('public_profile_enabled', true)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profileData) {
          setError('Profile not found');
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch schedule for this user
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('id, is_active')
          .eq('user_id', profileData.id)
          .maybeSingle();

        if (scheduleError) throw scheduleError;
        if (!scheduleData) {
          setError('No schedule found');
          setLoading(false);
          return;
        }

        // Check if schedule is active
        if (!scheduleData.is_active) {
          setError('This schedule is currently inactive');
          setLoading(false);
          return;
        }

        setScheduleId(scheduleData.id);

        // Fetch all related data in parallel
        const [
          slotsRes,
          screeningRes,
          formatsRes,
          vibeTagsRes,
          intentTagsRes,
          boundaryTagsRes,
          questionsRes,
        ] = await Promise.all([
          supabase
            .from('slots')
            .select('*')
            .eq('schedule_id', scheduleData.id)
            .eq('is_active', true)
            .order('weekday')
            .order('time_bucket'),
          supabase
            .from('screening_configs')
            .select('*')
            .eq('schedule_id', scheduleData.id)
            .maybeSingle(),
          supabase.from('catalog_formats').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_vibe_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_intent_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_boundary_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_questions').select('*').eq('is_active', true).order('sort_order'),
        ]);

        // Process slots to add target dates for next 7 days
        const today = new Date();
        const slotsWithDates: SlotWithDate[] = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        if (slotsRes.data) {
          for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const weekday = getDay(date);
            
            const matchingSlots = slotsRes.data.filter(s => s.weekday === weekday);
            matchingSlots.forEach(slot => {
              slotsWithDates.push({
                ...slot,
                targetDate: format(date, 'yyyy-MM-dd'),
                dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[weekday],
              });
            });
          }
        }

        setSlots(slotsWithDates);
        if (screeningRes.data) setScreeningConfig(screeningRes.data);
        if (formatsRes.data) setFormats(formatsRes.data);
        if (vibeTagsRes.data) setVibeTags(vibeTagsRes.data);
        if (intentTagsRes.data) setIntentTags(intentTagsRes.data);
        if (boundaryTagsRes.data) setBoundaryTags(boundaryTagsRes.data);
        if (questionsRes.data) setQuestions(questionsRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    fetchInviteData();
  }, [handle]);

  const submitInvite = async (data: {
    slotId: string;
    targetDate: string;
    inviteeData: {
      name: string;
      phone_e164?: string;
      email?: string;
      instagram_handle?: string;
      telegram_username?: string;
      selfie_url?: string;
    };
    answers: Record<string, unknown>;
    inviteeNote?: string;
  }) => {
    if (!scheduleId) return { error: 'No schedule found' };

    try {
      // Create invitee record (avoid SELECT/RETURNING to keep anon inserts simple under RLS)
      const inviteeId = crypto.randomUUID();
      const { error: inviteeError } = await supabase
        .from('invitees')
        .insert({
          id: inviteeId,
          name: data.inviteeData.name,
          phone_e164: data.inviteeData.phone_e164,
          email: data.inviteeData.email,
          instagram_handle: data.inviteeData.instagram_handle,
          telegram_username: data.inviteeData.telegram_username,
        });

      if (inviteeError) throw inviteeError;

      // Create invite record
      const inviteData = {
        schedule_id: scheduleId,
        slot_id: data.slotId,
        invitee_id: inviteeId,
        target_date: data.targetDate,
        answers: data.answers as Json,
        invitee_note: data.inviteeNote || null,
        status: 'pending',
      };
      
      const { error: inviteError } = await supabase
        .from('invites')
        .insert([inviteData]);

      if (inviteError) throw inviteError;

      return { data: { success: true } };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to submit invite' };
    }
  };

  return {
    scheduleId,
    profile,
    slots,
    screeningConfig,
    formats,
    vibeTags,
    intentTags,
    boundaryTags,
    questions,
    loading,
    error,
    submitInvite,
  };
}
