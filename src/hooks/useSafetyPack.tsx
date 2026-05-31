import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type SafetyPack = Tables<'date_safety_packs'>;

export function useSafetyPack(dateId: string | undefined) {
  const { user } = useAuth();
  const [safetyPack, setSafetyPack] = useState<SafetyPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !dateId) {
      setLoading(false);
      return;
    }

    async function fetchOrCreatePack() {
      setLoading(true);
      setError(null);

      // Try to fetch existing pack
      const { data: existingPack, error: fetchError } = await supabase
        .from('date_safety_packs')
        .select('*')
        .eq('date_id', dateId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (existingPack) {
        setSafetyPack(existingPack);
        setLoading(false);
        return;
      }

      // Create new pack (draft) with tokens
      const { data: newPack, error: createError } = await supabase
        .from('date_safety_packs')
        .insert({
          date_id: dateId,
          status: 'draft',
          grace_minutes: 30,
        })
        .select()
        .single();

      if (createError) {
        setError(createError.message);
      } else {
        setSafetyPack(newPack);
      }
      setLoading(false);
    }

    fetchOrCreatePack();
  }, [user, dateId]);

  const activate = useCallback(async (checkinAt?: Date, graceMinutes?: number, shareMessage?: string) => {
    if (!dateId) return { error: 'No date' };

    const defaultCheckinAt = checkinAt?.toISOString() ||
      safetyPack?.default_checkin_at ||
      new Date().toISOString();

    const { data, error: invokeError } = await supabase.functions.invoke('activate-safety-pack', {
      body: {
        dateId,
        checkinAt: defaultCheckinAt,
        graceMinutes: graceMinutes ?? safetyPack?.grace_minutes ?? 30,
        shareMessage: shareMessage ?? safetyPack?.share_message ?? null,
      },
    });

    if (invokeError) {
      return { error: invokeError.message };
    }

    setSafetyPack(data.pack);
    return { error: null };
  }, [dateId, safetyPack]);

  const pause = useCallback(async () => {
    if (!safetyPack) return { error: 'No safety pack' };

    const { data, error: updateError } = await supabase
      .from('date_safety_packs')
      .update({
        status: 'paused',
      })
      .eq('id', safetyPack.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    setSafetyPack(data);
    return { error: null };
  }, [safetyPack]);

  const end = useCallback(async () => {
    if (!safetyPack) return { error: 'No safety pack' };

    const { data, error: updateError } = await supabase
      .from('date_safety_packs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', safetyPack.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    setSafetyPack(data);
    return { error: null };
  }, [safetyPack]);

  const updateCheckinTime = useCallback(async (checkinAt: Date, graceMinutes?: number) => {
    if (!safetyPack) return { error: 'No safety pack' };

    const updates: Partial<SafetyPack> = {
      default_checkin_at: checkinAt.toISOString(),
    };

    if (graceMinutes !== undefined) {
      updates.grace_minutes = graceMinutes;
    }

    const { data, error: updateError } = await supabase
      .from('date_safety_packs')
      .update(updates)
      .eq('id', safetyPack.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    setSafetyPack(data);
    return { error: null };
  }, [safetyPack]);

  const updateShareMessage = useCallback(async (message: string) => {
    if (!safetyPack) return { error: 'No safety pack' };

    const { data, error: updateError } = await supabase
      .from('date_safety_packs')
      .update({ share_message: message })
      .eq('id', safetyPack.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    setSafetyPack(data);
    return { error: null };
  }, [safetyPack]);

  return {
    safetyPack,
    loading,
    error,
    activate,
    pause,
    end,
    updateCheckinTime,
    updateShareMessage,
    isActive: safetyPack?.status === 'active',
    isPaused: safetyPack?.status === 'paused',
    isCompleted: safetyPack?.status === 'completed',
    isDraft: safetyPack?.status === 'draft',
  };
}
