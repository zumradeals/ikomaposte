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
          period_month: string
          source_hash: string
          source_row_count: number
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
          period_month: string
          source_hash: string
          source_row_count?: number
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
          period_month?: string
          source_hash?: string
          source_row_count?: number
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
      get_next_document_sequence: {
        Args: {
          p_document_type: Database["public"]["Enums"]["document_type"]
          p_period_month: string
        }
        Returns: number
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
      day_status: "PRESENT" | "RETARD" | "ABSENT" | "ANOMALIE"
      document_type: "RAP" | "PTG"
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
      day_status: ["PRESENT", "RETARD", "ABSENT", "ANOMALIE"],
      document_type: ["RAP", "PTG"],
      validation_status: ["DRAFT", "VALIDATED"],
      work_event_type: ["TAKE", "PAUSE", "RESUME", "END"],
    },
  },
} as const
