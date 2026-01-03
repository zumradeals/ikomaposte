// IKOMA POSTE - Core Types for Phase 1

// Event system (append-only)
export type AdminEventType = 'ADMIN_UNLOCK' | 'ADMIN_LOCK';

export interface AdminEvent {
  id: string;
  timestamp: string;
  device_id: string;
  event_type: AdminEventType;
  actor: 'admin' | 'system';
  optional_reason?: string;
}

// Device identification
export interface DeviceInfo {
  device_id: string;
  created_at: string;
  last_seen: string;
}

// Admin session state
export interface AdminSession {
  isUnlocked: boolean;
  unlockedAt: string | null;
  expiresAt: string | null;
}

// Re-export from hooks for backwards compatibility
// Main worker/category types are now in useWorkers.ts and useCategories.ts

// Work event types moved to work-events.ts
export type { 
  WorkEventType, 
  WorkEvent, 
  WorkEventWithWorker 
} from './work-events';
