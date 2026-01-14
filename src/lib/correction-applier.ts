// Correction Applier: Transforms raw events + corrections into effective events
// Build #1: Corrections appliquées au calcul

import { WorkEvent, WorkEventType } from '@/types/work-events';
import { CorrectionEvent, AnomalyType, CorrectionAction } from '@/types/corrections';
import { format, parseISO } from 'date-fns';

export interface VirtualEvent {
  id: string;
  worker_id: string;
  event_type: WorkEventType;
  occurred_at: string;
  trust_status: 'trusted';
  is_virtual: true;
  correction_id: string;
  correction_reason: string;
}

export type EffectiveEvent = (WorkEvent & { is_virtual?: false }) | VirtualEvent;

export interface CorrectionApplicationResult {
  effectiveEvents: EffectiveEvent[];
  appliedCorrections: CorrectionEvent[];
  notes: string[];
}

/**
 * Apply corrections to raw events and produce effective events list
 * 
 * Supported correction actions:
 * - add_virtual_event: Injects a synthetic event (e.g., missing END)
 * - ignore_event: Removes an event from calculation
 * - adjust_time: Modifies event timestamp
 * - mark_absent: Marks the day as absent (returns empty events)
 * - mark_complete: Validates the day as-is despite anomalies
 */
export function applyCorrections(
  rawEvents: WorkEvent[],
  corrections: CorrectionEvent[],
  workDate: string
): CorrectionApplicationResult {
  const notes: string[] = [];
  const appliedCorrections: CorrectionEvent[] = [];
  
  // Start with a copy of raw events (only trusted)
  let effectiveEvents: EffectiveEvent[] = rawEvents
    .filter(e => e.trust_status === 'trusted')
    .map(e => ({ ...e, is_virtual: false as const }));

  // Sort corrections by created_at to apply in order
  const sortedCorrections = [...corrections].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const correction of sortedCorrections) {
    const result = applySingleCorrection(effectiveEvents, correction, workDate);
    if (result.applied) {
      effectiveEvents = result.events;
      appliedCorrections.push(correction);
      notes.push(result.note);
    }
  }

  // Sort by occurred_at
  effectiveEvents.sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  return {
    effectiveEvents,
    appliedCorrections,
    notes,
  };
}

interface SingleCorrectionResult {
  applied: boolean;
  events: EffectiveEvent[];
  note: string;
}

function applySingleCorrection(
  events: EffectiveEvent[],
  correction: CorrectionEvent,
  workDate: string
): SingleCorrectionResult {
  const { anomaly_type, correction_action, payload, justification } = correction;
  const payloadData = (payload as Record<string, unknown>) || {};

  switch (correction_action) {
    case 'add_virtual_event':
      return applyAddVirtualEvent(events, correction, payloadData, workDate);
    
    case 'ignore_event':
      return applyIgnoreEvent(events, correction, payloadData);
    
    case 'adjust_time':
      return applyAdjustTime(events, correction, payloadData);
    
    case 'mark_absent':
      return {
        applied: true,
        events: [], // No events = absent day
        note: `Journée marquée absente: ${justification}`,
      };
    
    case 'mark_complete':
      // Mark as complete means we accept the events as-is
      return {
        applied: true,
        events,
        note: `Journée validée malgré anomalie (${anomaly_type}): ${justification}`,
      };
    
    default:
      return {
        applied: false,
        events,
        note: `Action non reconnue: ${correction_action}`,
      };
  }
}

