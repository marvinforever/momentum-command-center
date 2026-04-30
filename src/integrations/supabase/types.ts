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
      approval_feedback: {
        Row: {
          brand_id: string | null
          id: string
          optimization_output_id: string | null
          output_content: string | null
          output_type: string | null
          rated_at: string | null
          rated_by_user_email: string | null
          rating: string
          reason: string | null
          thumbnail_generation_id: string | null
        }
        Insert: {
          brand_id?: string | null
          id?: string
          optimization_output_id?: string | null
          output_content?: string | null
          output_type?: string | null
          rated_at?: string | null
          rated_by_user_email?: string | null
          rating: string
          reason?: string | null
          thumbnail_generation_id?: string | null
        }
        Update: {
          brand_id?: string | null
          id?: string
          optimization_output_id?: string | null
          output_content?: string | null
          output_type?: string | null
          rated_at?: string | null
          rated_by_user_email?: string | null
          rating?: string
          reason?: string | null
          thumbnail_generation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_feedback_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_feedback_optimization_output_id_fkey"
            columns: ["optimization_output_id"]
            isOneToOne: false
            referencedRelation: "optimization_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_feedback_thumbnail_generation_id_fkey"
            columns: ["thumbnail_generation_id"]
            isOneToOne: false
            referencedRelation: "thumbnail_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_queue: {
        Row: {
          assigned_to_user_email: string | null
          brand_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          opportunity_score: number | null
          priority_rank: number | null
          reasons: Json | null
          status: string | null
          youtube_video_id: string
        }
        Insert: {
          assigned_to_user_email?: string | null
          brand_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          opportunity_score?: number | null
          priority_rank?: number | null
          reasons?: Json | null
          status?: string | null
          youtube_video_id: string
        }
        Update: {
          assigned_to_user_email?: string | null
          brand_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          opportunity_score?: number | null
          priority_rank?: number | null
          reasons?: Json | null
          status?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_queue_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_voice_profiles: {
        Row: {
          approved_description_examples: Json | null
          approved_thumbnail_text_examples: Json | null
          approved_title_examples: Json | null
          audience_profile: string | null
          banned_phrases: Json | null
          brand_id: string
          brand_promises: string | null
          created_at: string | null
          id: string
          preferred_cta_styles: Json | null
          rejected_title_examples: Json | null
          required_phrases: Json | null
          source_documents: Json | null
          thumbnail_style_rules: string | null
          tone_descriptors: Json | null
          updated_at: string | null
          voice_summary: string | null
        }
        Insert: {
          approved_description_examples?: Json | null
          approved_thumbnail_text_examples?: Json | null
          approved_title_examples?: Json | null
          audience_profile?: string | null
          banned_phrases?: Json | null
          brand_id: string
          brand_promises?: string | null
          created_at?: string | null
          id?: string
          preferred_cta_styles?: Json | null
          rejected_title_examples?: Json | null
          required_phrases?: Json | null
          source_documents?: Json | null
          thumbnail_style_rules?: string | null
          tone_descriptors?: Json | null
          updated_at?: string | null
          voice_summary?: string | null
        }
        Update: {
          approved_description_examples?: Json | null
          approved_thumbnail_text_examples?: Json | null
          approved_title_examples?: Json | null
          audience_profile?: string | null
          banned_phrases?: Json | null
          brand_id?: string
          brand_promises?: string | null
          created_at?: string | null
          id?: string
          preferred_cta_styles?: Json | null
          rejected_title_examples?: Json | null
          required_phrases?: Json | null
          source_documents?: Json | null
          thumbnail_style_rules?: string | null
          tone_descriptors?: Json | null
          updated_at?: string | null
          voice_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_voice_profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_color_accent: string | null
          brand_color_primary: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          primary_youtube_channel_id: string | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          brand_color_accent?: string | null
          brand_color_primary?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          primary_youtube_channel_id?: string | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_color_accent?: string | null
          brand_color_primary?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          primary_youtube_channel_id?: string | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_primary_youtube_channel_id_fkey"
            columns: ["primary_youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived: boolean
          booking_goal: number | null
          budget: number | null
          color: string | null
          created_at: string | null
          data_source: string
          data_source_config: Json
          end_date: string | null
          enrollment_goal: number | null
          goal: string | null
          id: string
          lead_goal: number | null
          lead_magnet_id: string | null
          name: string
          notes: string | null
          offer_id: string | null
          pipeline_stages: Json
          primary_channel: string | null
          spend_to_date: number | null
          start_date: string | null
          status: string | null
          type: string | null
          webhook_token: string | null
        }
        Insert: {
          archived?: boolean
          booking_goal?: number | null
          budget?: number | null
          color?: string | null
          created_at?: string | null
          data_source?: string
          data_source_config?: Json
          end_date?: string | null
          enrollment_goal?: number | null
          goal?: string | null
          id?: string
          lead_goal?: number | null
          lead_magnet_id?: string | null
          name: string
          notes?: string | null
          offer_id?: string | null
          pipeline_stages?: Json
          primary_channel?: string | null
          spend_to_date?: number | null
          start_date?: string | null
          status?: string | null
          type?: string | null
          webhook_token?: string | null
        }
        Update: {
          archived?: boolean
          booking_goal?: number | null
          budget?: number | null
          color?: string | null
          created_at?: string | null
          data_source?: string
          data_source_config?: Json
          end_date?: string | null
          enrollment_goal?: number | null
          goal?: string | null
          id?: string
          lead_goal?: number | null
          lead_magnet_id?: string | null
          name?: string
          notes?: string | null
          offer_id?: string | null
          pipeline_stages?: Json
          primary_channel?: string | null
          spend_to_date?: number | null
          start_date?: string | null
          status?: string | null
          type?: string | null
          webhook_token?: string | null
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
      captivate_episode_downloads_daily: {
        Row: {
          captivate_episode_id: string
          captivate_show_id: string
          created_at: string
          downloads: number | null
          id: string
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          captivate_episode_id: string
          captivate_show_id: string
          created_at?: string
          downloads?: number | null
          id?: string
          snapshot_date: string
          updated_at?: string
        }
        Update: {
          captivate_episode_id?: string
          captivate_show_id?: string
          created_at?: string
          downloads?: number | null
          id?: string
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      captivate_episodes: {
        Row: {
          artwork_url: string | null
          audio_url: string | null
          captivate_episode_id: string
          captivate_show_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          episode_number: number | null
          episode_type: string | null
          episode_url: string | null
          id: string
          last_synced_at: string | null
          published_date: string | null
          raw: Json | null
          season_number: number | null
          show_uuid: string | null
          status: string | null
          title: string
          total_downloads: number | null
          updated_at: string
        }
        Insert: {
          artwork_url?: string | null
          audio_url?: string | null
          captivate_episode_id: string
          captivate_show_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          episode_type?: string | null
          episode_url?: string | null
          id?: string
          last_synced_at?: string | null
          published_date?: string | null
          raw?: Json | null
          season_number?: number | null
          show_uuid?: string | null
          status?: string | null
          title: string
          total_downloads?: number | null
          updated_at?: string
        }
        Update: {
          artwork_url?: string | null
          audio_url?: string | null
          captivate_episode_id?: string
          captivate_show_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          episode_type?: string | null
          episode_url?: string | null
          id?: string
          last_synced_at?: string | null
          published_date?: string | null
          raw?: Json | null
          season_number?: number | null
          show_uuid?: string | null
          status?: string | null
          title?: string
          total_downloads?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captivate_episodes_show_uuid_fkey"
            columns: ["show_uuid"]
            isOneToOne: false
            referencedRelation: "captivate_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      captivate_show_metrics_daily: {
        Row: {
          captivate_show_id: string
          created_at: string
          geography: Json | null
          id: string
          raw: Json | null
          snapshot_date: string
          sources: Json | null
          total_downloads: number | null
          total_subscribers: number | null
          updated_at: string
        }
        Insert: {
          captivate_show_id: string
          created_at?: string
          geography?: Json | null
          id?: string
          raw?: Json | null
          snapshot_date: string
          sources?: Json | null
          total_downloads?: number | null
          total_subscribers?: number | null
          updated_at?: string
        }
        Update: {
          captivate_show_id?: string
          created_at?: string
          geography?: Json | null
          id?: string
          raw?: Json | null
          snapshot_date?: string
          sources?: Json | null
          total_downloads?: number | null
          total_subscribers?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      captivate_shows: {
        Row: {
          artwork_url: string | null
          captivate_show_id: string
          created_at: string
          description: string | null
          id: string
          itunes_url: string | null
          last_synced_at: string | null
          link: string | null
          raw: Json | null
          spotify_url: string | null
          title: string
          total_subscribers: number | null
          updated_at: string
        }
        Insert: {
          artwork_url?: string | null
          captivate_show_id: string
          created_at?: string
          description?: string | null
          id?: string
          itunes_url?: string | null
          last_synced_at?: string | null
          link?: string | null
          raw?: Json | null
          spotify_url?: string | null
          title: string
          total_subscribers?: number | null
          updated_at?: string
        }
        Update: {
          artwork_url?: string | null
          captivate_show_id?: string
          created_at?: string
          description?: string | null
          id?: string
          itunes_url?: string | null
          last_synced_at?: string | null
          link?: string | null
          raw?: Json | null
          spotify_url?: string | null
          title?: string
          total_subscribers?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      captivate_sync_runs: {
        Row: {
          download_rows_synced: number | null
          episodes_synced: number | null
          error: string | null
          finished_at: string | null
          id: string
          shows_synced: number | null
          started_at: string
          success: boolean | null
          triggered_by: string | null
        }
        Insert: {
          download_rows_synced?: number | null
          episodes_synced?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          shows_synced?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
        }
        Update: {
          download_rows_synced?: number | null
          episodes_synced?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          shows_synced?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
        }
        Relationships: []
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
      clients: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_activity: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activity_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_follow_ups: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_follow_ups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived: boolean
          campaign_id: string | null
          client_id: string | null
          company: string | null
          created_at: string
          email: string | null
          external_id: string | null
          external_source: string | null
          id: string
          last_touch_at: string | null
          name: string
          next_followup_at: string | null
          notes_summary: string | null
          owner: string | null
          phone: string | null
          role: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          campaign_id?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_touch_at?: string | null
          name: string
          next_followup_at?: string | null
          notes_summary?: string | null
          owner?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          campaign_id?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_touch_at?: string | null
          name?: string
          next_followup_at?: string | null
          notes_summary?: string | null
          owner?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          notion_page_id: string | null
          notion_synced_at: string | null
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
          notion_page_id?: string | null
          notion_synced_at?: string | null
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
          notion_page_id?: string | null
          notion_synced_at?: string | null
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
      kajabi_form_submissions: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          form_name: string | null
          id: string
          kajabi_form_id: string | null
          kajabi_submission_id: string
          lead_id: string | null
          lead_magnet_id: string | null
          raw: Json | null
          submitted_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          form_name?: string | null
          id?: string
          kajabi_form_id?: string | null
          kajabi_submission_id: string
          lead_id?: string | null
          lead_magnet_id?: string | null
          raw?: Json | null
          submitted_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          form_name?: string | null
          id?: string
          kajabi_form_id?: string | null
          kajabi_submission_id?: string
          lead_id?: string | null
          lead_magnet_id?: string | null
          raw?: Json | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kajabi_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kajabi_form_submissions_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
        ]
      }
      kajabi_purchases: {
        Row: {
          amount_cents: number | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string | null
          currency: string | null
          id: string
          kajabi_offer_id: string | null
          kajabi_purchase_id: string
          lead_id: string | null
          offer_id: string | null
          offer_name: string | null
          purchased_at: string | null
          raw: Json | null
          refunded_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          kajabi_offer_id?: string | null
          kajabi_purchase_id: string
          lead_id?: string | null
          offer_id?: string | null
          offer_name?: string | null
          purchased_at?: string | null
          raw?: Json | null
          refunded_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          kajabi_offer_id?: string | null
          kajabi_purchase_id?: string
          lead_id?: string | null
          offer_id?: string | null
          offer_name?: string | null
          purchased_at?: string | null
          raw?: Json | null
          refunded_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kajabi_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kajabi_purchases_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      kajabi_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          received_at: string | null
          signature_valid: boolean
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
          signature_valid: boolean
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
          signature_valid?: boolean
        }
        Relationships: []
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
          kajabi_contact_id: string | null
          kajabi_synced_at: string | null
          lead_magnet_id: string | null
          lead_source: string | null
          name: string
          notes: string | null
          notion_page_id: string | null
          notion_synced_at: string | null
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
          kajabi_contact_id?: string | null
          kajabi_synced_at?: string | null
          lead_magnet_id?: string | null
          lead_source?: string | null
          name: string
          notes?: string | null
          notion_page_id?: string | null
          notion_synced_at?: string | null
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
          kajabi_contact_id?: string | null
          kajabi_synced_at?: string | null
          lead_magnet_id?: string | null
          lead_source?: string | null
          name?: string
          notes?: string | null
          notion_page_id?: string | null
          notion_synced_at?: string | null
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
      linkedin_posts: {
        Row: {
          account_label: string | null
          created_at: string
          followers_gained: number | null
          id: string
          impressions: number | null
          key_word: string | null
          link: string | null
          post_date: string | null
          post_type: string | null
          profile_views: number | null
          reach: number | null
          reactions: number | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          key_word?: string | null
          link?: string | null
          post_date?: string | null
          post_type?: string | null
          profile_views?: number | null
          reach?: number | null
          reactions?: number | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          key_word?: string | null
          link?: string | null
          post_date?: string | null
          post_type?: string | null
          profile_views?: number | null
          reach?: number | null
          reactions?: number | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      linkedin_weekly_metrics: {
        Row: {
          account_label: string | null
          created_at: string
          followers_gained: number | null
          followers_total: number | null
          id: string
          impressions: number | null
          profile_views: number | null
          reach: number | null
          reactions: number | null
          updated_at: string
          week_ending: string | null
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          followers_gained?: number | null
          followers_total?: number | null
          id?: string
          impressions?: number | null
          profile_views?: number | null
          reach?: number | null
          reactions?: number | null
          updated_at?: string
          week_ending?: string | null
        }
        Update: {
          account_label?: string | null
          created_at?: string
          followers_gained?: number | null
          followers_total?: number | null
          id?: string
          impressions?: number | null
          profile_views?: number | null
          reach?: number | null
          reactions?: number | null
          updated_at?: string
          week_ending?: string | null
        }
        Relationships: []
      }
      meta_ads: {
        Row: {
          body: string | null
          conversion_rate_ranking: string | null
          created_at: string
          creative_id: string | null
          creative_name: string | null
          creative_raw: Json | null
          cta_type: string | null
          display_url: string | null
          effective_status: string | null
          engagement_rate_ranking: string | null
          id: string
          image_url: string | null
          instagram_permalink_url: string | null
          link_url: string | null
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          object_type: string | null
          permalink_url: string | null
          quality_ranking: string | null
          raw: Json | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_id: string | null
        }
        Insert: {
          body?: string | null
          conversion_rate_ranking?: string | null
          created_at?: string
          creative_id?: string | null
          creative_name?: string | null
          creative_raw?: Json | null
          cta_type?: string | null
          display_url?: string | null
          effective_status?: string | null
          engagement_rate_ranking?: string | null
          id?: string
          image_url?: string | null
          instagram_permalink_url?: string | null
          link_url?: string | null
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          object_type?: string | null
          permalink_url?: string | null
          quality_ranking?: string | null
          raw?: Json | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          body?: string | null
          conversion_rate_ranking?: string | null
          created_at?: string
          creative_id?: string | null
          creative_name?: string | null
          creative_raw?: Json | null
          cta_type?: string | null
          display_url?: string | null
          effective_status?: string | null
          engagement_rate_ranking?: string | null
          id?: string
          image_url?: string | null
          instagram_permalink_url?: string | null
          link_url?: string | null
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          name?: string
          object_type?: string | null
          permalink_url?: string | null
          quality_ranking?: string | null
          raw?: Json | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Relationships: []
      }
      meta_ads_daily: {
        Row: {
          clicks: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          frequency: number | null
          id: string
          impressions: number | null
          leads: number | null
          meta_campaign_id: string
          raw: Json | null
          reach: number | null
          snapshot_date: string
          spend: number | null
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_campaign_id: string
          raw?: Json | null
          reach?: number | null
          snapshot_date: string
          spend?: number | null
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_campaign_id?: string
          raw?: Json | null
          reach?: number | null
          snapshot_date?: string
          spend?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_ads_insights_daily: {
        Row: {
          clicks: number | null
          conversion_rate_ranking: string | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          engagement_rate_ranking: string | null
          frequency: number | null
          id: string
          impressions: number | null
          leads: number | null
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          post_comments: number | null
          post_reactions: number | null
          post_shares: number | null
          quality_ranking: string | null
          raw: Json | null
          reach: number | null
          snapshot_date: string
          spend: number | null
          updated_at: string
          video_views: number | null
        }
        Insert: {
          clicks?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          engagement_rate_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          post_comments?: number | null
          post_reactions?: number | null
          post_shares?: number | null
          quality_ranking?: string | null
          raw?: Json | null
          reach?: number | null
          snapshot_date: string
          spend?: number | null
          updated_at?: string
          video_views?: number | null
        }
        Update: {
          clicks?: number | null
          conversion_rate_ranking?: string | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          engagement_rate_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          post_comments?: number | null
          post_reactions?: number | null
          post_shares?: number | null
          quality_ranking?: string | null
          raw?: Json | null
          reach?: number | null
          snapshot_date?: string
          spend?: number | null
          updated_at?: string
          video_views?: number | null
        }
        Relationships: []
      }
      meta_adsets: {
        Row: {
          bid_strategy: string | null
          billing_event: string | null
          created_at: string
          daily_budget: number | null
          end_time: string | null
          id: string
          lifetime_budget: number | null
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          optimization_goal: string | null
          raw: Json | null
          start_time: string | null
          status: string | null
          targeting: Json | null
          updated_at: string
        }
        Insert: {
          bid_strategy?: string | null
          billing_event?: string | null
          created_at?: string
          daily_budget?: number | null
          end_time?: string | null
          id?: string
          lifetime_budget?: number | null
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          optimization_goal?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string
        }
        Update: {
          bid_strategy?: string | null
          billing_event?: string | null
          created_at?: string
          daily_budget?: number | null
          end_time?: string | null
          id?: string
          lifetime_budget?: number | null
          meta_adset_id?: string
          meta_campaign_id?: string
          name?: string
          optimization_goal?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_adsets_daily: {
        Row: {
          clicks: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          frequency: number | null
          id: string
          impressions: number | null
          leads: number | null
          meta_adset_id: string
          meta_campaign_id: string
          post_comments: number | null
          post_reactions: number | null
          post_shares: number | null
          raw: Json | null
          reach: number | null
          snapshot_date: string
          spend: number | null
          updated_at: string
          video_views: number | null
        }
        Insert: {
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_adset_id: string
          meta_campaign_id: string
          post_comments?: number | null
          post_reactions?: number | null
          post_shares?: number | null
          raw?: Json | null
          reach?: number | null
          snapshot_date: string
          spend?: number | null
          updated_at?: string
          video_views?: number | null
        }
        Update: {
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          meta_adset_id?: string
          meta_campaign_id?: string
          post_comments?: number | null
          post_reactions?: number | null
          post_shares?: number | null
          raw?: Json | null
          reach?: number | null
          snapshot_date?: string
          spend?: number | null
          updated_at?: string
          video_views?: number | null
        }
        Relationships: []
      }
      meta_campaigns: {
        Row: {
          campaign_id: string | null
          created_at: string
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_campaign_id: string
          name: string
          objective: string | null
          raw: Json | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id: string
          name: string
          objective?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id?: string
          name?: string
          objective?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_sync_runs: {
        Row: {
          ad_insights_synced: number | null
          ads_synced: number | null
          adset_insights_synced: number | null
          adsets_synced: number | null
          campaigns_synced: number | null
          error: string | null
          finished_at: string | null
          id: string
          insights_synced: number | null
          started_at: string
          success: boolean | null
          triggered_by: string | null
        }
        Insert: {
          ad_insights_synced?: number | null
          ads_synced?: number | null
          adset_insights_synced?: number | null
          adsets_synced?: number | null
          campaigns_synced?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          insights_synced?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
        }
        Update: {
          ad_insights_synced?: number | null
          ads_synced?: number | null
          adset_insights_synced?: number | null
          adsets_synced?: number | null
          campaigns_synced?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          insights_synced?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      metric_definitions: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          description: string | null
          format: string | null
          id: string
          key: string
          label: string
          section: string
          sort_order: number | null
          source: string | null
          source_config: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          key: string
          label: string
          section: string
          sort_order?: number | null
          source?: string | null
          source_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          key?: string
          label?: string
          section?: string
          sort_order?: number | null
          source?: string | null
          source_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_connections: {
        Row: {
          access_token: string
          bot_id: string | null
          calls_database_id: string | null
          calls_property_map: Json | null
          created_at: string
          enabled: boolean
          id: string
          leads_database_id: string | null
          leads_property_map: Json | null
          owner_info: Json | null
          updated_at: string
          workspace_icon: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          access_token: string
          bot_id?: string | null
          calls_database_id?: string | null
          calls_property_map?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          leads_database_id?: string | null
          leads_property_map?: Json | null
          owner_info?: Json | null
          updated_at?: string
          workspace_icon?: string | null
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          access_token?: string
          bot_id?: string | null
          calls_database_id?: string | null
          calls_property_map?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          leads_database_id?: string | null
          leads_property_map?: Json | null
          owner_info?: Json | null
          updated_at?: string
          workspace_icon?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: []
      }
      notion_sync_log: {
        Row: {
          action: string
          created_at: string
          error: string | null
          id: string
          notion_page_id: string | null
          payload: Json | null
          resource_id: string | null
          resource_type: string
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          id?: string
          notion_page_id?: string | null
          payload?: Json | null
          resource_id?: string | null
          resource_type: string
          success: boolean
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          id?: string
          notion_page_id?: string | null
          payload?: Json | null
          resource_id?: string | null
          resource_type?: string
          success?: boolean
        }
        Relationships: []
      }
      offers: {
        Row: {
          cohort_size: number | null
          created_at: string | null
          description: string | null
          id: string
          kajabi_offer_id: string | null
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
          kajabi_offer_id?: string | null
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
          kajabi_offer_id?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          status?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      optimization_outputs: {
        Row: {
          approval_likelihood_score: number | null
          brand_voice_score: number | null
          content: string | null
          content_json: Json | null
          created_at: string | null
          guardrail_warnings: Json | null
          human_sounding_score: number | null
          id: string
          optimization_run_id: string
          output_type: string
          passed_guardrails: boolean | null
          rationale: string | null
          selected_at: string | null
          selected_by_user: boolean | null
          selected_by_user_email: string | null
          seo_score: number | null
          variant_index: number | null
        }
        Insert: {
          approval_likelihood_score?: number | null
          brand_voice_score?: number | null
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          guardrail_warnings?: Json | null
          human_sounding_score?: number | null
          id?: string
          optimization_run_id: string
          output_type: string
          passed_guardrails?: boolean | null
          rationale?: string | null
          selected_at?: string | null
          selected_by_user?: boolean | null
          selected_by_user_email?: string | null
          seo_score?: number | null
          variant_index?: number | null
        }
        Update: {
          approval_likelihood_score?: number | null
          brand_voice_score?: number | null
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          guardrail_warnings?: Json | null
          human_sounding_score?: number | null
          id?: string
          optimization_run_id?: string
          output_type?: string
          passed_guardrails?: boolean | null
          rationale?: string | null
          selected_at?: string | null
          selected_by_user?: boolean | null
          selected_by_user_email?: string | null
          seo_score?: number | null
          variant_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_outputs_optimization_run_id_fkey"
            columns: ["optimization_run_id"]
            isOneToOne: false
            referencedRelation: "optimization_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_performance: {
        Row: {
          after_30d_ctr: number | null
          after_30d_impressions: number | null
          after_30d_taken_at: string | null
          after_30d_views: number | null
          after_30d_watch_time_minutes: number | null
          after_7d_ctr: number | null
          after_7d_impressions: number | null
          after_7d_taken_at: string | null
          after_7d_views: number | null
          after_7d_watch_time_minutes: number | null
          baseline_ctr: number | null
          baseline_impressions: number | null
          baseline_taken_at: string | null
          baseline_views: number | null
          baseline_watch_time_minutes: number | null
          ctr_delta_pct: number | null
          id: string
          notes: string | null
          optimization_run_id: string
          optimization_won: boolean | null
          views_delta_pct: number | null
          watch_time_delta_pct: number | null
          youtube_video_id: string
        }
        Insert: {
          after_30d_ctr?: number | null
          after_30d_impressions?: number | null
          after_30d_taken_at?: string | null
          after_30d_views?: number | null
          after_30d_watch_time_minutes?: number | null
          after_7d_ctr?: number | null
          after_7d_impressions?: number | null
          after_7d_taken_at?: string | null
          after_7d_views?: number | null
          after_7d_watch_time_minutes?: number | null
          baseline_ctr?: number | null
          baseline_impressions?: number | null
          baseline_taken_at?: string | null
          baseline_views?: number | null
          baseline_watch_time_minutes?: number | null
          ctr_delta_pct?: number | null
          id?: string
          notes?: string | null
          optimization_run_id: string
          optimization_won?: boolean | null
          views_delta_pct?: number | null
          watch_time_delta_pct?: number | null
          youtube_video_id: string
        }
        Update: {
          after_30d_ctr?: number | null
          after_30d_impressions?: number | null
          after_30d_taken_at?: string | null
          after_30d_views?: number | null
          after_30d_watch_time_minutes?: number | null
          after_7d_ctr?: number | null
          after_7d_impressions?: number | null
          after_7d_taken_at?: string | null
          after_7d_views?: number | null
          after_7d_watch_time_minutes?: number | null
          baseline_ctr?: number | null
          baseline_impressions?: number | null
          baseline_taken_at?: string | null
          baseline_views?: number | null
          baseline_watch_time_minutes?: number | null
          ctr_delta_pct?: number | null
          id?: string
          notes?: string | null
          optimization_run_id?: string
          optimization_won?: boolean | null
          views_delta_pct?: number | null
          watch_time_delta_pct?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_performance_optimization_run_id_fkey"
            columns: ["optimization_run_id"]
            isOneToOne: false
            referencedRelation: "optimization_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_performance_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_runs: {
        Row: {
          ai_model: string | null
          approved_at: string | null
          brand_id: string
          cost_usd: number | null
          created_at: string | null
          error: string | null
          id: string
          input_summary: string | null
          latency_ms: number | null
          published_at: string | null
          raw_output: Json | null
          status: string | null
          trigger_type: string | null
          triggered_by_user: string | null
          youtube_video_id: string
        }
        Insert: {
          ai_model?: string | null
          approved_at?: string | null
          brand_id: string
          cost_usd?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          published_at?: string | null
          raw_output?: Json | null
          status?: string | null
          trigger_type?: string | null
          triggered_by_user?: string | null
          youtube_video_id: string
        }
        Update: {
          ai_model?: string | null
          approved_at?: string | null
          brand_id?: string
          cost_usd?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          published_at?: string | null
          raw_output?: Json | null
          status?: string | null
          trigger_type?: string | null
          triggered_by_user?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_runs_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      thumbnail_generations: {
        Row: {
          brand_id: string | null
          brand_voice_score: number | null
          cost_usd: number | null
          created_at: string | null
          generation_model: string | null
          id: string
          image_url: string | null
          layout_notes: string | null
          optimization_run_id: string | null
          prompt: string | null
          selected_by_user: boolean | null
          storage_path: string | null
          text_overlay: string | null
          variant_index: number | null
          youtube_video_id: string | null
        }
        Insert: {
          brand_id?: string | null
          brand_voice_score?: number | null
          cost_usd?: number | null
          created_at?: string | null
          generation_model?: string | null
          id?: string
          image_url?: string | null
          layout_notes?: string | null
          optimization_run_id?: string | null
          prompt?: string | null
          selected_by_user?: boolean | null
          storage_path?: string | null
          text_overlay?: string | null
          variant_index?: number | null
          youtube_video_id?: string | null
        }
        Update: {
          brand_id?: string | null
          brand_voice_score?: number | null
          cost_usd?: number | null
          created_at?: string | null
          generation_model?: string | null
          id?: string
          image_url?: string | null
          layout_notes?: string | null
          optimization_run_id?: string | null
          prompt?: string | null
          selected_by_user?: boolean | null
          storage_path?: string | null
          text_overlay?: string | null
          variant_index?: number | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thumbnail_generations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thumbnail_generations_optimization_run_id_fkey"
            columns: ["optimization_run_id"]
            isOneToOne: false
            referencedRelation: "optimization_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thumbnail_generations_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_transcripts: {
        Row: {
          fetched_at: string | null
          id: string
          language: string | null
          segments: Json | null
          transcript_text: string | null
          youtube_video_id: string
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          language?: string | null
          segments?: Json | null
          transcript_text?: string | null
          youtube_video_id: string
        }
        Update: {
          fetched_at?: string | null
          id?: string
          language?: string | null
          segments?: Json | null
          transcript_text?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_transcripts_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_metric_snapshots: {
        Row: {
          created_at: string
          id: string
          metric_definition_id: string
          note: string | null
          source: string | null
          updated_at: string
          value: number | null
          value_text: string | null
          week_ending: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_definition_id: string
          note?: string | null
          source?: string | null
          updated_at?: string
          value?: number | null
          value_text?: string | null
          week_ending: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_definition_id?: string
          note?: string | null
          source?: string | null
          updated_at?: string
          value?: number | null
          value_text?: string | null
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_metric_snapshots_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_rollup_runs: {
        Row: {
          details: Json | null
          error: string | null
          finished_at: string | null
          id: string
          metrics_processed: number | null
          snapshots_written: number | null
          started_at: string
          success: boolean | null
          triggered_by: string | null
          weeks_processed: number | null
        }
        Insert: {
          details?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          metrics_processed?: number | null
          snapshots_written?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
          weeks_processed?: number | null
        }
        Update: {
          details?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          metrics_processed?: number | null
          snapshots_written?: number | null
          started_at?: string
          success?: boolean | null
          triggered_by?: string | null
          weeks_processed?: number | null
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
      youtube_videos: {
        Row: {
          avg_view_duration_seconds: number | null
          brand_id: string | null
          comments: number | null
          content_id: string | null
          created_at: string | null
          ctr: number | null
          current_description: string | null
          current_tags: Json | null
          current_thumbnail_url: string | null
          current_title: string | null
          duration_seconds: number | null
          id: string
          impressions: number | null
          is_short: boolean | null
          last_optimized_at: string | null
          likes: number | null
          optimization_status: string | null
          published_at: string | null
          raw: Json | null
          updated_at: string | null
          views: number | null
          watch_time_minutes: number | null
          youtube_channel_id: string | null
          youtube_video_id: string
        }
        Insert: {
          avg_view_duration_seconds?: number | null
          brand_id?: string | null
          comments?: number | null
          content_id?: string | null
          created_at?: string | null
          ctr?: number | null
          current_description?: string | null
          current_tags?: Json | null
          current_thumbnail_url?: string | null
          current_title?: string | null
          duration_seconds?: number | null
          id?: string
          impressions?: number | null
          is_short?: boolean | null
          last_optimized_at?: string | null
          likes?: number | null
          optimization_status?: string | null
          published_at?: string | null
          raw?: Json | null
          updated_at?: string | null
          views?: number | null
          watch_time_minutes?: number | null
          youtube_channel_id?: string | null
          youtube_video_id: string
        }
        Update: {
          avg_view_duration_seconds?: number | null
          brand_id?: string | null
          comments?: number | null
          content_id?: string | null
          created_at?: string | null
          ctr?: number | null
          current_description?: string | null
          current_tags?: Json | null
          current_thumbnail_url?: string | null
          current_title?: string | null
          duration_seconds?: number | null
          id?: string
          impressions?: number | null
          is_short?: boolean | null
          last_optimized_at?: string | null
          likes?: number | null
          optimization_status?: string | null
          published_at?: string | null
          raw?: Json | null
          updated_at?: string | null
          views?: number | null
          watch_time_minutes?: number | null
          youtube_channel_id?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_youtube_channel_id_fkey"
            columns: ["youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analyst_run_sql: { Args: { query: string }; Returns: Json }
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
