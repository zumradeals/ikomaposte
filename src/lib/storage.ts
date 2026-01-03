import { DeviceInfo, AdminEvent } from '@/types/ikoma';

const DEVICE_ID_KEY = 'ikoma_device_id';
const ADMIN_EVENTS_KEY = 'ikoma_admin_events';

// Generate a unique device ID
function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `IKOMA-${timestamp}-${randomPart}`.toUpperCase();
}

// Get or create device ID (persistent)
export function getDeviceId(): string {
  let stored = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!stored) {
    const deviceInfo: DeviceInfo = {
      device_id: generateDeviceId(),
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    localStorage.setItem(DEVICE_ID_KEY, JSON.stringify(deviceInfo));
    stored = JSON.stringify(deviceInfo);
  } else {
    // Update last_seen
    try {
      const deviceInfo: DeviceInfo = JSON.parse(stored);
      deviceInfo.last_seen = new Date().toISOString();
      localStorage.setItem(DEVICE_ID_KEY, JSON.stringify(deviceInfo));
    } catch {
      // If corrupted, regenerate
      const deviceInfo: DeviceInfo = {
        device_id: generateDeviceId(),
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      };
      localStorage.setItem(DEVICE_ID_KEY, JSON.stringify(deviceInfo));
      stored = JSON.stringify(deviceInfo);
    }
  }
  
  try {
    return JSON.parse(stored).device_id;
  } catch {
    return generateDeviceId();
  }
}

// Get device info
export function getDeviceInfo(): DeviceInfo | null {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Admin events (append-only log)
export function getAdminEvents(): AdminEvent[] {
  const stored = localStorage.getItem(ADMIN_EVENTS_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function appendAdminEvent(event: Omit<AdminEvent, 'id' | 'timestamp' | 'device_id'>): AdminEvent {
  const events = getAdminEvents();
  
  const newEvent: AdminEvent = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    device_id: getDeviceId(),
    ...event,
  };
  
  events.push(newEvent);
  localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(events));
  
  console.log('[IKOMA] Admin event logged:', newEvent.event_type);
  return newEvent;
}
