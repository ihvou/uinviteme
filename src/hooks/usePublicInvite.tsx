import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { addDays, format, getDay } from 'date-fns';
import { getFunctionErrorMessage } from '@/lib/functionError';

export type InviteLink = Tables<'invite_links'>;
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

export function usePublicInvite(token: string | undefined) {
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
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
    if (!token) {
      setLoading(false);
      setError('Invalid invite link');
      return;
    }

    async function fetchInviteData() {
      try {
        // Fetch invite link by token
        const { data: linkData, error: linkError } = await supabase
          .from('invite_links')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (linkError) throw linkError;
        if (!linkData) {
          setError('Invite link not found or expired');
          setLoading(false);
          return;
        }

        setInviteLink(linkData);

        // Get schedule to check if active
        const { data: scheduleData } = await supabase
          .from('schedules')
          .select('user_id, is_active')
          .eq('id', linkData.schedule_id)
          .single();

        // Check if schedule is active
        if (!scheduleData?.is_active) {
          setError('This schedule is currently inactive');
          setLoading(false);
          return;
        }

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
            .eq('schedule_id', linkData.schedule_id)
            .eq('is_active', true)
            .order('weekday')
            .order('time_bucket'),
          supabase
            .from('screening_configs')
            .select('*')
            .eq('schedule_id', linkData.schedule_id)
            .maybeSingle(),
          supabase.from('catalog_formats').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_vibe_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_intent_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_boundary_tags').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('catalog_questions').select('*').eq('is_active', true).order('sort_order'),
        ]);

        if (scheduleData) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', scheduleData.user_id)
            .maybeSingle();
          
          if (profileData) setProfile(profileData);
        }

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
  }, [token]);

  const submitInvite = async (data: {
    slotId: string;
    targetDate: string;
    inviteeData: {
      name: string;
      phone_e164?: string;
      phone_verified?: boolean;
      email?: string;
      instagram_handle?: string;
      telegram_username?: string;
      selfie_url?: string;
    };
    answers: Record<string, unknown>;
    inviteeNote?: string;
    phoneVerificationId?: string;
    phoneVerificationCode?: string;
  }) => {
    if (!inviteLink) return { error: 'No invite link' };

    try {
      const { data: response, error: submitError } = await supabase.functions.invoke('submit-invite', {
        body: {
          inviteLinkId: inviteLink.id,
          slotId: data.slotId,
          targetDate: data.targetDate,
          inviteeData: data.inviteeData,
          answers: data.answers,
          inviteeNote: data.inviteeNote,
          phoneVerificationId: data.phoneVerificationId,
          phoneVerificationCode: data.phoneVerificationCode,
        },
      });

      if (submitError) throw new Error(await getFunctionErrorMessage(submitError));
      if (response?.error) throw new Error(response.error);

      return {
        data: {
          success: true,
          inviteId: response?.inviteId,
          inviteeId: response?.inviteeId,
        },
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to submit invite' };
    }
  };

  return {
    inviteLink,
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
