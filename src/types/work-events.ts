// Phase 3: Work Events Types

export type WorkEventType = 'TAKE' | 'PAUSE' | 'RESUME' | 'END';

export interface WorkEvent {
  id: string;
  worker_id: string;
  event_type: WorkEventType;
  occurred_at: string;
  device_id: string;
  snapshot_url: string | null;
  snapshot_hash: string | null;
  incident_flag: string | null;
  created_at: string;
}

export interface WorkEventWithWorker extends WorkEvent {
  workers: {
    id: string;
    nom_affiche: string;
    matricule: string;
    photo_url: string | null;
    categories: {
      id: string;
      nom: string;
    } | null;
  } | null;
}

// State machine: allowed transitions
export const ALLOWED_TRANSITIONS: Record<WorkEventType | 'NONE', WorkEventType[]> = {
  NONE: ['TAKE'],           // Can only start with TAKE
  TAKE: ['PAUSE', 'END'],   // After TAKE: can pause or end
  PAUSE: ['RESUME', 'END'], // After PAUSE: can resume or end
  RESUME: ['PAUSE', 'END'], // After RESUME: can pause or end
  END: ['TAKE'],            // After END: can start new shift
};

export const EVENT_LABELS: Record<WorkEventType, string> = {
  TAKE: 'Prise de poste',
  PAUSE: 'Pause',
  RESUME: 'Reprise',
  END: 'Fin de poste',
};

export const EVENT_COLORS: Record<WorkEventType, string> = {
  TAKE: 'bg-success text-success-foreground',
  PAUSE: 'bg-warning text-warning-foreground',
  RESUME: 'bg-primary text-primary-foreground',
  END: 'bg-destructive text-destructive-foreground',
};

export const EVENT_ICONS: Record<WorkEventType, string> = {
  TAKE: '🟢',
  PAUSE: '🟡',
  RESUME: '🔵',
  END: '🔴',
};
