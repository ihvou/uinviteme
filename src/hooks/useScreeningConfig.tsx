import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchedule } from '@/hooks/useSchedule';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type ScreeningConfig = Tables<'screening_configs'>;
export type CatalogQuestion = Tables<'catalog_questions'>;

export interface AutoDeclineRule {
  questionId: string;
  declineOnAnswers: string[];
}

export function useScreeningConfig() {
  const { schedule } = useSchedule();
  const [config, setConfig] = useState<ScreeningConfig | null>(null);
  const [questions, setQuestions] = useState<CatalogQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch catalog questions
  useEffect(() => {
    async function fetchQuestions() {
      const { data, error: fetchError } = await supabase
        .from('catalog_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setQuestions(data || []);
      }
    }

    fetchQuestions();
  }, []);

  // Fetch or create screening config when schedule is available
  useEffect(() => {
    if (!schedule) {
      setLoading(false);
      return;
    }

    async function fetchConfig() {
      try {
        // Try to get existing config
        const { data: existingConfig, error: fetchError } = await supabase
          .from('screening_configs')
          .select('*')
          .eq('schedule_id', schedule!.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingConfig) {
          setConfig(existingConfig);
        } else {
          // Create default config
          const { data: newConfig, error: createError } = await supabase
            .from('screening_configs')
            .insert({
              schedule_id: schedule!.id,
              require_phone: true,
              require_selfie: false,
              allow_instagram: true,
              allow_telegram: true,
              allow_invitee_note: true,
              enabled_questions: [],
              auto_decline_rules: {},
            })
            .select()
            .single();

          if (createError) throw createError;
          setConfig(newConfig);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load screening config');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [schedule]);

  const updateConfig = async (updates: Partial<TablesUpdate<'screening_configs'>>) => {
    if (!config) return { error: 'No config found' };

    const { data, error: updateError } = await supabase
      .from('screening_configs')
      .update(updates)
      .eq('id', config.id)
      .select()
      .single();

    if (updateError) return { error: updateError.message };

    setConfig(data);
    return { data };
  };

  // Helper to toggle a question's enabled state
  const toggleQuestion = async (questionId: string) => {
    if (!config) return { error: 'No config found' };

    const currentEnabled = (config.enabled_questions as string[]) || [];
    const newEnabled = currentEnabled.includes(questionId)
      ? currentEnabled.filter((id) => id !== questionId)
      : [...currentEnabled, questionId];

    return updateConfig({ enabled_questions: newEnabled });
  };

  // Helper to set auto-decline rules for a question
  const setAutoDeclineRule = async (questionId: string, declineOnAnswers: string[]) => {
    if (!config) return { error: 'No config found' };

    const currentRules = (config.auto_decline_rules as Record<string, string[]>) || {};
    const newRules = { ...currentRules };

    if (declineOnAnswers.length > 0) {
      newRules[questionId] = declineOnAnswers;
    } else {
      delete newRules[questionId];
    }

    return updateConfig({ auto_decline_rules: newRules });
  };

  // Helper to get enabled questions with their data
  const getEnabledQuestions = () => {
    const enabledIds = (config?.enabled_questions as string[]) || [];
    return questions.filter((q) => enabledIds.includes(q.id));
  };

  // Helper to get auto-decline rules
  const getAutoDeclineRules = (): Record<string, string[]> => {
    return (config?.auto_decline_rules as Record<string, string[]>) || {};
  };

  return {
    config,
    questions,
    loading,
    error,
    updateConfig,
    toggleQuestion,
    setAutoDeclineRule,
    getEnabledQuestions,
    getAutoDeclineRules,
  };
}