function applyAddVirtualEvent(
  events: EffectiveEvent[],
  correction: CorrectionEvent,
  payload: Record<string, unknown>,
  workDate: string
): SingleCorrectionResult {
  const { anomaly_type, justification, id: correctionId, worker_id } = correction;
  
  // Determine event type based on anomaly
  let eventType: WorkEventType;
  let occurredAt: string;

  switch (anomaly_type) {
    case 'missing_end':
      eventType = 'END';
      // Use payload time or default to 18:00
      occurredAt = payload.time 
        ? `${workDate}T${payload.time}:00.000Z`
        : `${workDate}T18:00:00.000Z`;
      break;
    
    case 'missing_take':
      eventType = 'TAKE';
      // Use payload time or default to 08:00
      occurredAt = payload.time 
        ? `${workDate}T${payload.time}:00.000Z`
        : `${workDate}T08:00:00.000Z`;
      break;
    
    case 'orphan_pause':
      eventType = 'TAKE';
      // Find first PAUSE and insert TAKE before it
      const firstPause = events.find(e => e.event_type === 'PAUSE');
      if (firstPause) {
        const pauseTime = new Date(firstPause.occurred_at);
        pauseTime.setMinutes(pauseTime.getMinutes() - 1);
        occurredAt = pauseTime.toISOString();
      } else {
        occurredAt = payload.time 
          ? `${workDate}T${payload.time}:00.000Z`
          : `${workDate}T08:00:00.000Z`;
      }
      break;
    
    case 'orphan_resume':
      eventType = 'PAUSE';
      // Find first RESUME and insert PAUSE before it
      const firstResume = events.find(e => e.event_type === 'RESUME');
      if (firstResume) {
        const resumeTime = new Date(firstResume.occurred_at);
        resumeTime.setMinutes(resumeTime.getMinutes() - 1);
        occurredAt = resumeTime.toISOString();
      } else {
        occurredAt = payload.time 
          ? `${workDate}T${payload.time}:00.000Z`
          : `${workDate}T12:00:00.000Z`;
      }
      break;
    
    default:
      // Generic: use payload.event_type and payload.time
      eventType = (payload.event_type as WorkEventType) || 'END';
      occurredAt = payload.time 
        ? `${workDate}T${payload.time}:00.000Z`
        : `${workDate}T18:00:00.000Z`;
  }

  const virtualEvent: VirtualEvent = {
    id: `VIRTUAL_${correctionId}`,
    worker_id,
    event_type: eventType,
    occurred_at: occurredAt,
    trust_status: 'trusted',
    is_virtual: true,
    correction_id: correctionId,
    correction_reason: justification,
  };

  return {
    applied: true,
    events: [...events, virtualEvent],
    note: `${eventType} virtuel ajouté à ${format(parseISO(occurredAt), 'HH:mm')}: ${justification}`,
  };
}

function applyIgnoreEvent(
  events: EffectiveEvent[],
  correction: CorrectionEvent,
  payload: Record<string, unknown>
): SingleCorrectionResult {
  const { anomaly_type, justification } = correction;
  
  // Find event to ignore
  const eventId = payload.event_id as string | undefined;
  
  if (eventId) {
    // Ignore specific event by ID
    const filtered = events.filter(e => e.id !== eventId);
    if (filtered.length < events.length) {
      return {
        applied: true,
        events: filtered,
        note: `Événement ${eventId} ignoré: ${justification}`,
      };
    }
  }
  
  // Or ignore by anomaly type pattern
  switch (anomaly_type) {
    case 'duplicate_take':
      // Keep only the first TAKE
      let foundFirstTake = false;
      const withoutDupeTakes = events.filter(e => {
        if (e.event_type === 'TAKE') {
          if (!foundFirstTake) {
            foundFirstTake = true;
            return true;
          }
          return false;
        }
        return true;
      });
      return {
        applied: true,
        events: withoutDupeTakes,
        note: `TAKE doublons supprimés: ${justification}`,
      };
    
    case 'duplicate_end':
      // Keep only the last END
      const endEvents = events.filter(e => e.event_type === 'END');
      const lastEndId = endEvents.length > 0 ? endEvents[endEvents.length - 1].id : null;
      const withoutDupeEnds = events.filter(e => 
        e.event_type !== 'END' || e.id === lastEndId
      );
      return {
        applied: true,
        events: withoutDupeEnds,
        note: `END doublons supprimés: ${justification}`,
      };
    
    default:
      return {
        applied: false,
        events,
        note: `Aucun événement trouvé à ignorer pour ${anomaly_type}`,
      };
  }
}

function applyAdjustTime(
  events: EffectiveEvent[],
  correction: CorrectionEvent,
  payload: Record<string, unknown>
): SingleCorrectionResult {
  const { justification } = correction;
  const eventId = payload.event_id as string | undefined;
  const newTime = payload.new_time as string | undefined;
  
  if (!eventId || !newTime) {
    return {
      applied: false,
      events,
      note: 'Ajustement impossible: event_id ou new_time manquant',
    };
  }
  
  const eventIndex = events.findIndex(e => e.id === eventId);
  if (eventIndex === -1) {
    return {
      applied: false,
      events,
      note: `Événement ${eventId} non trouvé`,
    };
  }
  
  const event = events[eventIndex];
  const originalDate = event.occurred_at.split('T')[0];
  const adjustedEvent = {
    ...event,
    occurred_at: `${originalDate}T${newTime}:00.000Z`,
  };
  
  const updatedEvents = [...events];
  updatedEvents[eventIndex] = adjustedEvent;
  
  return {
    applied: true,
    events: updatedEvents,
    note: `Heure ajustée pour ${event.event_type}: ${newTime} (${justification})`,
  };
}

/**
 * Format applied corrections for notes field
 */
export function formatCorrectionsNotes(corrections: CorrectionEvent[]): string {
  if (corrections.length === 0) return '';
  
  const lines = corrections.map(c => 
    `[${c.anomaly_type}→${c.correction_action}] ${c.justification}`
  );
  
  return `Corrections appliquées (${corrections.length}): ${lines.join('; ')}`;
}
