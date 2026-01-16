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
      admin_audit: {
        Row: {
          actor_user_id: string
          created_at: string
          device_id: string
          event: string
          id: string
          ip_address: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string
          created_at?: string
          device_id: string
          event: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          device_id?: string
          event?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_secrets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          pin_hash: string
          rotated_at: string | null
          rotated_by: string | null
          scope: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          pin_hash: string
          rotated_at?: string | null
          rotated_by?: string | null
          scope?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          pin_hash?: string
          rotated_at?: string | null
          rotated_by?: string | null
          scope?: string
        }
        Relationships: []
      }
      calculation_traces: {
        Row: {
          anomaly_reason: string | null
          calculation_inputs: Json
          calculation_outputs: Json
          conflicts_detected: Json | null
          created_at: string
          decision_path: string
          id: string
          overtime_breakdown: Json | null
          policy_version_id: string | null
          raw_punches: Json
          rounded_punches: Json | null
          rounding_details: Json | null
          rules_applied: Json
          summary_id: string
          work_date: string
          worker_id: string
        }
        Insert: {
          anomaly_reason?: string | null
          calculation_inputs: Json
          calculation_outputs: Json
          conflicts_detected?: Json | null
          created_at?: string
          decision_path: string
          id?: string
          overtime_breakdown?: Json | null
          policy_version_id?: string | null
          raw_punches: Json
          rounded_punches?: Json | null
          rounding_details?: Json | null
          rules_applied?: Json
          summary_id: string
          work_date: string
          worker_id: string
        }
        Update: {
          anomaly_reason?: string | null
          calculation_inputs?: Json
          calculation_outputs?: Json
          conflicts_detected?: Json | null
          created_at?: string
          decision_path?: string
          id?: string
          overtime_breakdown?: Json | null
          policy_version_id?: string | null
          raw_punches?: Json
          rounded_punches?: Json | null
          rounding_details?: Json | null
          rules_applied?: Json
          summary_id?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_traces_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_traces_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "work_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_traces_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          actif: boolean
          created_at: string
          devise: string
          id: string
          nom: string
          taux_horaire: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          devise?: string
          id?: string
          nom: string
          taux_horaire: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          devise?: string
          id?: string
          nom?: string
          taux_horaire?: number
          updated_at?: string
        }
        Relationships: []
      }
      correction_events: {
        Row: {
          admin_id: string
          anomaly_type: Database["public"]["Enums"]["anomaly_type"]
          correction_action: Database["public"]["Enums"]["correction_action"]
          created_at: string
          id: string
          justification: string
          payload: Json | null
          work_date: string
          worker_id: string
        }
        Insert: {
          admin_id: string
          anomaly_type: Database["public"]["Enums"]["anomaly_type"]
          correction_action: Database["public"]["Enums"]["correction_action"]
          created_at?: string
          id?: string
          justification: string
          payload?: Json | null
          work_date: string
          worker_id: string
        }
        Update: {
          admin_id?: string
          anomaly_type?: Database["public"]["Enums"]["anomaly_type"]
          correction_action?: Database["public"]["Enums"]["correction_action"]
          created_at?: string
          id?: string
          justification?: string
          payload?: Json | null
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          actif: boolean
          created_at: string
          device_id: string
          device_secret: string
          id: string
          label: string | null
          site_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          device_id: string
          device_secret: string
          id?: string
          label?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          device_id?: string
          device_secret?: string
          id?: string
          label?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          current_sequence: number
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          period_month: string
          updated_at: string
        }
        Insert: {
          current_sequence?: number
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          period_month: string
          updated_at?: string
        }
        Update: {
          current_sequence?: number
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          period_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category_id: string | null
          created_at: string
          document_code: string
          document_type: Database["public"]["Enums"]["document_type"]
          export_version: string
          file_size_bytes: number | null
          filters_json: Json
          generated_at: string
          generated_by: string
          id: string
          pdf_hash: string | null
          period_month: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          seal_block_json: Json | null
          signature_level: Database["public"]["Enums"]["signature_level"] | null
          signed_at: string | null
          signed_by: string | null
          source_hash: string
          source_row_count: number
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          worker_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          document_code: string
          document_type: Database["public"]["Enums"]["document_type"]
          export_version?: string
          file_size_bytes?: number | null
          filters_json?: Json
          generated_at?: string
          generated_by: string
          id?: string
          pdf_hash?: string | null
          period_month: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          seal_block_json?: Json | null
          signature_level?:
            | Database["public"]["Enums"]["signature_level"]
            | null
          signed_at?: string | null
          signed_by?: string | null
          source_hash: string
          source_row_count?: number
          status?: Database["public"]["Enums"]["document_status"]
          storage_path: string
          worker_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          document_code?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          export_version?: string
          file_size_bytes?: number | null
          filters_json?: Json
          generated_at?: string
          generated_by?: string
          id?: string
          pdf_hash?: string | null
          period_month?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          seal_block_json?: Json | null
          signature_level?:
            | Database["public"]["Enums"]["signature_level"]
            | null
          signed_at?: string | null
          signed_by?: string | null
          source_hash?: string
          source_row_count?: number
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_audit_trail: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string
          id: string
          justification: string | null
          new_state: Json | null
          policy_id: string
          previous_state: Json | null
          status_at_change: Database["public"]["Enums"]["policy_status"]
          version_at_change: number
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by: string
          id?: string
          justification?: string | null
          new_state?: Json | null
          policy_id: string
          previous_state?: Json | null
          status_at_change: Database["public"]["Enums"]["policy_status"]
          version_at_change: number
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string
          id?: string
          justification?: string | null
          new_state?: Json | null
          policy_id?: string
          previous_state?: Json | null
          status_at_change?: Database["public"]["Enums"]["policy_status"]
          version_at_change?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_audit_trail_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "time_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_conflicts: {
        Row: {
          conflict_type: string
          conflicting_policies: Json
          created_at: string
          description: string
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          work_date: string
          worker_id: string
        }
        Insert: {
          conflict_type: string
          conflicting_policies: Json
          created_at?: string
          description: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          work_date: string
          worker_id: string
        }
        Update: {
          conflict_type?: string
          conflicting_policies?: Json
          created_at?: string
          description?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_conflicts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          policy_version_id: string
          priority: number
          rule_type: Database["public"]["Enums"]["rule_type"]
          shift_pattern_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          policy_version_id: string
          priority?: number
          rule_type: Database["public"]["Enums"]["rule_type"]
          shift_pattern_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          policy_version_id?: string
          priority?: number
          rule_type?: Database["public"]["Enums"]["rule_type"]
          shift_pattern_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_rules_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_rules_shift_pattern_id_fkey"
            columns: ["shift_pattern_id"]
            isOneToOne: false
            referencedRelation: "shift_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_scopes: {
        Row: {
          created_at: string | null
          id: string
          policy_id: string
          priority: number | null
          scope_type: Database["public"]["Enums"]["policy_scope_type"]
          target_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          policy_id: string
          priority?: number | null
          scope_type: Database["public"]["Enums"]["policy_scope_type"]
          target_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          policy_id?: string
          priority?: number | null
          scope_type?: Database["public"]["Enums"]["policy_scope_type"]
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_scopes_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "time_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          change_reason: string | null
          created_at: string
          created_by: string
          id: string
          policy_id: string
          rules_snapshot: Json
          status: Database["public"]["Enums"]["policy_status"]
          superseded_by: string | null
          valid_from: string
          valid_to: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          created_by: string
          id?: string
          policy_id: string
          rules_snapshot?: Json
          status?: Database["public"]["Enums"]["policy_status"]
          superseded_by?: string | null
          valid_from: string
          valid_to?: string | null
          version_number: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          created_by?: string
          id?: string
          policy_id?: string
          rules_snapshot?: Json
          status?: Database["public"]["Enums"]["policy_status"]
          superseded_by?: string | null
          valid_from?: string
          valid_to?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "time_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_versions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rotation_calendars: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          policy_id: string
          rotation_pattern: Json
          start_date: string
          team_assignments: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          policy_id: string
          rotation_pattern: Json
          start_date: string
          team_assignments?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          policy_id?: string
          rotation_pattern?: Json
          start_date?: string
          team_assignments?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotation_calendars_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "time_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_patterns: {
        Row: {
          code: string
          created_at: string
          cross_day: boolean
          cross_day_strategy:
            | Database["public"]["Enums"]["cross_day_strategy"]
            | null
          id: string
          is_active: boolean
          name: string
          pattern_type: Database["public"]["Enums"]["shift_pattern_type"]
          shifts: Json
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          cross_day?: boolean
          cross_day_strategy?:
            | Database["public"]["Enums"]["cross_day_strategy"]
            | null
          id?: string
          is_active?: boolean
          name: string
          pattern_type: Database["public"]["Enums"]["shift_pattern_type"]
          shifts?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          cross_day?: boolean
          cross_day_strategy?:
            | Database["public"]["Enums"]["cross_day_strategy"]
            | null
          id?: string
          is_active?: boolean
          name?: string
          pattern_type?: Database["public"]["Enums"]["shift_pattern_type"]
          shifts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      time_policies: {
        Row: {
          applies_to_category_id: string | null
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          immutable_when_active: boolean | null
          is_active: boolean
          justification: string | null
          name: string
          overtime_rules: Json | null
          rounding_rules: Json | null
          status: Database["public"]["Enums"]["policy_status"] | null
          timezone: string | null
          tolerances: Json | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: number | null
          week_pattern: Json | null
        }
        Insert: {
          applies_to_category_id?: string | null
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          immutable_when_active?: boolean | null
          is_active?: boolean
          justification?: string | null
          name: string
          overtime_rules?: Json | null
          rounding_rules?: Json | null
          status?: Database["public"]["Enums"]["policy_status"] | null
          timezone?: string | null
          tolerances?: Json | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          week_pattern?: Json | null
        }
        Update: {
          applies_to_category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          immutable_when_active?: boolean | null
          is_active?: boolean
          justification?: string | null
          name?: string
          overtime_rules?: Json | null
          rounding_rules?: Json | null
          status?: Database["public"]["Enums"]["policy_status"] | null
          timezone?: string | null
          tolerances?: Json | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          week_pattern?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "time_policies_applies_to_category_id_fkey"
            columns: ["applies_to_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_events: {
        Row: {
          client_occurred_at: string | null
          created_at: string
          device_id: string
          device_secret: string | null
          event_type: Database["public"]["Enums"]["work_event_type"]
          id: string
          incident_flag: string | null
          occurred_at: string
          production_date: string | null
          snapshot_hash: string | null
          snapshot_url: string | null
          trust_reason: string | null
          trust_status: string
          worker_id: string
        }
        Insert: {
          client_occurred_at?: string | null
          created_at?: string
          device_id: string
          device_secret?: string | null
          event_type: Database["public"]["Enums"]["work_event_type"]
          id?: string
          incident_flag?: string | null
          occurred_at?: string
          production_date?: string | null
          snapshot_hash?: string | null
          snapshot_url?: string | null
          trust_reason?: string | null
          trust_status?: string
          worker_id: string
        }
        Update: {
          client_occurred_at?: string | null
          created_at?: string
          device_id?: string
          device_secret?: string | null
          event_type?: Database["public"]["Enums"]["work_event_type"]
          id?: string
          incident_flag?: string | null
          occurred_at?: string
          production_date?: string | null
          snapshot_hash?: string | null
          snapshot_url?: string | null
          trust_reason?: string | null
          trust_status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          category_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          tolerance_early_leave_minutes: number
          tolerance_late_minutes: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          tolerance_early_leave_minutes?: number
          tolerance_late_minutes?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          tolerance_early_leave_minutes?: number
          tolerance_late_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      work_summaries: {
        Row: {
          anomaly_code: Database["public"]["Enums"]["anomaly_code"] | null
          auto_close_time: string | null
          auto_closed: boolean
          calculated_at: string
          calculation_version: string
          created_at: string
          day_status: Database["public"]["Enums"]["day_status"] | null
          devise: string
          events_used: string[]
          hr_override_checkin: string | null
          hr_override_checkout: string | null
          hr_override_reason: string | null
          id: string
          is_current: boolean
          late_minutes: number | null
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          policy_version_id: string | null
          production_date: string | null
          revision: number
          segments_json: Json | null
          supersedes_id: string | null
          taux_horaire_applied: number
          total_amount: number
          total_pause_minutes: number
          total_work_minutes: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worker_id: string
        }
        Insert: {
          anomaly_code?: Database["public"]["Enums"]["anomaly_code"] | null
          auto_close_time?: string | null
          auto_closed?: boolean
          calculated_at?: string
          calculation_version?: string
          created_at?: string
          day_status?: Database["public"]["Enums"]["day_status"] | null
          devise?: string
          events_used?: string[]
          hr_override_checkin?: string | null
          hr_override_checkout?: string | null
          hr_override_reason?: string | null
          id?: string
          is_current?: boolean
          late_minutes?: number | null
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          policy_version_id?: string | null
          production_date?: string | null
          revision?: number
          segments_json?: Json | null
          supersedes_id?: string | null
          taux_horaire_applied?: number
          total_amount?: number
          total_pause_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worker_id: string
        }
        Update: {
          anomaly_code?: Database["public"]["Enums"]["anomaly_code"] | null
          auto_close_time?: string | null
          auto_closed?: boolean
          calculated_at?: string
          calculation_version?: string
          created_at?: string
          day_status?: Database["public"]["Enums"]["day_status"] | null
          devise?: string
          events_used?: string[]
          hr_override_checkin?: string | null
          hr_override_checkout?: string | null
          hr_override_reason?: string | null
          id?: string
          is_current?: boolean
          late_minutes?: number | null
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          policy_version_id?: string | null
          production_date?: string | null
          revision?: number
          segments_json?: Json | null
          supersedes_id?: string | null
          taux_horaire_applied?: number
          total_amount?: number
          total_pause_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_summaries_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_summaries_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "work_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_summaries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          actif: boolean
          category_id: string
          created_at: string
          id: string
          matricule: string
          nom_affiche: string
          photo_url: string | null
          qr_token: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          category_id: string
          created_at?: string
          id?: string
          matricule: string
          nom_affiche: string
          photo_url?: string | null
          qr_token?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          category_id?: string
          created_at?: string
          id?: string
          matricule?: string
          nom_affiche?: string
          photo_url?: string | null
          qr_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_policy: {
        Args: { p_justification?: string; p_policy_id: string }
        Returns: {
          applies_to_category_id: string | null
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          immutable_when_active: boolean | null
          is_active: boolean
          justification: string | null
          name: string
          overtime_rules: Json | null
          rounding_rules: Json | null
          status: Database["public"]["Enums"]["policy_status"] | null
          timezone: string | null
          tolerances: Json | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: number | null
          week_pattern: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "time_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_policy_version: {
        Args: { p_changes: Json; p_justification: string; p_policy_id: string }
        Returns: {
          applies_to_category_id: string | null
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          immutable_when_active: boolean | null
          is_active: boolean
          justification: string | null
          name: string
          overtime_rules: Json | null
          rounding_rules: Json | null
          status: Database["public"]["Enums"]["policy_status"] | null
          timezone: string | null
          tolerances: Json | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: number | null
          week_pattern: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "time_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_modify_document: { Args: { p_document_id: string }; Returns: boolean }
      check_policy_conflicts: {
        Args: { p_work_date: string; p_worker_id: string }
        Returns: Json
      }
      create_policy_version: {
        Args: {
          p_change_reason?: string
          p_policy_id: string
          p_rules: Json
          p_valid_from: string
        }
        Returns: {
          change_reason: string | null
          created_at: string
          created_by: string
          id: string
          policy_id: string
          rules_snapshot: Json
          status: Database["public"]["Enums"]["policy_status"]
          superseded_by: string | null
          valid_from: string
          valid_to: string | null
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "policy_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_summary_version: {
        Args: {
          p_auto_close_time: string
          p_auto_closed: boolean
          p_calculation_version: string
          p_devise: string
          p_events_used: string[]
          p_notes: string
          p_segments_json: Json
          p_taux_horaire_applied: number
          p_total_amount: number
          p_total_pause_minutes: number
          p_total_work_minutes: number
          p_work_date: string
          p_worker_id: string
        }
        Returns: {
          anomaly_code: Database["public"]["Enums"]["anomaly_code"] | null
          auto_close_time: string | null
          auto_closed: boolean
          calculated_at: string
          calculation_version: string
          created_at: string
          day_status: Database["public"]["Enums"]["day_status"] | null
          devise: string
          events_used: string[]
          hr_override_checkin: string | null
          hr_override_checkout: string | null
          hr_override_reason: string | null
          id: string
          is_current: boolean
          late_minutes: number | null
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          policy_version_id: string | null
          production_date: string | null
          revision: number
          segments_json: Json | null
          supersedes_id: string | null
          taux_horaire_applied: number
          total_amount: number
          total_pause_minutes: number
          total_work_minutes: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worker_id: string
        }
        SetofOptions: {
          from: "*"
          to: "work_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_applicable_policy: {
        Args: { p_work_date: string; p_worker_id: string }
        Returns: {
          policy_code: string
          policy_id: string
          policy_version_id: string
          rules_snapshot: Json
          version_number: number
        }[]
      }
      get_effective_policy: {
        Args: { p_work_date: string; p_worker_id: string }
        Returns: {
          overtime_rules: Json
          policy_code: string
          policy_id: string
          policy_name: string
          rounding_rules: Json
          scope_priority: number
          scope_type: Database["public"]["Enums"]["policy_scope_type"]
          timezone: string
          tolerances: Json
          version: number
          week_pattern: Json
        }[]
      }
      get_events_for_production_day: {
        Args: {
          p_production_date: string
          p_timezone?: string
          p_worker_id: string
        }
        Returns: {
          client_occurred_at: string | null
          created_at: string
          device_id: string
          device_secret: string | null
          event_type: Database["public"]["Enums"]["work_event_type"]
          id: string
          incident_flag: string | null
          occurred_at: string
          production_date: string | null
          snapshot_hash: string | null
          snapshot_url: string | null
          trust_reason: string | null
          trust_status: string
          worker_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "work_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_next_document_sequence: {
        Args: {
          p_document_type: Database["public"]["Enums"]["document_type"]
          p_period_month: string
        }
        Returns: number
      }
      get_production_date: {
        Args: { p_timestamp: string; p_timezone?: string }
        Returns: string
      }
      get_production_day_boundaries: {
        Args: { p_production_date: string; p_timezone?: string }
        Returns: {
          civil_date_end: string
          civil_date_start: string
          production_end: string
          production_start: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_validate_summaries: {
        Args: { p_summary_ids: string[] }
        Returns: Json
      }
      replay_policy_at: {
        Args: { p_policy_id: string; p_timestamp: string }
        Returns: Json
      }
      revoke_document: {
        Args: { p_document_id: string; p_reason: string }
        Returns: {
          category_id: string | null
          created_at: string
          document_code: string
          document_type: Database["public"]["Enums"]["document_type"]
          export_version: string
          file_size_bytes: number | null
          filters_json: Json
          generated_at: string
          generated_by: string
          id: string
          pdf_hash: string | null
          period_month: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          seal_block_json: Json | null
          signature_level: Database["public"]["Enums"]["signature_level"] | null
          signed_at: string | null
          signed_by: string | null
          source_hash: string
          source_row_count: number
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_document: {
        Args: {
          p_document_id: string
          p_pdf_hash: string
          p_seal_block: Json
          p_signature_level: Database["public"]["Enums"]["signature_level"]
        }
        Returns: {
          category_id: string | null
          created_at: string
          document_code: string
          document_type: Database["public"]["Enums"]["document_type"]
          export_version: string
          file_size_bytes: number | null
          filters_json: Json
          generated_at: string
          generated_by: string
          id: string
          pdf_hash: string | null
          period_month: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          seal_block_json: Json | null
          signature_level: Database["public"]["Enums"]["signature_level"] | null
          signed_at: string | null
          signed_by: string | null
          source_hash: string
          source_row_count: number
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_work_summary: {
        Args: { p_summary_id: string; p_validator_id: string }
        Returns: {
          anomaly_code: Database["public"]["Enums"]["anomaly_code"] | null
          auto_close_time: string | null
          auto_closed: boolean
          calculated_at: string
          calculation_version: string
          created_at: string
          day_status: Database["public"]["Enums"]["day_status"] | null
          devise: string
          events_used: string[]
          hr_override_checkin: string | null
          hr_override_checkout: string | null
          hr_override_reason: string | null
          id: string
          is_current: boolean
          late_minutes: number | null
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          policy_version_id: string | null
          production_date: string | null
          revision: number
          segments_json: Json | null
          supersedes_id: string | null
          taux_horaire_applied: number
          total_amount: number
          total_pause_minutes: number
          total_work_minutes: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worker_id: string
        }
        SetofOptions: {
          from: "*"
          to: "work_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      anomaly_code:
        | "NO_CHECKIN"
        | "NO_CHECKOUT"
        | "DUPLICATE_CHECKIN"
        | "DUPLICATE_CHECKOUT"
        | "INVALID_SEQUENCE"
        | "TIME_OVERLAP"
        | "FUTURE_EVENT"
        | "IMPOSSIBLE_DURATION"
      anomaly_type:
        | "missing_end"
        | "missing_take"
        | "duplicate_take"
        | "duplicate_end"
        | "orphan_pause"
        | "orphan_resume"
        | "invalid_sequence"
        | "time_overlap"
        | "other"
      app_role: "admin" | "user"
      correction_action:
        | "add_virtual_event"
        | "ignore_event"
        | "adjust_time"
        | "mark_absent"
        | "mark_complete"
        | "other"
      cross_day_strategy:
        | "MERGE_TO_START_DAY"
        | "MERGE_TO_END_DAY"
        | "SPLIT_AT_MIDNIGHT"
      day_status: "PRESENT" | "RETARD" | "ABSENT" | "ANOMALIE"
      document_status: "DRAFT_PDF" | "SIGNED" | "REVOKED"
      document_type: "RAP" | "PTG"
      overtime_mode: "DAILY" | "WEEKLY" | "OUTSIDE_SCHEDULE"
      policy_scope_type: "individual" | "team" | "category" | "default"
      policy_status: "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ARCHIVED"
      rounding_mode:
        | "NONE"
        | "QUARTER_CEIL"
        | "QUARTER_FLOOR"
        | "QUARTER_NEAREST"
      rule_type:
        | "SCHEDULE"
        | "ROUNDING"
        | "TOLERANCE"
        | "OVERTIME"
        | "NIGHT_SHIFT"
        | "BREAK"
        | "ROTATION"
      shift_pattern_type:
        | "DAY"
        | "MORNING"
        | "AFTERNOON"
        | "NIGHT"
        | "FLEX"
        | "ROTATING"
      signature_level: "VISUAL" | "SEALED" | "BOTH"
      validation_status: "DRAFT" | "VALIDATED"
      work_event_type: "TAKE" | "PAUSE" | "RESUME" | "END"
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
    Enums: {
      anomaly_code: [
        "NO_CHECKIN",
        "NO_CHECKOUT",
        "DUPLICATE_CHECKIN",
        "DUPLICATE_CHECKOUT",
        "INVALID_SEQUENCE",
        "TIME_OVERLAP",
        "FUTURE_EVENT",
        "IMPOSSIBLE_DURATION",
      ],
      anomaly_type: [
        "missing_end",
        "missing_take",
        "duplicate_take",
        "duplicate_end",
        "orphan_pause",
        "orphan_resume",
        "invalid_sequence",
        "time_overlap",
        "other",
      ],
      app_role: ["admin", "user"],
      correction_action: [
        "add_virtual_event",
        "ignore_event",
        "adjust_time",
        "mark_absent",
        "mark_complete",
        "other",
      ],
      cross_day_strategy: [
        "MERGE_TO_START_DAY",
        "MERGE_TO_END_DAY",
        "SPLIT_AT_MIDNIGHT",
      ],
      day_status: ["PRESENT", "RETARD", "ABSENT", "ANOMALIE"],
      document_status: ["DRAFT_PDF", "SIGNED", "REVOKED"],
      document_type: ["RAP", "PTG"],
      overtime_mode: ["DAILY", "WEEKLY", "OUTSIDE_SCHEDULE"],
      policy_scope_type: ["individual", "team", "category", "default"],
      policy_status: ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"],
      rounding_mode: [
        "NONE",
        "QUARTER_CEIL",
        "QUARTER_FLOOR",
        "QUARTER_NEAREST",
      ],
      rule_type: [
        "SCHEDULE",
        "ROUNDING",
        "TOLERANCE",
        "OVERTIME",
        "NIGHT_SHIFT",
        "BREAK",
        "ROTATION",
      ],
      shift_pattern_type: [
        "DAY",
        "MORNING",
        "AFTERNOON",
        "NIGHT",
        "FLEX",
        "ROTATING",
      ],
      signature_level: ["VISUAL", "SEALED", "BOTH"],
      validation_status: ["DRAFT", "VALIDATED"],
      work_event_type: ["TAKE", "PAUSE", "RESUME", "END"],
    },
  },
} as const
