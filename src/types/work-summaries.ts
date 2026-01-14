// Phase 4: Work Summaries Types
// Build #1: Versioning + Locking

export interface WorkSegment {
  start_event_id: string;
  end_event_id: string;
  start_type: 'TAKE' | 'RESUME';
  end_type: 'PAUSE' | 'END';
  start_at: string;
  end_at: string;
  duration_minutes: number;
  is_auto_closed: boolean;
  is_virtual?: boolean; // True if segment includes virtual events
}

export interface WorkSummary {
  id: string;
  worker_id: string;
  work_date: string;
  total_work_minutes: number;
  total_pause_minutes: number;
  total_amount: number;
  devise: string;
  taux_horaire_applied: number;
  auto_closed: boolean;
  auto_close_time: string | null;
  calculation_version: string;
  calculated_at: string;
  events_used: string[];
  segments_json: WorkSegment[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Build #1: Versioning fields
  revision: number;
  is_current: boolean;
  supersedes_id: string | null;
  // Build #1: Locking fields
  locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
}

export interface WorkSummaryWithWorker extends WorkSummary {
  workers: {
    id: string;
    nom_affiche: string;
    matricule: string;
    photo_url: string | null;
    categories: {
      id: string;
      nom: string;
      taux_horaire: number;
      devise: string;
    } | null;
  } | null;
}

export interface CalculationResult {
  success: boolean;
  summary?: Partial<WorkSummary>;
  error?: string;
  warnings: string[];
  correctionsApplied?: number;
}

// Default auto-close time (18:00)
export const DEFAULT_AUTO_CLOSE_HOUR = 18;
export const DEFAULT_AUTO_CLOSE_MINUTE = 0;

// Calculation version - increment when engine logic changes
export const CALCULATION_VERSION = 'v1.1';

// Lock rejection error
export class SummaryLockError extends Error {
  constructor(
    public readonly summaryId: string,
    public readonly lockedBy: string | null,
    public readonly lockedAt: string | null
  ) {
    super(`Summary ${summaryId} is locked and cannot be superseded`);
    this.name = 'SummaryLockError';
  }
}
