import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type DateRecord = Tables<'dates'>;

export interface InviteeSnapshot {
  name: string;
  phone_e164?: string;
  email?: string;
  instagram_handle?: string;
  telegram_username?: string;
  selfie_url?: string;
}

export interface DateUpdateData {
  date?: string;
  time_bucket?: string;
  time_start?: string | null;
  time_end?: string | null;
  area_label?: string;
  area_place_id?: string | null;
  venue_text?: string | null;
  format?: string | null;
  intent_tag?: string | null;
  vibe_tags?: string[];
  boundary_tags?: string[];
}

export interface CatalogLabels {
  formats: Record<string, string>;
  intents: Record<string, string>;
  vibes: Record<string, string>;
  boundaries: Record<string, string>;
  questions: Record<string, string>;
}

export interface InviteAnswers {
  [questionId: string]: string;
}

export function useDate(dateId: string | undefined) {
  const { user } = useAuth();
  const [dateRecord, setDateRecord] = useState<DateRecord | null>(null);
  const [inviteAnswers, setInviteAnswers] = useState<InviteAnswers | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogLabels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !dateId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);
      setError(null);

      // Fetch date record
      const { data: dateData, error: fetchError } = await supabase
        .from('dates')
        .select('*')
        .eq('id', dateId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      if (!dateData) {
        setError('Date not found');
        setLoading(false);
        return;
      }

      setDateRecord(dateData);

      // Fetch invite answers if invite_id exists
      if (dateData.invite_id) {
        const { data: inviteData } = await supabase
          .from('invites')
          .select('answers')
          .eq('id', dateData.invite_id)
          .maybeSingle();
        
        if (inviteData?.answers) {
          setInviteAnswers(inviteData.answers as unknown as InviteAnswers);
        }
      }

      // Fetch all catalogs for label lookups
      const [formats, intents, vibes, boundaries, questions] = await Promise.all([
        supabase.from('catalog_formats').select('id, label'),
        supabase.from('catalog_intent_tags').select('id, label'),
        supabase.from('catalog_vibe_tags').select('id, label'),
        supabase.from('catalog_boundary_tags').select('id, label'),
        supabase.from('catalog_questions').select('id, label'),
      ]);

      const catalogData: CatalogLabels = {
        formats: {},
        intents: {},
        vibes: {},
        boundaries: {},
        questions: {},
      };

      formats.data?.forEach(f => { catalogData.formats[f.id] = f.label; });
      intents.data?.forEach(i => { catalogData.intents[i.id] = i.label; });
      vibes.data?.forEach(v => { catalogData.vibes[v.id] = v.label; });
      boundaries.data?.forEach(b => { catalogData.boundaries[b.id] = b.label; });
      questions.data?.forEach(q => { catalogData.questions[q.id] = q.label; });

      setCatalogs(catalogData);
      setLoading(false);
    }

    fetchData();
  }, [user, dateId]);

  const updateDate = useCallback(async (updates: DateUpdateData) => {
    if (!dateId || !user) return { error: 'Not authenticated' };

    const { data, error: updateError } = await supabase
      .from('dates')
      .update(updates)
      .eq('id', dateId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    setDateRecord(data);
    return { error: null };
  }, [dateId, user]);

  const getInvitee = useCallback((): InviteeSnapshot | null => {
    if (!dateRecord) return null;
    return dateRecord.invitee_snapshot as unknown as InviteeSnapshot;
  }, [dateRecord]);

  const getFormatLabel = useCallback((id: string | null): string | null => {
    if (!id || !catalogs) return null;
    return catalogs.formats[id] || null;
  }, [catalogs]);

  const getIntentLabel = useCallback((id: string | null): string | null => {
    if (!id || !catalogs) return null;
    return catalogs.intents[id] || null;
  }, [catalogs]);

  const getVibeLabels = useCallback((ids: string[] | null): string[] => {
    if (!ids || !catalogs) return [];
    return ids.map(id => catalogs.vibes[id]).filter(Boolean);
  }, [catalogs]);

  const getBoundaryLabels = useCallback((ids: string[] | null): string[] => {
    if (!ids || !catalogs) return [];
    return ids.map(id => catalogs.boundaries[id]).filter(Boolean);
  }, [catalogs]);

  const getAnswersWithLabels = useCallback((): { question: string; answer: string }[] => {
    if (!inviteAnswers || !catalogs) return [];
    return Object.entries(inviteAnswers).map(([qId, answer]) => ({
      question: catalogs.questions[qId] || qId,
      answer: String(answer),
    }));
  }, [inviteAnswers, catalogs]);

  return {
    dateRecord,
    loading,
    error,
    updateDate,
    getInvitee,
    getFormatLabel,
    getIntentLabel,
    getVibeLabels,
    getBoundaryLabels,
    getAnswersWithLabels,
    catalogs,
  };
}
