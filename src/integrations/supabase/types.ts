export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_action_runs: {
        Row: {
          id: string
          workspace_id: string
          agent_version_id: string | null
          conversation_id: string | null
          contact_id: string | null
          source_message_id: string | null
          action_key: string
          mode: string
          idempotency_key: string
          status: string
          input: Json
          output: Json
          error_code: string | null
          started_at: string
          finished_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_version_id?: string | null
          conversation_id?: string | null
          contact_id?: string | null
          source_message_id?: string | null
          action_key: string
          mode?: string
          idempotency_key: string
          status?: string
          input?: Json
          output?: Json
          error_code?: string | null
          started_at?: string
          finished_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_version_id?: string | null
          conversation_id?: string | null
          contact_id?: string | null
          source_message_id?: string | null
          action_key?: string
          mode?: string
          idempotency_key?: string
          status?: string
          input?: Json
          output?: Json
          error_code?: string | null
          started_at?: string
          finished_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_runs_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_runs_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_audit_log: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string | null
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id?: string | null
          actor_user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string | null
          actor_user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_drafts: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string
          config: Json
          revision: number
          base_version_id: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id: string
          config?: Json
          revision?: number
          base_version_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string
          config?: Json
          revision?: number
          base_version_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_drafts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_base_version_fk"
            columns: ["base_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_operation_rate_limits: {
        Row: {
          workspace_id: string
          subject_key: string
          operation: string
          window_key: number
          request_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          workspace_id: string
          subject_key: string
          operation: string
          window_key: number
          request_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          subject_key?: string
          operation?: string
          window_key?: number
          request_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_operation_rate_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runtime_events: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string
          agent_version_id: string
          conversation_id: string | null
          contact_id: string | null
          source_message_id: string | null
          event_kind: string
          compiler_version: string
          model_provider: string | null
          model_name: string | null
          route: string | null
          sources: Json
          tools: Json
          guards: Json
          latency_ms: number | null
          estimated_cost: number | null
          handoff: boolean
          error_code: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id: string
          agent_version_id: string
          conversation_id?: string | null
          contact_id?: string | null
          source_message_id?: string | null
          event_kind: string
          compiler_version: string
          model_provider?: string | null
          model_name?: string | null
          route?: string | null
          sources?: Json
          tools?: Json
          guards?: Json
          latency_ms?: number | null
          estimated_cost?: number | null
          handoff?: boolean
          error_code?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string
          agent_version_id?: string
          conversation_id?: string | null
          contact_id?: string | null
          source_message_id?: string | null
          event_kind?: string
          compiler_version?: string
          model_provider?: string | null
          model_name?: string | null
          route?: string | null
          sources?: Json
          tools?: Json
          guards?: Json
          latency_ms?: number | null
          estimated_cost?: number | null
          handoff?: boolean
          error_code?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runtime_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_events_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_suggestions: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string
          suggestion_type: string
          title: string
          rationale: string
          proposed_change: Json
          evidence: Json
          fingerprint: string
          source_conversation_id: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          applied_entity_type: string | null
          applied_entity_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id: string
          suggestion_type: string
          title: string
          rationale: string
          proposed_change?: Json
          evidence?: Json
          fingerprint: string
          source_conversation_id?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          applied_entity_type?: string | null
          applied_entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string
          suggestion_type?: string
          title?: string
          rationale?: string
          proposed_change?: Json
          evidence?: Json
          fingerprint?: string
          source_conversation_id?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          applied_entity_type?: string | null
          applied_entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_suggestions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string
          version_number: number
          config: Json
          compiled_prompt: string
          checksum: string
          label: string | null
          source: string
          evaluation_run_id: string | null
          accepted_warnings: Json
          restored_from_version_id: string | null
          created_by: string | null
          published_at: string
          created_at: string
          compiler_version: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id: string
          version_number: number
          config: Json
          compiled_prompt: string
          checksum: string
          label?: string | null
          source?: string
          evaluation_run_id?: string | null
          accepted_warnings?: Json
          restored_from_version_id?: string | null
          created_by?: string | null
          published_at?: string
          created_at?: string
          compiler_version?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string
          version_number?: number
          config?: Json
          compiled_prompt?: string
          checksum?: string
          label?: string | null
          source?: string
          evaluation_run_id?: string | null
          accepted_warnings?: Json
          restored_from_version_id?: string | null
          created_by?: string | null
          published_at?: string
          created_at?: string
          compiler_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_evaluation_run_id_fkey"
            columns: ["evaluation_run_id"]
            isOneToOne: false
            referencedRelation: "eval_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: true
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          id: string
          workspace_id: string
          name: string
          status: string
          published_version_id: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name?: string
          status?: string
          published_version_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          status?: string
          published_version_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          id: string
          title: string
          description: string | null
          date: string
          time: string
          duration: number
          type: Database["public"]["Enums"]["appointment_type"]
          attendees: string[] | null
          contact_id: string | null
          meeting_url: string | null
          status: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
          user_id: string | null
          calendar_provider: string | null
          external_calendar_event_id: string | null
          calendar_sync_status: string
          calendar_synced_at: string | null
          calendar_sync_error: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          date: string
          time: string
          duration?: number
          type?: Database["public"]["Enums"]["appointment_type"]
          attendees?: string[] | null
          contact_id?: string | null
          meeting_url?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          user_id?: string | null
          calendar_provider?: string | null
          external_calendar_event_id?: string | null
          calendar_sync_status?: string
          calendar_synced_at?: string | null
          calendar_sync_error?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          date?: string
          time?: string
          duration?: number
          type?: Database["public"]["Enums"]["appointment_type"]
          attendees?: string[] | null
          contact_id?: string | null
          meeting_url?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          user_id?: string | null
          calendar_provider?: string | null
          external_calendar_event_id?: string | null
          calendar_sync_status?: string
          calendar_synced_at?: string | null
          calendar_sync_error?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_campaigns: {
        Row: {
          id: string
          workspace_id: string
          name: string
          status: string
          list_id: string | null
          channel_id: string | null
          message_type: string
          message_template: string | null
          media_urls: string[] | null
          media_rotation_mode: string | null
          rotation_strategy: string | null
          batch_size: number
          delay_min_ms: number
          delay_max_ms: number
          total_recipients: number
          sent_count: number
          failed_count: number
          next_batch_at: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          status?: string
          list_id?: string | null
          channel_id?: string | null
          message_type?: string
          message_template?: string | null
          media_urls?: string[] | null
          media_rotation_mode?: string | null
          rotation_strategy?: string | null
          batch_size?: number
          delay_min_ms?: number
          delay_max_ms?: number
          total_recipients?: number
          sent_count?: number
          failed_count?: number
          next_batch_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          status?: string
          list_id?: string | null
          channel_id?: string | null
          message_type?: string
          message_template?: string | null
          media_urls?: string[] | null
          media_rotation_mode?: string | null
          rotation_strategy?: string | null
          batch_size?: number
          delay_min_ms?: number
          delay_max_ms?: number
          total_recipients?: number
          sent_count?: number
          failed_count?: number
          next_batch_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          id: string
          workspace_id: string
          campaign_id: string
          contact_id: string
          status: string
          variables: Json
          sent_media_url: string | null
          error_message: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          campaign_id: string
          contact_id: string
          status?: string
          variables?: Json
          sent_media_url?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          campaign_id?: string
          contact_id?: string
          status?: string
          variables?: Json
          sent_media_url?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          id: string
          provider: string
          owner_user_id: string
          account_email: string | null
          calendar_id: string
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          scopes: string[]
          status: string
          sync_enabled: boolean
          create_meet: boolean
          time_zone: string
          last_synced_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
          grant_id: string | null
          grant_provider: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          provider?: string
          owner_user_id: string
          account_email?: string | null
          calendar_id?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          scopes?: string[]
          status?: string
          sync_enabled?: boolean
          create_meet?: boolean
          time_zone?: string
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
          grant_id?: string | null
          grant_provider?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          provider?: string
          owner_user_id?: string
          account_email?: string | null
          calendar_id?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          scopes?: string[]
          status?: string
          sync_enabled?: boolean
          create_meet?: boolean
          time_zone?: string
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
          grant_id?: string | null
          grant_provider?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_oauth_states: {
        Row: {
          id: string
          state_hash: string
          user_id: string
          expires_at: string
          created_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          state_hash: string
          user_id: string
          expires_at: string
          created_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          state_hash?: string
          user_id?: string
          expires_at?: string
          created_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_connections: {
        Row: {
          id: string
          platform: string
          provider: string
          zernio_account_id: string | null
          zernio_profile_id: string | null
          username: string | null
          display_name: string | null
          status: string
          connected_at: string | null
          disconnected_at: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
          workspace_id: string
          external_account_id: string | null
          phone_e164: string | null
          is_default: boolean
        }
        Insert: {
          id?: string
          platform: string
          provider?: string
          zernio_account_id?: string | null
          zernio_profile_id?: string | null
          username?: string | null
          display_name?: string | null
          status?: string
          connected_at?: string | null
          disconnected_at?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          workspace_id: string
          external_account_id?: string | null
          phone_e164?: string | null
          is_default?: boolean
        }
        Update: {
          id?: string
          platform?: string
          provider?: string
          zernio_account_id?: string | null
          zernio_profile_id?: string | null
          username?: string | null
          display_name?: string | null
          status?: string
          connected_at?: string | null
          disconnected_at?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          workspace_id?: string
          external_account_id?: string | null
          phone_e164?: string | null
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "channel_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_secrets: {
        Row: {
          channel_id: string
          workspace_id: string
          waba_id: string | null
          phone_number_id: string | null
          access_token: string | null
          extra: Json
          updated_at: string
        }
        Insert: {
          channel_id: string
          workspace_id: string
          waba_id?: string | null
          phone_number_id?: string | null
          access_token?: string | null
          extra?: Json
          updated_at?: string
        }
        Update: {
          channel_id?: string
          workspace_id?: string
          waba_id?: string | null
          phone_number_id?: string | null
          access_token?: string | null
          extra?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_secrets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_list_members: {
        Row: {
          id: string
          workspace_id: string
          list_id: string
          contact_id: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          list_id: string
          contact_id: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          list_id?: string
          contact_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          id: string
          workspace_id: string
          name: string
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          id: string
          phone_number: string | null
          whatsapp_id: string | null
          name: string | null
          call_name: string | null
          email: string | null
          profile_picture_url: string | null
          is_business: boolean | null
          is_blocked: boolean | null
          blocked_at: string | null
          blocked_reason: string | null
          tags: string[] | null
          notes: string | null
          client_memory: Json | null
          first_contact_date: string
          last_activity: string
          created_at: string
          updated_at: string
          user_id: string | null
          instagram_user_id: string | null
          instagram_username: string | null
          avatar_url: string | null
          workspace_id: string
          lead_company_id: string | null
          role_title: string | null
          is_decision_maker: boolean
          enrichment_score: number | null
          lifecycle_status: string
          source: string | null
          phone_e164: string | null
          legacy_source: string | null
          legacy_id: string | null
        }
        Insert: {
          id?: string
          phone_number?: string | null
          whatsapp_id?: string | null
          name?: string | null
          call_name?: string | null
          email?: string | null
          profile_picture_url?: string | null
          is_business?: boolean | null
          is_blocked?: boolean | null
          blocked_at?: string | null
          blocked_reason?: string | null
          tags?: string[] | null
          notes?: string | null
          client_memory?: Json | null
          first_contact_date?: string
          last_activity?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          avatar_url?: string | null
          workspace_id: string
          lead_company_id?: string | null
          role_title?: string | null
          is_decision_maker?: boolean
          enrichment_score?: number | null
          lifecycle_status?: string
          source?: string | null
          phone_e164?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
        }
        Update: {
          id?: string
          phone_number?: string | null
          whatsapp_id?: string | null
          name?: string | null
          call_name?: string | null
          email?: string | null
          profile_picture_url?: string | null
          is_business?: boolean | null
          is_blocked?: boolean | null
          blocked_at?: string | null
          blocked_reason?: string | null
          tags?: string[] | null
          notes?: string | null
          client_memory?: Json | null
          first_contact_date?: string
          last_activity?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          avatar_url?: string | null
          workspace_id?: string
          lead_company_id?: string | null
          role_title?: string | null
          is_decision_maker?: boolean
          enrichment_score?: number | null
          lifecycle_status?: string
          source?: string | null
          phone_e164?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "lead_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_states: {
        Row: {
          id: string
          conversation_id: string
          current_state: string
          last_action: string | null
          last_action_at: string | null
          scheduling_context: Json | null
          created_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          conversation_id: string
          current_state?: string
          last_action?: string | null
          last_action_at?: string | null
          scheduling_context?: Json | null
          created_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          conversation_id?: string
          current_state?: string
          last_action?: string | null
          last_action_at?: string | null
          scheduling_context?: Json | null
          created_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          contact_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          is_active: boolean
          assigned_team: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id: string | null
          tags: string[] | null
          nina_context: Json | null
          metadata: Json | null
          started_at: string
          last_message_at: string
          created_at: string
          updated_at: string
          user_id: string | null
          channel: string
          zernio_conversation_id: string | null
          zernio_account_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          contact_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          is_active?: boolean
          assigned_team?: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id?: string | null
          tags?: string[] | null
          nina_context?: Json | null
          metadata?: Json | null
          started_at?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          channel?: string
          zernio_conversation_id?: string | null
          zernio_account_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          contact_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          is_active?: boolean
          assigned_team?: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id?: string | null
          tags?: string[] | null
          nina_context?: Json | null
          metadata?: Json | null
          started_at?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          channel?: string
          zernio_conversation_id?: string | null
          zernio_account_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          id: string
          deal_id: string
          type: string
          title: string
          description: string | null
          scheduled_at: string | null
          completed_at: string | null
          is_completed: boolean | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          deal_id: string
          type?: string
          title: string
          description?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          is_completed?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          deal_id?: string
          type?: string
          title?: string
          description?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          is_completed?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          id: string
          contact_id: string | null
          title: string
          company: string | null
          value: number | null
          stage: string | null
          priority: string | null
          tags: string[] | null
          due_date: string | null
          owner_id: string | null
          notes: string | null
          lost_reason: string | null
          won_at: string | null
          lost_at: string | null
          created_at: string | null
          updated_at: string | null
          stage_id: string
          user_id: string | null
          workspace_id: string
          lead_company_id: string | null
          source: string | null
          legacy_source: string | null
          legacy_id: string | null
        }
        Insert: {
          id?: string
          contact_id?: string | null
          title: string
          company?: string | null
          value?: number | null
          stage?: string | null
          priority?: string | null
          tags?: string[] | null
          due_date?: string | null
          owner_id?: string | null
          notes?: string | null
          lost_reason?: string | null
          won_at?: string | null
          lost_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          stage_id: string
          user_id?: string | null
          workspace_id: string
          lead_company_id?: string | null
          source?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
        }
        Update: {
          id?: string
          contact_id?: string | null
          title?: string
          company?: string | null
          value?: number | null
          stage?: string | null
          priority?: string | null
          tags?: string[] | null
          due_date?: string | null
          owner_id?: string | null
          notes?: string | null
          lost_reason?: string | null
          won_at?: string | null
          lost_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          stage_id?: string
          user_id?: string | null
          workspace_id?: string
          lead_company_id?: string | null
          source?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "lead_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_results: {
        Row: {
          id: string
          run_id: string
          case_id: string | null
          query: string
          expected_behavior: string
          expected_content: string | null
          category: string
          reply: string | null
          grounding: Json | null
          verdict: string
          judge_reason: string | null
          latency_ms: number | null
          created_at: string
          workspace_id: string
          severity: string
          result_status: string
          checker_details: Json
          attempts: number
          reviewer_verdict: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          run_id: string
          case_id?: string | null
          query: string
          expected_behavior: string
          expected_content?: string | null
          category: string
          reply?: string | null
          grounding?: Json | null
          verdict: string
          judge_reason?: string | null
          latency_ms?: number | null
          created_at?: string
          workspace_id: string
          severity?: string
          result_status?: string
          checker_details?: Json
          attempts?: number
          reviewer_verdict?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          run_id?: string
          case_id?: string | null
          query?: string
          expected_behavior?: string
          expected_content?: string | null
          category?: string
          reply?: string | null
          grounding?: Json | null
          verdict?: string
          judge_reason?: string | null
          latency_ms?: number | null
          created_at?: string
          workspace_id?: string
          severity?: string
          result_status?: string
          checker_details?: Json
          attempts?: number
          reviewer_verdict?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "golden_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "eval_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_runs: {
        Row: {
          id: string
          status: string
          total_cases: number
          passed: number
          failed: number
          errored: number
          prompt_source: string
          test_prompt: string | null
          model_mode: string | null
          started_by: string | null
          created_at: string
          finished_at: string | null
          workspace_id: string
          agent_id: string
          draft_id: string | null
          draft_revision: number | null
          compiler_version: string | null
          config_snapshot: Json | null
          critical_failures: number
          warnings: number
          unstable: number
          technical_failures: number
          gate_status: string
          accepted_warnings: number
        }
        Insert: {
          id?: string
          status?: string
          total_cases?: number
          passed?: number
          failed?: number
          errored?: number
          prompt_source?: string
          test_prompt?: string | null
          model_mode?: string | null
          started_by?: string | null
          created_at?: string
          finished_at?: string | null
          workspace_id: string
          agent_id: string
          draft_id?: string | null
          draft_revision?: number | null
          compiler_version?: string | null
          config_snapshot?: Json | null
          critical_failures?: number
          warnings?: number
          unstable?: number
          technical_failures?: number
          gate_status?: string
          accepted_warnings?: number
        }
        Update: {
          id?: string
          status?: string
          total_cases?: number
          passed?: number
          failed?: number
          errored?: number
          prompt_source?: string
          test_prompt?: string | null
          model_mode?: string | null
          started_by?: string | null
          created_at?: string
          finished_at?: string | null
          workspace_id?: string
          agent_id?: string
          draft_id?: string | null
          draft_revision?: number | null
          compiler_version?: string | null
          config_snapshot?: Json | null
          critical_failures?: number
          warnings?: number
          unstable?: number
          technical_failures?: number
          gate_status?: string
          accepted_warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "eval_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_runs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "agent_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_enrollments: {
        Row: {
          id: string
          workspace_id: string
          sequence_id: string
          contact_id: string
          deal_id: string | null
          status: string
          current_step: number
          next_send_at: string | null
          trigger_data: Json
          variables: Json
          stop_reason: string | null
          enrolled_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          sequence_id: string
          contact_id: string
          deal_id?: string | null
          status?: string
          current_step?: number
          next_send_at?: string | null
          trigger_data?: Json
          variables?: Json
          stop_reason?: string | null
          enrolled_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          sequence_id?: string
          contact_id?: string
          deal_id?: string | null
          status?: string
          current_step?: number
          next_send_at?: string | null
          trigger_data?: Json
          variables?: Json
          stop_reason?: string | null
          enrolled_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_logs: {
        Row: {
          id: string
          workspace_id: string
          enrollment_id: string
          step_position: number | null
          action: string
          reason: string | null
          message_id: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          enrollment_id: string
          step_position?: number | null
          action: string
          reason?: string | null
          message_id?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          enrollment_id?: string
          step_position?: number | null
          action?: string
          reason?: string | null
          message_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "followup_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_sequences: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          status: string
          trigger_type: string
          trigger_config: Json
          filters: Json
          on_reply_behavior: string
          send_window: Json
          timezone: string
          min_interval_hours: number
          max_attempts: number
          ttl_days: number | null
          post_actions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          status?: string
          trigger_type?: string
          trigger_config?: Json
          filters?: Json
          on_reply_behavior?: string
          send_window?: Json
          timezone?: string
          min_interval_hours?: number
          max_attempts?: number
          ttl_days?: number | null
          post_actions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          status?: string
          trigger_type?: string
          trigger_config?: Json
          filters?: Json
          on_reply_behavior?: string
          send_window?: Json
          timezone?: string
          min_interval_hours?: number
          max_attempts?: number
          ttl_days?: number | null
          post_actions?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_steps: {
        Row: {
          id: string
          workspace_id: string
          sequence_id: string
          position: number
          content: string | null
          content_type: string
          media_urls: string[] | null
          ab_variants: Json | null
          delay_type: string
          delay_value: number
          delay_unit: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          sequence_id: string
          position: number
          content?: string | null
          content_type?: string
          media_urls?: string[] | null
          ab_variants?: Json | null
          delay_type?: string
          delay_value?: number
          delay_unit?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          sequence_id?: string
          position?: number
          content?: string | null
          content_type?: string
          media_urls?: string[] | null
          ab_variants?: Json | null
          delay_type?: string
          delay_value?: number
          delay_unit?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      golden_cases: {
        Row: {
          id: string
          query: string
          expected_behavior: string
          expected_content: string | null
          category: string
          origin: string
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          workspace_id: string
          title: string
          scenario_key: string | null
          severity: string
          messages: Json
          source_rule: string | null
          accepted_at: string | null
          accepted_by: string | null
        }
        Insert: {
          id?: string
          query: string
          expected_behavior: string
          expected_content?: string | null
          category?: string
          origin?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          workspace_id: string
          title: string
          scenario_key?: string | null
          severity?: string
          messages?: Json
          source_rule?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
        }
        Update: {
          id?: string
          query?: string
          expected_behavior?: string
          expected_content?: string | null
          category?: string
          origin?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          workspace_id?: string
          title?: string
          scenario_key?: string | null
          severity?: string
          messages?: Json
          source_rule?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "golden_cases_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golden_cases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_events: {
        Row: {
          id: string
          workspace_id: string
          contact_id: string
          company_id: string | null
          deal_id: string | null
          conversation_id: string | null
          stage: string
          event_type: string
          title: string
          detail: Json
          dedupe_key: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          contact_id: string
          company_id?: string | null
          deal_id?: string | null
          conversation_id?: string | null
          stage: string
          event_type: string
          title: string
          detail?: Json
          dedupe_key?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          contact_id?: string
          company_id?: string | null
          deal_id?: string | null
          conversation_id?: string | null
          stage?: string
          event_type?: string
          title?: string
          detail?: Json
          dedupe_key?: string | null
          occurred_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "lead_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          content: string
          fts: string | null
          created_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          document_id: string
          chunk_index?: number
          content: string
          fts?: string | null
          created_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          document_id?: string
          chunk_index?: number
          content?: string
          fts?: string | null
          created_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          id: string
          title: string
          content: string
          doc_type: string
          is_active: boolean
          chunk_count: number
          created_at: string
          updated_at: string
          workspace_id: string
          source_url: string | null
          status: string
          ingestion_report: Json
          error_message: string | null
          fingerprint: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          doc_type?: string
          is_active?: boolean
          chunk_count?: number
          created_at?: string
          updated_at?: string
          workspace_id: string
          source_url?: string | null
          status?: string
          ingestion_report?: Json
          error_message?: string | null
          fingerprint?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          doc_type?: string
          is_active?: boolean
          chunk_count?: number
          created_at?: string
          updated_at?: string
          workspace_id?: string
          source_url?: string | null
          status?: string
          ingestion_report?: Json
          error_message?: string | null
          fingerprint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_facts: {
        Row: {
          id: string
          category: string
          question: string | null
          fact: string
          source: string | null
          is_active: boolean
          always_include: boolean
          fts: string | null
          created_at: string
          updated_at: string
          workspace_id: string
          title: string
          status: string
          confirmed_by: string | null
          confirmed_at: string | null
          valid_from: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          category?: string
          question?: string | null
          fact: string
          source?: string | null
          is_active?: boolean
          always_include?: boolean
          fts?: string | null
          created_at?: string
          updated_at?: string
          workspace_id: string
          title: string
          status?: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          valid_from?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          category?: string
          question?: string | null
          fact?: string
          source?: string | null
          is_active?: boolean
          always_include?: boolean
          fts?: string | null
          created_at?: string
          updated_at?: string
          workspace_id?: string
          title?: string
          status?: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          valid_from?: string
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_facts_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_companies: {
        Row: {
          id: string
          workspace_id: string
          name: string
          domain: string | null
          cnpj: string | null
          website: string | null
          linkedin_url: string | null
          instagram: string | null
          facebook: string | null
          phone: string | null
          whatsapp: string | null
          email: string | null
          industry: string | null
          description: string | null
          services: string[] | null
          employees_count: number | null
          revenue: string | null
          founding_year: number | null
          address: string | null
          city: string | null
          ai_score: number | null
          ai_summary: string | null
          apollo_org_id: string | null
          search_id: string | null
          legacy_source: string | null
          legacy_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          domain?: string | null
          cnpj?: string | null
          website?: string | null
          linkedin_url?: string | null
          instagram?: string | null
          facebook?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          industry?: string | null
          description?: string | null
          services?: string[] | null
          employees_count?: number | null
          revenue?: string | null
          founding_year?: number | null
          address?: string | null
          city?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          apollo_org_id?: string | null
          search_id?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          domain?: string | null
          cnpj?: string | null
          website?: string | null
          linkedin_url?: string | null
          instagram?: string | null
          facebook?: string | null
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          industry?: string | null
          description?: string | null
          services?: string[] | null
          employees_count?: number | null
          revenue?: string | null
          founding_year?: number | null
          address?: string | null
          city?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          apollo_org_id?: string | null
          search_id?: string | null
          legacy_source?: string | null
          legacy_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_companies_search_fk"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          id: string
          workspace_id: string
          name: string
          source: string
          config: Json
          status: string
          contacts_found: number
          contacts_new: number
          contacts_enriched: number
          target_list_id: string | null
          result_data: Json | null
          error_message: string | null
          enrich_run_id: string | null
          enrich_cursor: string | null
          enrich_step: string | null
          enrich_heartbeat: string | null
          started_at: string | null
          completed_at: string | null
          duration_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          source?: string
          config?: Json
          status?: string
          contacts_found?: number
          contacts_new?: number
          contacts_enriched?: number
          target_list_id?: string | null
          result_data?: Json | null
          error_message?: string | null
          enrich_run_id?: string | null
          enrich_cursor?: string | null
          enrich_step?: string | null
          enrich_heartbeat?: string | null
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          source?: string
          config?: Json
          status?: string
          contacts_found?: number
          contacts_new?: number
          contacts_enriched?: number
          target_list_id?: string | null
          result_data?: Json | null
          error_message?: string | null
          enrich_run_id?: string | null
          enrich_cursor?: string | null
          enrich_step?: string | null
          enrich_heartbeat?: string | null
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_grouping_queue: {
        Row: {
          id: string
          whatsapp_message_id: string
          phone_number_id: string
          message_data: Json
          contacts_data: Json | null
          processed: boolean
          created_at: string
          process_after: string | null
          message_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          whatsapp_message_id: string
          phone_number_id: string
          message_data: Json
          contacts_data?: Json | null
          processed?: boolean
          created_at?: string
          process_after?: string | null
          message_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          whatsapp_message_id?: string
          phone_number_id?: string
          message_data?: Json
          contacts_data?: Json | null
          processed?: boolean
          created_at?: string
          process_after?: string | null
          message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_grouping_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_grouping_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_processing_queue: {
        Row: {
          id: string
          whatsapp_message_id: string
          phone_number_id: string
          raw_data: Json
          status: Database["public"]["Enums"]["queue_status"]
          priority: number
          retry_count: number
          error_message: string | null
          scheduled_for: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          whatsapp_message_id: string
          phone_number_id: string
          raw_data: Json
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          whatsapp_message_id?: string
          phone_number_id?: string
          raw_data?: Json
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_processing_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_snippets: {
        Row: {
          id: string
          workspace_id: string
          name: string
          category: string | null
          message_type: string
          content: string | null
          media_urls: string[] | null
          tags: string[] | null
          is_ai_generated: boolean
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          category?: string | null
          message_type?: string
          content?: string | null
          media_urls?: string[] | null
          tags?: string[] | null
          is_ai_generated?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          category?: string | null
          message_type?: string
          content?: string | null
          media_urls?: string[] | null
          tags?: string[] | null
          is_ai_generated?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          reply_to_id: string | null
          whatsapp_message_id: string | null
          type: Database["public"]["Enums"]["message_type"]
          from_type: Database["public"]["Enums"]["message_from"]
          content: string | null
          media_url: string | null
          media_type: string | null
          status: Database["public"]["Enums"]["message_status"]
          processed_by_nina: boolean | null
          nina_response_time: number | null
          metadata: Json | null
          sent_at: string
          delivered_at: string | null
          read_at: string | null
          created_at: string
          zernio_message_id: string | null
          workspace_id: string
          provider: string | null
          provider_message_id: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          reply_to_id?: string | null
          whatsapp_message_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          from_type: Database["public"]["Enums"]["message_from"]
          content?: string | null
          media_url?: string | null
          media_type?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          processed_by_nina?: boolean | null
          nina_response_time?: number | null
          metadata?: Json | null
          sent_at?: string
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
          zernio_message_id?: string | null
          workspace_id: string
          provider?: string | null
          provider_message_id?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          reply_to_id?: string | null
          whatsapp_message_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          from_type?: Database["public"]["Enums"]["message_from"]
          content?: string | null
          media_url?: string | null
          media_type?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          processed_by_nina?: boolean | null
          nina_response_time?: number | null
          metadata?: Json | null
          sent_at?: string
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
          zernio_message_id?: string | null
          workspace_id?: string
          provider?: string | null
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_templates: {
        Row: {
          id: string
          workspace_id: string
          channel_id: string | null
          meta_template_id: string | null
          name: string
          language: string
          category: string | null
          components: Json
          samples: Json | null
          labels: string[] | null
          status: string
          validation_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          channel_id?: string | null
          meta_template_id?: string | null
          name: string
          language?: string
          category?: string | null
          components?: Json
          samples?: Json | null
          labels?: string[] | null
          status?: string
          validation_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          channel_id?: string | null
          meta_template_id?: string | null
          name?: string
          language?: string
          category?: string | null
          components?: Json
          samples?: Json | null
          labels?: string[] | null
          status?: string
          validation_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      nina_processing_queue: {
        Row: {
          id: string
          message_id: string
          conversation_id: string
          contact_id: string
          context_data: Json | null
          status: Database["public"]["Enums"]["queue_status"]
          priority: number
          retry_count: number
          error_message: string | null
          scheduled_for: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          message_id: string
          conversation_id: string
          contact_id: string
          context_data?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          message_id?: string
          conversation_id?: string
          contact_id?: string
          context_data?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nina_processing_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      nina_settings: {
        Row: {
          id: string
          is_active: boolean
          system_prompt_override: string | null
          test_system_prompt: string | null
          elevenlabs_api_key: string | null
          elevenlabs_voice_id: string
          elevenlabs_model: string | null
          elevenlabs_stability: number
          elevenlabs_similarity_boost: number
          elevenlabs_style: number
          elevenlabs_speaker_boost: boolean
          elevenlabs_speed: number | null
          whatsapp_access_token: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_verify_token: string | null
          auto_response_enabled: boolean
          adaptive_response_enabled: boolean
          message_breaking_enabled: boolean
          response_delay_min: number
          response_delay_max: number
          timezone: string
          business_hours_start: string
          business_hours_end: string
          business_days: number[]
          async_booking_enabled: boolean | null
          route_all_to_receiver_enabled: boolean
          test_phone_numbers: Json | null
          created_at: string
          updated_at: string
          company_name: string | null
          sdr_name: string | null
          ai_model_mode: string | null
          audio_response_enabled: boolean | null
          ai_scheduling_enabled: boolean | null
          whatsapp_business_account_id: string | null
          user_id: string | null
          zernio_api_key: string | null
          zernio_profile_id: string | null
          zernio_webhook_id: string | null
          zernio_webhook_secret: string | null
          onboarding_completed_at: string | null
          onboarding_dismissed_at: string | null
          ai_provider: string
          ai_model: string | null
          anthropic_api_key: string | null
          openai_api_key: string | null
          whatsapp_webhook_key: string | null
          nylas_client_id: string | null
          nylas_api_key: string | null
          nylas_api_uri: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          system_prompt_override?: string | null
          test_system_prompt?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string
          elevenlabs_model?: string | null
          elevenlabs_stability?: number
          elevenlabs_similarity_boost?: number
          elevenlabs_style?: number
          elevenlabs_speaker_boost?: boolean
          elevenlabs_speed?: number | null
          whatsapp_access_token?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
          auto_response_enabled?: boolean
          adaptive_response_enabled?: boolean
          message_breaking_enabled?: boolean
          response_delay_min?: number
          response_delay_max?: number
          timezone?: string
          business_hours_start?: string
          business_hours_end?: string
          business_days?: number[]
          async_booking_enabled?: boolean | null
          route_all_to_receiver_enabled?: boolean
          test_phone_numbers?: Json | null
          created_at?: string
          updated_at?: string
          company_name?: string | null
          sdr_name?: string | null
          ai_model_mode?: string | null
          audio_response_enabled?: boolean | null
          ai_scheduling_enabled?: boolean | null
          whatsapp_business_account_id?: string | null
          user_id?: string | null
          zernio_api_key?: string | null
          zernio_profile_id?: string | null
          zernio_webhook_id?: string | null
          zernio_webhook_secret?: string | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          ai_provider?: string
          ai_model?: string | null
          anthropic_api_key?: string | null
          openai_api_key?: string | null
          whatsapp_webhook_key?: string | null
          nylas_client_id?: string | null
          nylas_api_key?: string | null
          nylas_api_uri?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          system_prompt_override?: string | null
          test_system_prompt?: string | null
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string
          elevenlabs_model?: string | null
          elevenlabs_stability?: number
          elevenlabs_similarity_boost?: number
          elevenlabs_style?: number
          elevenlabs_speaker_boost?: boolean
          elevenlabs_speed?: number | null
          whatsapp_access_token?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
          auto_response_enabled?: boolean
          adaptive_response_enabled?: boolean
          message_breaking_enabled?: boolean
          response_delay_min?: number
          response_delay_max?: number
          timezone?: string
          business_hours_start?: string
          business_hours_end?: string
          business_days?: number[]
          async_booking_enabled?: boolean | null
          route_all_to_receiver_enabled?: boolean
          test_phone_numbers?: Json | null
          created_at?: string
          updated_at?: string
          company_name?: string | null
          sdr_name?: string | null
          ai_model_mode?: string | null
          audio_response_enabled?: boolean | null
          ai_scheduling_enabled?: boolean | null
          whatsapp_business_account_id?: string | null
          user_id?: string | null
          zernio_api_key?: string | null
          zernio_profile_id?: string | null
          zernio_webhook_id?: string | null
          zernio_webhook_secret?: string | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          ai_provider?: string
          ai_model?: string | null
          anthropic_api_key?: string | null
          openai_api_key?: string | null
          whatsapp_webhook_key?: string | null
          nylas_client_id?: string | null
          nylas_api_key?: string | null
          nylas_api_uri?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nina_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nina_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          title: string
          color: string
          position: number
          is_system: boolean | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          ai_trigger_criteria: string | null
          is_ai_managed: boolean | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          title: string
          color?: string
          position?: number
          is_system?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          ai_trigger_criteria?: string | null
          is_ai_managed?: boolean | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          title?: string
          color?: string
          position?: number
          is_system?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          ai_trigger_criteria?: string | null
          is_ai_managed?: boolean | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          id: string
          content: string
          blocks: Json
          label: string | null
          source: string
          created_by: string | null
          eval_run_id: string | null
          created_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          content: string
          blocks?: Json
          label?: string | null
          source?: string
          created_by?: string | null
          eval_run_id?: string | null
          created_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          content?: string
          blocks?: Json
          label?: string | null
          source?: string
          created_by?: string | null
          eval_run_id?: string | null
          created_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_eval_run_id_fkey"
            columns: ["eval_run_id"]
            isOneToOne: false
            referencedRelation: "eval_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_jobs: {
        Row: {
          id: string
          workspace_id: string
          url: string
          fields: Json
          status: string
          contacts_found: number
          contacts_valid: number
          target_list_id: string | null
          result_data: Json | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          duration_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          url: string
          fields?: Json
          status?: string
          contacts_found?: number
          contacts_valid?: number
          target_list_id?: string | null
          result_data?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          url?: string
          fields?: Json
          status?: string
          contacts_found?: number
          contacts_valid?: number
          target_list_id?: string | null
          result_data?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraping_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      send_queue: {
        Row: {
          id: string
          conversation_id: string
          contact_id: string
          message_type: string
          from_type: string
          content: string | null
          media_url: string | null
          metadata: Json | null
          status: Database["public"]["Enums"]["queue_status"]
          priority: number
          retry_count: number
          error_message: string | null
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
          message_id: string | null
          workspace_id: string
          dedupe_key: string | null
          origin: string | null
          origin_id: string | null
          channel_id: string | null
          provider_message_id: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          contact_id: string
          message_type?: string
          from_type?: string
          content?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
          message_id?: string | null
          workspace_id: string
          dedupe_key?: string | null
          origin?: string | null
          origin_id?: string | null
          channel_id?: string | null
          provider_message_id?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          contact_id?: string
          message_type?: string
          from_type?: string
          content?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["queue_status"]
          priority?: number
          retry_count?: number
          error_message?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
          message_id?: string | null
          workspace_id?: string
          dedupe_key?: string | null
          origin?: string | null
          origin_id?: string | null
          channel_id?: string | null
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "send_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_definitions: {
        Row: {
          id: string
          key: string
          label: string
          color: string
          category: string
          is_active: boolean
          created_at: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          color?: string
          category?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          color?: string
          category?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_definitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_functions: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean | null
          created_at: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_functions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_functions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          name: string
          email: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          avatar: string | null
          team_id: string | null
          function_id: string | null
          weight: number | null
          last_active: string | null
          created_at: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          avatar?: string | null
          team_id?: string | null
          function_id?: string | null
          weight?: number | null
          last_active?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          avatar?: string | null
          team_id?: string | null
          function_id?: string | null
          weight?: number | null
          last_active?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "team_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string | null
          is_active: boolean | null
          created_at: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_questions: {
        Row: {
          id: string
          conversation_id: string | null
          contact_id: string | null
          question: string
          context: string | null
          status: string
          resolved_fact_id: string | null
          created_at: string
          workspace_id: string
          kind: string
          metadata: Json
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          contact_id?: string | null
          question: string
          context?: string | null
          status?: string
          resolved_fact_id?: string | null
          created_at?: string
          workspace_id: string
          kind?: string
          metadata?: Json
        }
        Update: {
          id?: string
          conversation_id?: string | null
          contact_id?: string | null
          question?: string
          context?: string | null
          status?: string
          resolved_fact_id?: string | null
          created_at?: string
          workspace_id?: string
          kind?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "unanswered_questions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_questions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_questions_resolved_fact_id_fkey"
            columns: ["resolved_fact_id"]
            isOneToOne: false
            referencedRelation: "knowledge_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          id: string
          workspace_id: string
          provider: string
          provider_event_id: string
          event_type: string | null
          payload: Json
          processed: boolean
          processed_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          provider: string
          provider_event_id: string
          event_type?: string | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          provider?: string
          provider_event_id?: string
          event_type?: string | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: Database["public"]["Enums"]["workspace_member_role"]
          can_publish_agent: boolean
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          can_publish_agent?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          can_publish_agent?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      zernio_webhook_events: {
        Row: {
          id: string
          event_id: string
          event_type: string
          payload: Json
          processed: boolean
          error: string | null
          created_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          event_id: string
          event_type: string
          payload?: Json
          processed?: boolean
          error?: string | null
          created_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          event_id?: string
          event_type?: string
          payload?: Json
          processed?: boolean
          error?: string | null
          created_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zernio_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contacts_with_stats: {
        Row: {
          id: string | null
          phone_number: string | null
          whatsapp_id: string | null
          name: string | null
          call_name: string | null
          email: string | null
          profile_picture_url: string | null
          is_business: boolean | null
          is_blocked: boolean | null
          blocked_at: string | null
          blocked_reason: string | null
          tags: string[] | null
          notes: string | null
          client_memory: Json | null
          first_contact_date: string | null
          last_activity: string | null
          created_at: string | null
          updated_at: string | null
          user_id: string | null
          total_messages: number | null
          nina_messages: number | null
          user_messages: number | null
          human_messages: number | null
        }
        Relationships: []
      }
      nina_settings_public: {
        Row: {
          id: string | null
          company_name: string | null
          sdr_name: string | null
          onboarding_completed_at: string | null
          onboarding_dismissed_at: string | null
          has_whatsapp_cloud: boolean | null
          has_zernio: boolean | null
          has_elevenlabs: boolean | null
          has_custom_prompt: boolean | null
          has_anthropic: boolean | null
          has_openai: boolean | null
          is_active: boolean | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_flow_pipeline: {
        Row: {
          workspace_id: string | null
          contact_id: string | null
          contato: string | null
          phone_e164: string | null
          role_title: string | null
          is_decision_maker: boolean | null
          lifecycle_status: string | null
          enrichment_score: number | null
          company_id: string | null
          empresa: string | null
          domain: string | null
          industry: string | null
          cadencias_ativas: number | null
          mensagens: number | null
          ultima_resposta: string | null
          deal_id: string | null
          oportunidade: string | null
          valor: number | null
          estagio: string | null
          etapa_atual: string | null
          created_at: string | null
          last_activity: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bootstrap_current_user: {
        Args: {
          _full_name?: string
        }
        Returns: undefined
      }
      can_edit_agent: {
        Args: {
          _workspace_id: string
          _user_id?: string
        }
        Returns: boolean
      }
      can_publish_agent: {
        Args: {
          _workspace_id: string
          _user_id?: string
        }
        Returns: boolean
      }
      claim_message_processing_batch: {
        Args: {
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["message_processing_queue"]["Row"][]
      }
      claim_nina_processing_batch: {
        Args: {
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["nina_processing_queue"]["Row"][]
      }
      claim_send_queue_batch: {
        Args: {
          p_limit?: number
        }
        Returns: Database["public"]["Tables"]["send_queue"]["Row"][]
      }
      contact_block: {
        Args: {
          p_contact_id: string
          p_motivo?: string
        }
        Returns: undefined
      }
      crm_ensure_deal: {
        Args: {
          p_workspace_id: string
          p_contact_id: string
          p_source?: string
        }
        Returns: string
      }
      crm_move_deal: {
        Args: {
          p_deal_id: string
          p_stage_id: string
          p_motivo?: string
        }
        Returns: undefined
      }
      current_workspace_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      enqueue_nina_processing: {
        Args: {
          p_message_id: string
          p_conversation_id: string
          p_contact_id: string
          p_delay_seconds?: number
          p_context?: Json
        }
        Returns: string
      }
      flow_enqueue_send: {
        Args: {
          p_workspace_id: string
          p_contact_id: string
          p_content: string
          p_origin: string
          p_dedupe_key: string
          p_origin_id?: string
          p_message_type?: string
          p_media_url?: string
          p_scheduled_at?: string
          p_channel_id?: string
        }
        Returns: string
      }
      flow_enroll_followup: {
        Args: {
          p_sequence_id: string
          p_contact_id: string
          p_variables?: Json
        }
        Returns: string
      }
      flow_ensure_conversation: {
        Args: {
          p_workspace_id: string
          p_contact_id: string
          p_channel?: string
        }
        Returns: string
      }
      flow_ingest_inbound: {
        Args: {
          p_workspace_id: string
          p_provider: string
          p_provider_message_id: string
          p_phone: string
          p_content: string
          p_message_type?: string
          p_media_url?: string
          p_contact_name?: string
          p_channel?: string
        }
        Returns: Json
      }
      flow_record_event: {
        Args: {
          p_workspace_id: string
          p_contact_id: string
          p_stage: string
          p_event_type: string
          p_title: string
          p_detail?: Json
          p_dedupe_key?: string
          p_company_id?: string
          p_deal_id?: string
          p_conversation_id?: string
        }
        Returns: string
      }
      flow_upsert_company: {
        Args: {
          p_workspace_id: string
          p_name: string
          p_domain?: string
          p_cnpj?: string
          p_data?: Json
          p_search_id?: string
        }
        Returns: string
      }
      flow_upsert_contact: {
        Args: {
          p_workspace_id: string
          p_name: string
          p_phone?: string
          p_email?: string
          p_company_id?: string
          p_role_title?: string
          p_is_decision_maker?: boolean
          p_source?: string
          p_data?: Json
        }
        Returns: string
      }
      get_current_agent_context: {
        Args: Record<PropertyKey, never>
        Returns: {
    workspace_id: string
    workspace_name: string
    member_role: Database["public"]["Enums"]["workspace_member_role"]
    can_publish: boolean
    agent_id: string
    agent_name: string
    agent_status: string
    published_version_id: string
    draft_id: string
    draft_config: Json
    draft_revision: number
    base_version_id: string
    draft_updated_at: string
        }[]
      }
      get_or_create_conversation_state: {
        Args: {
          p_conversation_id: string
        }
        Returns: Database["public"]["Tables"]["conversation_states"]["Row"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: {
          _workspace_id: string
          _user_id?: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: {
          _workspace_id: string
          _user_id?: string
        }
        Returns: boolean
      }
      lead_enrich_apply: {
        Args: {
          p_contact_id: string
          p_score: number
          p_data?: Json
        }
        Returns: undefined
      }
      normalize_phone: {
        Args: {
          p_raw: string
        }
        Returns: string
      }
      publish_agent_draft: {
        Args: {
          _agent_id: string
          _expected_revision: number
          _evaluation_run_id?: string
          _label?: string
          _accepted_warnings?: Json
        }
        Returns: Database["public"]["Tables"]["agent_versions"]["Row"]
      }
      save_agent_draft: {
        Args: {
          _agent_id: string
          _config: Json
          _expected_revision: number
        }
        Returns: Database["public"]["Tables"]["agent_drafts"]["Row"]
      }
      search_knowledge: {
        Args: {
          p_query: string
          p_limit?: number
        }
        Returns: {
    source_type: string
    source_id: string
    title: string
    content: string
    rank: number
        }[]
      }
      search_workspace_knowledge: {
        Args: {
          _workspace_id: string
          p_query: string
          p_limit?: number
        }
        Returns: {
    source_type: string
    source_id: string
    title: string
    content: string
    rank: number
        }[]
      }
      update_client_memory: {
        Args: {
          p_contact_id: string
          p_new_memory: Json
        }
        Returns: undefined
      }
      update_conversation_state: {
        Args: {
          p_conversation_id: string
          p_new_state: string
          p_action?: string
          p_context?: Json
        }
        Returns: Database["public"]["Tables"]["conversation_states"]["Row"]
      }
      webhook_claim: {
        Args: {
          p_workspace_id: string
          p_provider: string
          p_provider_event_id: string
          p_event_type?: string
          p_payload?: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      appointment_type: "demo" | "meeting" | "support" | "followup"
      conversation_status: "nina" | "human" | "paused"
      member_role: "admin" | "manager" | "agent"
      member_status: "active" | "invited" | "disabled"
      message_from: "user" | "nina" | "human"
      message_status: "sent" | "delivered" | "read" | "failed" | "processing"
      message_type: "text" | "audio" | "image" | "document" | "video"
      queue_status: "pending" | "processing" | "completed" | "failed"
      team_assignment: "mateus" | "igor" | "fe" | "vendas" | "suporte"
      workspace_member_role: "admin" | "editor" | "observer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      appointment_type: ["demo", "meeting", "support", "followup"],
      conversation_status: ["nina", "human", "paused"],
      member_role: ["admin", "manager", "agent"],
      member_status: ["active", "invited", "disabled"],
      message_from: ["user", "nina", "human"],
      message_status: ["sent", "delivered", "read", "failed", "processing"],
      message_type: ["text", "audio", "image", "document", "video"],
      queue_status: ["pending", "processing", "completed", "failed"],
      team_assignment: ["mateus", "igor", "fe", "vendas", "suporte"],
      workspace_member_role: ["admin", "editor", "observer"],
    },
  },
} as const
