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

export function useDate(dateId: string | undefined) {
  const { user } = useAuth();
  const [dateRecord, setDateRecord] = useState<DateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !dateId) {
      setLoading(false);
      return;
    }

    async function fetchDate() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('dates')
        .select('*')
        .eq('id', dateId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
      } else if (!data) {
        setError('Date not found');
      } else {
        setDateRecord(data);
      }
      setLoading(false);
    }

    fetchDate();
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

  return {
    dateRecord,
    loading,
    error,
    updateDate,
    getInvitee,
  };
}
