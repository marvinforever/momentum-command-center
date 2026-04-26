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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          booking_goal: number | null
          budget: number | null
          created_at: string | null
          end_date: string | null
          enrollment_goal: number | null
          goal: string | null
          id: string
          lead_goal: number | null
          lead_magnet_id: string | null
          name: string
          notes: string | null
          offer_id: string | null
          primary_channel: string | null
          spend_to_date: number | null
          start_date: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          booking_goal?: number | null
          budget?: number | null
          created_at?: string | null
          end_date?: string | null
          enrollment_goal?: number | null
          goal?: string | null
          id?: string
          lead_goal?: number | null
          lead_magnet_id?: string | null
          name: string
          notes?: string | null
          offer_id?: string | null
          primary_channel?: string | null
          spend_to_date?: number | null
          start_date?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          booking_goal?: number | null
          budget?: number | null
          created_at?: string | null
          end_date?: string | null
          enrollment_goal?: number | null
          goal?: string | null
          id?: string
          lead_goal?: number | null
          lead_magnet_id?: string | null
          name?: string
          notes?: string | null
          offer_id?: string | null
          primary_channel?: string | null
          spend_to_date?: number | null
          start_date?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_metrics: {
        Row: {
          account_label: string | null
          avg_watch_time: string | null
          channel: string | null
          created_at: string | null
          ctr: number | null
          followers_subs: number | null
          id: string
          net_change: number | null
          notes: string | null
          open_rate: number | null
          posts_episodes_released: number | null
          reach_28d: number | null
          snapshot_date: string | null
          watch_time_hrs: number | null
        }
        Insert: {
          account_label?: string | null
          avg_watch_time?: string | null
          channel?: string | null
          created_at?: string | null
          ctr?: number | null
          followers_subs?: number | null
          id?: string
          net_change?: number | null
          notes?: string | null
          open_rate?: number | null
          posts_episodes_released?: number | null
          reach_28d?: number | null
          snapshot_date?: string | null
          watch_time_hrs?: number | null
        }
        Update: {
          account_label?: string | null
          avg_watch_time?: string | null
          channel?: string | null
          created_at?: string | null
          ctr?: number | null
          followers_subs?: number | null
          id?: string
          net_change?: number | null
          notes?: string | null
          open_rate?: number | null
          posts_episodes_released?: number | null
          reach_28d?: number | null
          snapshot_date?: string | null
          watch_time_hrs?: number | null
        }
        Relationships: []
      }
      content: {
        Row: {
          campaign_id: string | null
          channel: string | null
          created_at: string | null
          effect_rating: string | null
          engagement: number | null
          followers_gained: number | null
          format: string | null
          id: string
          key_word: string | null
          leads_attributed: number | null
          link: string | null
          notes: string | null
          profile_views: number | null
          publish_date: string | null
          reach: number | null
          title: string
          topic: string | null
          youtube_channel_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string | null
          effect_rating?: string | null
          engagement?: number | null
          followers_gained?: number | null
          format?: string | null
          id?: string
          key_word?: string | null
          leads_attributed?: number | null
          link?: string | null
          notes?: string | null
          profile_views?: number | null
          publish_date?: string | null
          reach?: number | null
          title: string
          topic?: string | null
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string | null
          effect_rating?: string | null
          engagement?: number | null
          followers_gained?: number | null
          format?: string | null
          id?: string
          key_word?: string | null
          leads_attributed?: number | null
          link?: string | null
          notes?: string | null
          profile_views?: number | null
          publish_date?: string | null
          reach?: number | null
          title?: string
          topic?: string | null
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_youtube_channel_id_fkey"
            columns: ["youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_calls: {
        Row: {
          call_date: string | null
          call_type: string | null
          created_at: string | null
          fit_rating: number | null
          follow_up_actions: string[] | null
          fu_date: string | null
          id: string
          lead_id: string | null
          lead_source: string | null
          location: string | null
          name: string
          notes: string | null
          offer_id: string | null
          role_position: string | null
          status: string | null
        }
        Insert: {
          call_date?: string | null
          call_type?: string | null
          created_at?: string | null
          fit_rating?: number | null
          follow_up_actions?: string[] | null
          fu_date?: string | null
          id?: string
          lead_id?: string | null
          lead_source?: string | null
          location?: string | null
          name: string
          notes?: string | null
          offer_id?: string | null
          role_position?: string | null
          status?: string | null
        }
        Update: {
          call_date?: string | null
          call_type?: string | null
          created_at?: string | null
          fit_rating?: number | null
          follow_up_actions?: string[] | null
          fu_date?: string | null
          id?: string
          lead_id?: string | null
          lead_source?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          offer_id?: string | null
          role_position?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_content: {
        Row: {
          content_id: string
          lead_id: string
        }
        Insert: {
          content_id: string
          lead_id: string
        }
        Update: {
          content_id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_content_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_magnets: {
        Row: {
          created_at: string | null
          description: string | null
          hosted_on: string | null
          id: string
          name: string
          notes: string | null
          sequence_days: number | null
          status: string | null
          total_downloads: number | null
          type: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hosted_on?: string | null
          id?: string
          name: string
          notes?: string | null
          sequence_days?: number | null
          status?: string | null
          total_downloads?: number | null
          type?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hosted_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          sequence_days?: number | null
          status?: string | null
          total_downloads?: number | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email: string | null
          first_touch_date: string | null
          gender: string | null
          how_did_you_hear: string | null
          id: string
          lead_magnet_id: string | null
          lead_source: string | null
          name: string
          notes: string | null
          opt_in: string | null
          phone: string | null
          status: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          first_touch_date?: string | null
          gender?: string | null
          how_did_you_hear?: string | null
          id?: string
          lead_magnet_id?: string | null
          lead_source?: string | null
          name: string
          notes?: string | null
          opt_in?: string | null
          phone?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          first_touch_date?: string | null
          gender?: string | null
          how_did_you_hear?: string | null
          id?: string
          lead_magnet_id?: string | null
          lead_source?: string | null
          name?: string
          notes?: string | null
          opt_in?: string | null
          phone?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          cohort_size: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          price: number | null
          status: string | null
          type: string | null
          url: string | null
        }
        Insert: {
          cohort_size?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          price?: number | null
          status?: string | null
          type?: string | null
          url?: string | null
        }
        Update: {
          cohort_size?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          price?: number | null
          status?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          handle: string | null
          id: string
          name: string
          status: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          handle?: string | null
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          handle?: string | null
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
