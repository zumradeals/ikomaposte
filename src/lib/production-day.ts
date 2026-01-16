// ============================================
// IKOMA Production Day (Jour de Production)
// ============================================
//
// A production day runs from 07:00 to 07:00 the next day.
// Events before 07:00 belong to the PREVIOUS production day.
//
// This is mandatory for correctly handling:
// - Night shifts
// - Shift rotations (3x8)
// - Overtime calculations
//
// The system always computes both:
// - civil_date: The calendar date of the punch
// - production_date: The business day for all calculations
//

/**
 * Production day boundary hour (07:00)
 * Events before this hour belong to the previous production day
 */
export const PRODUCTION_DAY_START_HOUR = 7;

/**
 * Default timezone for IKOMA (West Africa)
 */
export const DEFAULT_TIMEZONE = 'Africa/Abidjan';

/**
 * Result of production date calculation
 */
export interface ProductionDateResult {
  /** The calendar date of the timestamp */
  civil_date: string; // YYYY-MM-DD
  /** The production day for calculations */
  production_date: string; // YYYY-MM-DD
  /** Whether the punch was before the production day boundary */
  is_early_morning: boolean;
  /** The hour of the punch (0-23) */
  punch_hour: number;
}

/**
 * Production day boundaries (start and end timestamps)
 */
export interface ProductionDayBoundaries {
  /** Start of the production day (07:00 on production_date) */
  production_start: Date;
  /** End of the production day (07:00 next day) */
  production_end: Date;
  /** First civil date covered */
  civil_date_start: string; // YYYY-MM-DD
  /** Second civil date covered (next day) */
  civil_date_end: string; // YYYY-MM-DD
}

/**
 * Calculate the production date from a timestamp.
 * 
 * Production day rules:
 * - A production day starts at 07:00 and ends at 07:00 the next day
 * - Punches from 07:00 to 23:59 → same day is production_date
 * - Punches from 00:00 to 06:59 → previous day is production_date
 * 
 * @example
 * // Punch at 08:00 on 2026-01-16 → production_date = 2026-01-16
 * getProductionDate(new Date('2026-01-16T08:00:00'))
 * 
 * // Punch at 03:00 on 2026-01-17 → production_date = 2026-01-16
 * getProductionDate(new Date('2026-01-17T03:00:00'))
 */
export function getProductionDate(
  timestamp: Date,
  timezone: string = DEFAULT_TIMEZONE
): ProductionDateResult {
  // Get local time in the specified timezone
  const localTime = getLocalTime(timestamp, timezone);
  const hour = localTime.getHours();
  
  // Civil date is always the calendar date
  const civilDate = formatDate(localTime);
  
  // Check if punch is before production day boundary (07:00)
  const isEarlyMorning = hour < PRODUCTION_DAY_START_HOUR;
  
  // Production date: subtract one day if before 07:00
  let productionDate: string;
  if (isEarlyMorning) {
    const previousDay = new Date(localTime);
    previousDay.setDate(previousDay.getDate() - 1);
    productionDate = formatDate(previousDay);
  } else {
    productionDate = civilDate;
  }
  
  return {
    civil_date: civilDate,
    production_date: productionDate,
    is_early_morning: isEarlyMorning,
    punch_hour: hour,
  };
}

/**
 * Get the boundaries (start and end timestamps) for a production day.
 * 
 * @example
 * // Production day 2026-01-16 runs from:
 * // 2026-01-16 07:00:00 to 2026-01-17 07:00:00
 */
export function getProductionDayBoundaries(
  productionDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): ProductionDayBoundaries {
  // Normalize to Date object
  const baseDate = typeof productionDate === 'string' 
    ? new Date(productionDate + 'T00:00:00')
    : productionDate;
  
  // Start: 07:00 on production_date
  const productionStart = new Date(baseDate);
  productionStart.setHours(PRODUCTION_DAY_START_HOUR, 0, 0, 0);
  
  // End: 07:00 on next day
  const productionEnd = new Date(baseDate);
  productionEnd.setDate(productionEnd.getDate() + 1);
  productionEnd.setHours(PRODUCTION_DAY_START_HOUR, 0, 0, 0);
  
  // Civil dates covered
  const civilDateStart = formatDate(baseDate);
  const nextDay = new Date(baseDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const civilDateEnd = formatDate(nextDay);
  
  return {
    production_start: productionStart,
    production_end: productionEnd,
    civil_date_start: civilDateStart,
    civil_date_end: civilDateEnd,
  };
}

/**
 * Check if a timestamp falls within a specific production day.
 */
export function isInProductionDay(
  timestamp: Date,
  productionDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const boundaries = getProductionDayBoundaries(productionDate, timezone);
  return timestamp >= boundaries.production_start && timestamp < boundaries.production_end;
}

/**
 * Get the current production date (based on current time).
 */
export function getCurrentProductionDate(
  timezone: string = DEFAULT_TIMEZONE
): ProductionDateResult {
  return getProductionDate(new Date(), timezone);
}

/**
 * Get today's production date as a YYYY-MM-DD string.
 */
export function getTodayProductionDate(
  timezone: string = DEFAULT_TIMEZONE
): string {
  return getCurrentProductionDate(timezone).production_date;
}

/**
 * Convert production date boundaries to query parameters for Supabase.
 * Returns ISO strings suitable for gte/lte queries.
 */
export function getProductionDayQueryRange(
  productionDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): { start: string; end: string } {
  const boundaries = getProductionDayBoundaries(productionDate, timezone);
  return {
    start: boundaries.production_start.toISOString(),
    end: boundaries.production_end.toISOString(),
  };
}

/**
 * Group events by their production date.
 * Useful for batch processing night shifts.
 */
export function groupEventsByProductionDate<T extends { occurred_at: string }>(
  events: T[],
  timezone: string = DEFAULT_TIMEZONE
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  
  for (const event of events) {
    const timestamp = new Date(event.occurred_at);
    const { production_date } = getProductionDate(timestamp, timezone);
    
    const existing = grouped.get(production_date) || [];
    existing.push(event);
    grouped.set(production_date, existing);
  }
  
  return grouped;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get local time in the specified timezone.
 * Note: This is a simplified implementation that assumes
 * the server timezone is close to the target timezone.
 * For production, consider using a library like date-fns-tz.
 */
function getLocalTime(date: Date, timezone: string): Date {
  // For now, return the date as-is
  // The database handles timezone conversion with AT TIME ZONE
  // The frontend always uses local browser time which should match Africa/Abidjan
  return date;
}

/**
 * Format a date as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to Date object.
 */
export function parseProductionDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the day of week (0-6) for a production date.
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function getProductionDayOfWeek(productionDate: string): number {
  const date = parseProductionDate(productionDate);
  return date.getDay();
}

/**
 * Format production date for display.
 */
export function formatProductionDate(productionDate: string, locale: string = 'fr-FR'): string {
  const date = parseProductionDate(productionDate);
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================
// Labels for UI
// ============================================

export const PRODUCTION_DAY_LABELS = {
  title: 'Jour de Production',
  description: 'Un jour de production commence à 07:00 et se termine à 07:00 le lendemain.',
  earlyMorningNote: 'Ce pointage (avant 07:00) appartient au jour de production précédent.',
  nightShiftNote: 'Poste de nuit: les événements sont comptabilisés sur le jour de production de début.',
};
