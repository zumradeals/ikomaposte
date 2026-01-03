// Phase 4: Work Time Calculator
// Transforms TRUSTED events into work segments and calculates durations/amounts

import { WorkEvent, WorkEventType } from '@/types/work-events';
import { 
  WorkSegment, 
  CalculationResult, 
  DEFAULT_AUTO_CLOSE_HOUR, 
  DEFAULT_AUTO_CLOSE_MINUTE,
  CALCULATION_VERSION 
} from '@/types/work-summaries';

interface WorkerCategory {
  taux_horaire: number;
  devise: string;
}

interface CalculationOptions {
  autoCloseHour?: number;
  autoCloseMinute?: number;
  workDate: Date;
}

/**
 * Calculate work segments from a sorted list of TRUSTED events
 * Valid transitions:
 * - TAKE → PAUSE (work segment)
 * - TAKE → END (work segment)
 * - RESUME → PAUSE (work segment)
 * - RESUME → END (work segment)
 */
export function calculateWorkSegments(
  events: WorkEvent[],
  options: CalculationOptions
): { segments: WorkSegment[]; warnings: string[]; autoCloseApplied: boolean } {
  const segments: WorkSegment[] = [];
  const warnings: string[] = [];
  let autoCloseApplied = false;

  // Sort events by occurred_at
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Filter only TRUSTED events
  const trustedEvents = sortedEvents.filter(e => e.trust_status === 'trusted');

  if (trustedEvents.length === 0) {
    return { segments, warnings: ['Aucun événement vérifié trouvé'], autoCloseApplied };
  }

  let currentWorkStart: WorkEvent | null = null;
  let lastPauseStart: WorkEvent | null = null;

  for (let i = 0; i < trustedEvents.length; i++) {
    const event = trustedEvents[i];

    switch (event.event_type) {
      case 'TAKE':
        if (currentWorkStart) {
          warnings.push(`Double TAKE détecté à ${event.occurred_at}`);
        }
        currentWorkStart = event;
        lastPauseStart = null;
        break;

      case 'PAUSE':
        if (!currentWorkStart) {
          warnings.push(`PAUSE sans TAKE à ${event.occurred_at}`);
        } else {
          // Create work segment from TAKE/RESUME to PAUSE
          segments.push({
            start_event_id: currentWorkStart.id,
            end_event_id: event.id,
            start_type: currentWorkStart.event_type as 'TAKE' | 'RESUME',
            end_type: 'PAUSE',
            start_at: currentWorkStart.occurred_at,
            end_at: event.occurred_at,
            duration_minutes: calculateMinutes(currentWorkStart.occurred_at, event.occurred_at),
            is_auto_closed: false,
          });
          lastPauseStart = event;
          currentWorkStart = null;
        }
        break;

      case 'RESUME':
        if (!lastPauseStart) {
          warnings.push(`RESUME sans PAUSE à ${event.occurred_at}`);
        } else {
          currentWorkStart = event;
          lastPauseStart = null;
        }
        break;

      case 'END':
        if (!currentWorkStart && !lastPauseStart) {
          warnings.push(`END sans TAKE/RESUME à ${event.occurred_at}`);
        } else if (currentWorkStart) {
          // Create work segment from TAKE/RESUME to END
          segments.push({
            start_event_id: currentWorkStart.id,
            end_event_id: event.id,
            start_type: currentWorkStart.event_type as 'TAKE' | 'RESUME',
            end_type: 'END',
            start_at: currentWorkStart.occurred_at,
            end_at: event.occurred_at,
            duration_minutes: calculateMinutes(currentWorkStart.occurred_at, event.occurred_at),
            is_auto_closed: false,
          });
          currentWorkStart = null;
          lastPauseStart = null;
        } else if (lastPauseStart) {
          // END after PAUSE - just close the shift without adding pause time
          lastPauseStart = null;
        }
        break;
    }
  }

  // Handle incomplete shift (no END at end of day)
  if (currentWorkStart) {
    const autoCloseHour = options.autoCloseHour ?? DEFAULT_AUTO_CLOSE_HOUR;
    const autoCloseMinute = options.autoCloseMinute ?? DEFAULT_AUTO_CLOSE_MINUTE;
    
    // Create auto-close time
    const autoCloseTime = new Date(options.workDate);
    autoCloseTime.setHours(autoCloseHour, autoCloseMinute, 0, 0);
    
    // Only auto-close if the work start is before auto-close time
    const workStartTime = new Date(currentWorkStart.occurred_at);
    if (workStartTime < autoCloseTime) {
      segments.push({
        start_event_id: currentWorkStart.id,
        end_event_id: 'AUTO_CLOSE',
        start_type: currentWorkStart.event_type as 'TAKE' | 'RESUME',
        end_type: 'END',
        start_at: currentWorkStart.occurred_at,
        end_at: autoCloseTime.toISOString(),
        duration_minutes: calculateMinutes(currentWorkStart.occurred_at, autoCloseTime.toISOString()),
        is_auto_closed: true,
      });
      autoCloseApplied = true;
      warnings.push(`Clôture automatique appliquée à ${autoCloseHour}:${autoCloseMinute.toString().padStart(2, '0')}`);
    } else {
      warnings.push(`TAKE/RESUME après l'heure de clôture - non comptabilisé`);
    }
  }

  return { segments, warnings, autoCloseApplied };
}

