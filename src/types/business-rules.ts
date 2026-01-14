// ============================================
// Phase 7: Business Rules Types
// Règles métier IKOMA - Types officiels
// ============================================

// ----------------------
// Enums (liste fermée)
// ----------------------

/** Statut journalier - calculé automatiquement par le système */
export type DayStatusType = 'PRESENT' | 'RETARD' | 'ABSENT' | 'ANOMALIE';

/** Code d'anomalie - liste fermée pour classification */
export type AnomalyCodeType = 
  | 'NO_CHECKIN'           // Pas de pointage entrée
  | 'NO_CHECKOUT'          // Pas de pointage sortie
  | 'DUPLICATE_CHECKIN'    // Double pointage entrée
  | 'DUPLICATE_CHECKOUT'   // Double pointage sortie
  | 'INVALID_SEQUENCE'     // Séquence d'événements invalide
  | 'TIME_OVERLAP'         // Chevauchement horaire
  | 'FUTURE_EVENT'         // Événement dans le futur
  | 'IMPOSSIBLE_DURATION'; // Durée impossible (ex: >24h)

/** Statut de validation RH */
export type ValidationStatusType = 'DRAFT' | 'VALIDATED';

// ----------------------
// Horaires théoriques
// ----------------------

export interface WorkSchedule {
  id: string;
  category_id: string;
  day_of_week: number; // 0=dimanche, 1=lundi, ..., 6=samedi
  start_time: string;  // Format HH:MM:SS
  end_time: string;    // Format HH:MM:SS
  tolerance_late_minutes: number;
  tolerance_early_leave_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkScheduleInsert {
  category_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  tolerance_late_minutes?: number;
  tolerance_early_leave_minutes?: number;
  is_active?: boolean;
}

export interface WorkScheduleWithCategory extends WorkSchedule {
  categories: {
    id: string;
    nom: string;
  } | null;
}

// ----------------------
// Table de décision
// ----------------------

export interface DecisionInput {
  /** Heure d'arrivée réelle (null si absent) */
  actual_checkin: string | null;
  /** Heure de départ réelle (null si absent) */
  actual_checkout: string | null;
  /** Horaire théorique pour ce jour */
  schedule: WorkSchedule | null;
  /** Événements bruts de la journée */
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
  }>;
}

export interface DecisionResult {
  /** Statut jour calculé */
  day_status: DayStatusType;
  /** Code anomalie si ANOMALIE */
  anomaly_code: AnomalyCodeType | null;
  /** Minutes travaillées (uniquement si PRESENT ou RETARD) */
  total_work_minutes: number;
  /** Minutes de retard (si RETARD) */
  late_minutes: number;
  /** Raison lisible */
  reason: string;
}

// ----------------------
// Validation RH
// ----------------------

export interface ValidationInfo {
  validation_status: ValidationStatusType;
  validated_by: string | null;
  validated_at: string | null;
}

export interface ValidateSummaryParams {
  summary_id: string;
  validator_id: string;
}

// ----------------------
// Work Summary étendu avec Phase 7
// ----------------------

export interface WorkSummaryPhase7 {
  id: string;
  worker_id: string;
  work_date: string;
  // Métriques (en minutes uniquement)
  total_work_minutes: number;
  total_pause_minutes: number; // Log interne uniquement, exclu des exports
  total_amount: number;
  devise: string;
  taux_horaire_applied: number;
  // Statuts métier Phase 7
  day_status: DayStatusType | null;
  anomaly_code: AnomalyCodeType | null;
  // Validation RH
  validation_status: ValidationStatusType;
  validated_by: string | null;
  validated_at: string | null;
  // Verrouillage
  locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  // Métadonnées calcul
  auto_closed: boolean;
  auto_close_time: string | null;
  calculation_version: string;
  events_used: string[];
  segments_json: unknown;
  notes: string | null;
  // Versioning
  revision: number;
  is_current: boolean;
  supersedes_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  calculated_at: string;
}

// ----------------------
// Labels pour l'UI
// ----------------------

export const DAY_STATUS_LABELS: Record<DayStatusType, string> = {
  PRESENT: 'Présent',
  RETARD: 'Retard',
  ABSENT: 'Absent',
  ANOMALIE: 'Anomalie',
};

export const DAY_STATUS_COLORS: Record<DayStatusType, string> = {
  PRESENT: 'bg-success/20 text-success border-success/30',
  RETARD: 'bg-warning/20 text-warning border-warning/30',
  ABSENT: 'bg-muted text-muted-foreground border-muted',
  ANOMALIE: 'bg-destructive/20 text-destructive border-destructive/30',
};

export const ANOMALY_CODE_LABELS: Record<AnomalyCodeType, string> = {
  NO_CHECKIN: 'Pas de pointage entrée',
  NO_CHECKOUT: 'Pas de pointage sortie',
  DUPLICATE_CHECKIN: 'Double pointage entrée',
  DUPLICATE_CHECKOUT: 'Double pointage sortie',
  INVALID_SEQUENCE: 'Séquence invalide',
  TIME_OVERLAP: 'Chevauchement horaire',
  FUTURE_EVENT: 'Événement futur',
  IMPOSSIBLE_DURATION: 'Durée impossible',
};

export const VALIDATION_STATUS_LABELS: Record<ValidationStatusType, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
};

export const VALIDATION_STATUS_COLORS: Record<ValidationStatusType, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-muted',
  VALIDATED: 'bg-success/20 text-success border-success/30',
};

// ----------------------
// Jours de la semaine
// ----------------------

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dim',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
};
