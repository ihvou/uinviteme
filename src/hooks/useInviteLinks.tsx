import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type InviteLink = Tables<'invite_links'>;

export function useInviteLinks(scheduleId: string | null) {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }

    async function fetchLinks() {
      const { data, error: fetchError } = await supabase
        .from('invite_links')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setLinks(data || []);
      }
      setLoading(false);
    }

    fetchLinks();
  }, [scheduleId]);

  const generateToken = () => {
    // Generate a URL-safe random token
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  const createLink = async (type: 'public' | 'private' = 'public', expiresInDays?: number) => {
    if (!scheduleId) return { error: 'No schedule found' };

    const token = generateToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error: insertError } = await supabase
      .from('invite_links')
      .insert({
        schedule_id: scheduleId,
        token,
        type,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) return { error: insertError.message };

    setLinks((prev) => [data, ...prev]);
    return { data };
  };

  const revokeLink = async (id: string) => {
    const { error: updateError } = await supabase
      .from('invite_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) return { error: updateError.message };

    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, used_at: new Date().toISOString() } : link
      )
    );
    return { success: true };
  };

  const deleteLink = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('invite_links')
      .delete()
      .eq('id', id);

    if (deleteError) return { error: deleteError.message };

    setLinks((prev) => prev.filter((link) => link.id !== id));
    return { success: true };
  };

  const getInviteUrl = (token: string) => {
    return `${window.location.origin}/i/${token}`;
  };

  return {
    links,
    loading,
    error,
    createLink,
    revokeLink,
    deleteLink,
    getInviteUrl,
  };
}
