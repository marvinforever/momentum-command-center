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
