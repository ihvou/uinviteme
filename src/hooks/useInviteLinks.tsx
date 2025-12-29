import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type InviteLink = Tables<'invite_links'>;

export type LinkType = 'one_time' | '3_day' | '7_day';

const LINK_CONFIGS: Record<LinkType, { label: string; expiresInDays: number | null; singleUse: boolean }> = {
  one_time: { label: 'One-time link', expiresInDays: null, singleUse: true },
  '3_day': { label: '3-day link', expiresInDays: 3, singleUse: false },
  '7_day': { label: '7-day link', expiresInDays: 7, singleUse: false },
};

export function useInviteLinks(scheduleId: string | null) {
  const [links, setLinks] = useState<Record<LinkType, InviteLink | null>>({
    one_time: null,
    '3_day': null,
    '7_day': null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateToken = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  const createLink = useCallback(async (linkType: LinkType) => {
    if (!scheduleId) return { error: 'No schedule found' };

    const config = LINK_CONFIGS[linkType];
    const token = generateToken();
    const expiresAt = config.expiresInDays
      ? new Date(Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error: insertError } = await supabase
      .from('invite_links')
      .insert({
        schedule_id: scheduleId,
        token,
        type: linkType,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) return { error: insertError.message };

    setLinks((prev) => ({ ...prev, [linkType]: data }));
    return { data };
  }, [scheduleId]);

  const refreshLink = useCallback(async (linkType: LinkType) => {
    if (!scheduleId) return { error: 'No schedule found' };

    // Revoke old link if exists
    const oldLink = links[linkType];
    if (oldLink) {
      await supabase
        .from('invite_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', oldLink.id);
    }

    // Create new link
    return createLink(linkType);
  }, [scheduleId, links, createLink]);

  // Initialize all 3 links on first load
  const initializeLinks = useCallback(async () => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch existing active links grouped by type
    const { data: existingLinks, error: fetchError } = await supabase
      .from('invite_links')
      .select('*')
      .eq('schedule_id', scheduleId)
      .is('used_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const now = new Date();
    const linksByType: Record<LinkType, InviteLink | null> = {
      one_time: null,
      '3_day': null,
      '7_day': null,
    };

    // Find active links for each type
    for (const link of existingLinks || []) {
      const linkType = link.type as LinkType;
      if (!linksByType[linkType]) {
        // Check if link is still valid (not expired)
        if (!link.expires_at || new Date(link.expires_at) > now) {
          linksByType[linkType] = link;
        }
      }
    }

    // Create missing links
    const linkTypes: LinkType[] = ['one_time', '3_day', '7_day'];
    for (const linkType of linkTypes) {
      if (!linksByType[linkType]) {
        const config = LINK_CONFIGS[linkType];
        const token = generateToken();
        const expiresAt = config.expiresInDays
          ? new Date(Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { data } = await supabase
          .from('invite_links')
          .insert({
            schedule_id: scheduleId,
            token,
            type: linkType,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (data) {
          linksByType[linkType] = data;
        }
      }
    }

    setLinks(linksByType);
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => {
    initializeLinks();
  }, [initializeLinks]);

  const getInviteUrl = (token: string) => {
    return `${window.location.origin}/i/${token}`;
  };

  const getPublicProfileUrl = (handle: string | null | undefined) => {
    if (!handle) return null;
    return `${window.location.origin}/invite/${handle}`;
  };

  return {
    links,
    loading,
    error,
    refreshLink,
    getInviteUrl,
    getPublicProfileUrl,
    LINK_CONFIGS,
  };
}