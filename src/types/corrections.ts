import { Database, Json } from '@/integrations/supabase/types';

export type AnomalyType = Database['public']['Enums']['anomaly_type'];
export type CorrectionAction = Database['public']['Enums']['correction_action'];

export interface CorrectionEvent {
  id: string;
  worker_id: string;
  work_date: string;
  anomaly_type: AnomalyType;
  correction_action: CorrectionAction;
  payload: Json;
  justification: string;
  admin_id: string;
  created_at: string;
}

export interface CorrectionInsert {
  worker_id: string;
  work_date: string;
  anomaly_type: AnomalyType;
  correction_action: CorrectionAction;
  payload?: Json;
  justification: string;
  admin_id: string;
}

// Anomaly detection result
export interface DetectedAnomaly {
  worker_id: string;
  worker_name: string;
  work_date: string;
  anomaly_type: AnomalyType;
  description: string;
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
  }>;
}

// Day status after applying corrections
export type DayStatus = 'healthy' | 'incoherent' | 'corrected';

export interface DaySummary {
  worker_id: string;
  worker_name: string;
  work_date: string;
  status: DayStatus;
  anomalies: DetectedAnomaly[];
  corrections: CorrectionEvent[];
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    trust_status: string;
  }>;
}

// Labels for UI
export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  missing_end: 'Fin manquante',
  missing_take: 'Prise manquante',
  duplicate_take: 'Double prise',
  duplicate_end: 'Double fin',
  orphan_pause: 'Pause orpheline',
  orphan_resume: 'Reprise orpheline',
  invalid_sequence: 'Séquence invalide',
  time_overlap: 'Chevauchement horaire',
  other: 'Autre',
};

export const CORRECTION_ACTION_LABELS: Record<CorrectionAction, string> = {
  add_virtual_event: 'Ajouter événement virtuel',
  ignore_event: 'Ignorer événement',
  adjust_time: 'Ajuster horaire',
  mark_absent: 'Marquer absent',
  mark_complete: 'Marquer complet',
  other: 'Autre',
};