/**
 * Calculate total work and pause minutes from segments
 */
export function calculateTotals(segments: WorkSegment[]): {
  totalWorkMinutes: number;
  totalPauseMinutes: number;
} {
  const totalWorkMinutes = segments.reduce((sum, seg) => sum + seg.duration_minutes, 0);
  
  // Calculate pause time (gaps between consecutive segments on same day)
  let totalPauseMinutes = 0;
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = new Date(segments[i - 1].end_at);
    const currStart = new Date(segments[i].start_at);
    if (segments[i - 1].end_type === 'PAUSE') {
      totalPauseMinutes += Math.floor((currStart.getTime() - prevEnd.getTime()) / 60000);
    }
  }

  return { totalWorkMinutes, totalPauseMinutes };
}

/**
 * Calculate amount based on worked minutes and hourly rate
 */
export function calculateAmount(
  totalWorkMinutes: number,
  category: WorkerCategory
): { amount: number; devise: string } {
  const hours = totalWorkMinutes / 60;
  const amount = Math.round(hours * category.taux_horaire * 100) / 100; // Round to 2 decimals
  return { amount, devise: category.devise };
}

/**
 * Full calculation for a worker's day
 */
export function calculateWorkerDay(
  events: WorkEvent[],
  category: WorkerCategory,
  workDate: Date,
  autoCloseHour?: number,
  autoCloseMinute?: number
): CalculationResult {
  const warnings: string[] = [];

  try {
    // Filter only trusted events
    const trustedEvents = events.filter(e => e.trust_status === 'trusted');
    
    if (trustedEvents.length === 0) {
      return {
        success: false,
        error: 'Aucun événement vérifié pour cette journée',
        warnings: ['Tous les événements sont non vérifiés'],
      };
    }

    // Calculate segments
    const { segments, warnings: segmentWarnings, autoCloseApplied } = calculateWorkSegments(
      trustedEvents,
      { workDate, autoCloseHour, autoCloseMinute }
    );

    warnings.push(...segmentWarnings);

    if (segments.length === 0) {
      return {
        success: false,
        error: 'Aucun segment de travail valide',
        warnings,
      };
    }

    // Calculate totals
    const { totalWorkMinutes, totalPauseMinutes } = calculateTotals(segments);
    const { amount, devise } = calculateAmount(totalWorkMinutes, category);

    // Build summary
    const summary = {
      id: '', // Will be set by database
      worker_id: trustedEvents[0].worker_id,
      work_date: workDate.toISOString().split('T')[0],
      total_work_minutes: totalWorkMinutes,
      total_pause_minutes: totalPauseMinutes,
      total_amount: amount,
      devise,
      taux_horaire_applied: category.taux_horaire,
      auto_closed: autoCloseApplied,
      auto_close_time: autoCloseApplied ? `${autoCloseHour ?? DEFAULT_AUTO_CLOSE_HOUR}:${(autoCloseMinute ?? DEFAULT_AUTO_CLOSE_MINUTE).toString().padStart(2, '0')}:00` : null,
      calculation_version: CALCULATION_VERSION,
      calculated_at: new Date().toISOString(),
      events_used: trustedEvents.map(e => e.id),
      segments_json: segments,
      notes: warnings.length > 0 ? warnings.join('; ') : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      success: true,
      summary,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de calcul',
      warnings,
    };
  }
}

// Helper: Calculate minutes between two ISO date strings
function calculateMinutes(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.floor((endTime - startTime) / 60000);
}

// Helper: Format minutes as HH:MM
export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

// Helper: Format amount with currency
export function formatAmount(amount: number, devise: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise === 'XOF' ? 'XOF' : devise,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
