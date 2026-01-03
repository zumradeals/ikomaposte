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

// Future placeholders (Phase 2+)
export interface Worker {
  id: string;
  name: string;
  qr_code: string;
  category_id: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Shift {
  id: string;
  date: string;
  status: 'open' | 'closed';
}

// Pointage events (Phase 2+)
export type PointageEventType = 
  | 'SHIFT_START' 
  | 'PAUSE_START' 
  | 'PAUSE_END' 
  | 'SHIFT_END';

export interface PointageEvent {
  id: string;
  timestamp: string;
  device_id: string;
  worker_id: string;
  shift_id: string;
  event_type: PointageEventType;
}
