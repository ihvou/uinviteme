export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      catalog_boundary_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      catalog_formats: {
        Row: {
          created_at: string | null
          icon_key: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      catalog_intent_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      catalog_presets: {
        Row: {
          created_at: string | null
          default_auto_decline_rules: Json | null
          enabled_question_ids: Json | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          default_auto_decline_rules?: Json | null
          enabled_question_ids?: Json | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          default_auto_decline_rules?: Json | null
          enabled_question_ids?: Json | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      catalog_questions: {
        Row: {
          answers_json: Json | null
          auto_decline_supported: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          type: string
        }
        Insert: {
          answers_json?: Json | null
          auto_decline_supported?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          type: string
        }
        Update: {
          answers_json?: Json | null
          auto_decline_supported?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          type?: string
        }
        Relationships: []
      }
      catalog_vibe_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      checkin_events: {
        Row: {
          created_at: string | null
          id: string
          kind: string
          pack_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: string
          pack_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_events_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "date_safety_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      date_safety_packs: {
        Row: {
          activated_at: string | null
          call_token: string | null
          completed_at: string | null
          created_at: string | null
          date_id: string
          default_checkin_at: string | null
          emergency_token: string | null
          grace_minutes: number | null
          id: string
          ok_token: string | null
          share_message: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          call_token?: string | null
          completed_at?: string | null
          created_at?: string | null
          date_id: string
          default_checkin_at?: string | null
          emergency_token?: string | null
          grace_minutes?: number | null
          id?: string
          ok_token?: string | null
          share_message?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          call_token?: string | null
          completed_at?: string | null
          created_at?: string | null
          date_id?: string
          default_checkin_at?: string | null
          emergency_token?: string | null
          grace_minutes?: number | null
          id?: string
          ok_token?: string | null
          share_message?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "date_safety_packs_date_id_fkey"
            columns: ["date_id"]
            isOneToOne: true
            referencedRelation: "dates"
            referencedColumns: ["id"]
          },
        ]
      }
      dates: {
        Row: {
          area_label: string
          area_place_id: string | null
          boundary_tags: string[] | null
          created_at: string | null
          date: string
          format: string | null
          id: string
          intent_tag: string | null
          invite_id: string | null
          invitee_snapshot: Json
          pay_pref: string | null
          status: string | null
          time_bucket: string
          time_end: string | null
          time_start: string | null
          updated_at: string | null
          user_id: string
          venue_text: string | null
          vibe_tags: string[] | null
        }
        Insert: {
          area_label: string
          area_place_id?: string | null
          boundary_tags?: string[] | null
          created_at?: string | null
          date: string
          format?: string | null
          id?: string
          intent_tag?: string | null
          invite_id?: string | null
          invitee_snapshot: Json
          pay_pref?: string | null
          status?: string | null
          time_bucket: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          user_id: string
          venue_text?: string | null
          vibe_tags?: string[] | null
        }
        Update: {
          area_label?: string
          area_place_id?: string | null
          boundary_tags?: string[] | null
          created_at?: string | null
          date?: string
          format?: string | null
          id?: string
          intent_tag?: string | null
          invite_id?: string | null
          invitee_snapshot?: Json
          pay_pref?: string | null
          status?: string | null
          time_bucket?: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          user_id?: string
          venue_text?: string | null
          vibe_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "dates_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_invites: {
        Row: {
          answers: Json | null
          created_at: string | null
          id: string
          invitee_data: Json
          slot_snapshot: Json
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          id?: string
          invitee_data: Json
          slot_snapshot: Json
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          id?: string
          invitee_data?: Json
          slot_snapshot?: Json
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          schedule_id: string
          token: string
          type: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_id: string
          token: string
          type: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_id?: string
          token?: string
          type?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      invitees: {
        Row: {
          created_at: string | null
          email: string | null
          height_cm: number | null
          id: string
          instagram_handle: string | null
          name: string
          occupation: string | null
          phone_e164: string | null
          phone_verified: boolean | null
          selfie_url: string | null
          telegram_username: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          height_cm?: number | null
          id?: string
          instagram_handle?: string | null
          name: string
          occupation?: string | null
          phone_e164?: string | null
          phone_verified?: boolean | null
          selfie_url?: string | null
          telegram_username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          height_cm?: number | null
          id?: string
          instagram_handle?: string | null
          name?: string
          occupation?: string | null
          phone_e164?: string | null
          phone_verified?: boolean | null
          selfie_url?: string | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          answers: Json | null
          created_at: string | null
          decided_at: string | null
          id: string
          invite_link_id: string | null
          invitee_id: string
          invitee_note: string | null
          moderation_status: string | null
          schedule_id: string
          slot_id: string
          status: string | null
          target_date: string
          updated_at: string | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          decided_at?: string | null
          id?: string
          invite_link_id?: string | null
          invitee_id: string
          invitee_note?: string | null
          moderation_status?: string | null
          schedule_id: string
          slot_id: string
          status?: string | null
          target_date: string
          updated_at?: string | null
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          decided_at?: string | null
          id?: string
          invite_link_id?: string | null
          invitee_id?: string
          invitee_note?: string | null
          moderation_status?: string | null
          schedule_id?: string
          slot_id?: string
          status?: string | null
          target_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_invite_link_id_fkey"
            columns: ["invite_link_id"]
            isOneToOne: false
            referencedRelation: "invite_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "invitees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string | null
          email: string | null
          id: string
          invitee_id: string | null
          payload_json: Json | null
          phone_e164: string | null
          provider_message_id: string | null
          status: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          email?: string | null
          id?: string
          invitee_id?: string | null
          payload_json?: Json | null
          phone_e164?: string | null
          provider_message_id?: string | null
          status?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          email?: string | null
          id?: string
          invitee_id?: string | null
          payload_json?: Json | null
          phone_e164?: string | null
          provider_message_id?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "invitees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          bio_one_liner: string | null
          city_label: string | null
          country_code: string | null
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string
          locale: string | null
          notify_channel: string | null
          photo_url: string | null
          public_profile_enabled: boolean | null
          region_mode: string | null
          timezone: string | null
          trusted_contacts_phones: Json | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          bio_one_liner?: string | null
          city_label?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id: string
          locale?: string | null
          notify_channel?: string | null
          photo_url?: string | null
          public_profile_enabled?: boolean | null
          region_mode?: string | null
          timezone?: string | null
          trusted_contacts_phones?: Json | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          bio_one_liner?: string | null
          city_label?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          locale?: string | null
          notify_channel?: string | null
          photo_url?: string | null
          public_profile_enabled?: boolean | null
          region_mode?: string | null
          timezone?: string | null
          trusted_contacts_phones?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          mode: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mode?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mode?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      screening_configs: {
        Row: {
          allow_instagram: boolean | null
          allow_invitee_note: boolean | null
          allow_telegram: boolean | null
          auto_decline_rules: Json | null
          created_at: string | null
          enabled_questions: Json | null
          id: string
          require_phone: boolean | null
          require_selfie: boolean | null
          require_social_link: boolean | null
          schedule_id: string
          updated_at: string | null
        }
        Insert: {
          allow_instagram?: boolean | null
          allow_invitee_note?: boolean | null
          allow_telegram?: boolean | null
          auto_decline_rules?: Json | null
          created_at?: string | null
          enabled_questions?: Json | null
          id?: string
          require_phone?: boolean | null
          require_selfie?: boolean | null
          require_social_link?: boolean | null
          schedule_id: string
          updated_at?: string | null
        }
        Update: {
          allow_instagram?: boolean | null
          allow_invitee_note?: boolean | null
          allow_telegram?: boolean | null
          auto_decline_rules?: Json | null
          created_at?: string | null
          enabled_questions?: Json | null
          id?: string
          require_phone?: boolean | null
          require_selfie?: boolean | null
          require_social_link?: boolean | null
          schedule_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_configs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          area_label: string
          area_lat: number | null
          area_lng: number | null
          area_place_id: string | null
          boundary_tags: string[] | null
          created_at: string | null
          format: string | null
          id: string
          intent_tag: string | null
          is_active: boolean | null
          notes: string | null
          pay_pref: string | null
          schedule_id: string
          time_bucket: string
          time_end: string | null
          time_start: string | null
          updated_at: string | null
          vibe_tags: string[] | null
          weekday: number
        }
        Insert: {
          area_label: string
          area_lat?: number | null
          area_lng?: number | null
          area_place_id?: string | null
          boundary_tags?: string[] | null
          created_at?: string | null
          format?: string | null
          id?: string
          intent_tag?: string | null
          is_active?: boolean | null
          notes?: string | null
          pay_pref?: string | null
          schedule_id: string
          time_bucket: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          vibe_tags?: string[] | null
          weekday: number
        }
        Update: {
          area_label?: string
          area_lat?: number | null
          area_lng?: number | null
          area_place_id?: string | null
          boundary_tags?: string[] | null
          created_at?: string | null
          format?: string | null
          id?: string
          intent_tag?: string | null
          is_active?: boolean | null
          notes?: string | null
          pay_pref?: string | null
          schedule_id?: string
          time_bucket?: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          vibe_tags?: string[] | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "slots_format_fkey"
            columns: ["format"]
            isOneToOne: false
            referencedRelation: "catalog_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_intent_tag_fkey"
            columns: ["intent_tag"]
            isOneToOne: false
            referencedRelation: "catalog_intent_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_connections: {
        Row: {
          created_at: string | null
          id: string
          invitee_id: string | null
          is_active: boolean | null
          telegram_chat_id: string
          telegram_username: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          is_active?: boolean | null
          telegram_chat_id: string
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          is_active?: boolean | null
          telegram_chat_id?: string
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_connections_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "invitees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_schedule_owner_if_public: {
        Args: { schedule_id: string }
        Returns: string
      }
      is_public_profile: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
