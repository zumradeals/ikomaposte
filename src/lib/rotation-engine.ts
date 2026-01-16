/**
 * Team Rotation Engine v3x8
 * 
 * Independent from Working Time Policies.
 * Manages 3 teams (A, B, C) across 3 shifts (M, S, N).
 * 
 * Rotation Rules:
 * - 6 production day cycle (3 blocks × 2 days each)
 * - Weekend freeze: Saturday 07:00 to Monday 07:00
 * - Night shifts attached to production day of start time
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export type TeamCode = 'A' | 'B' | 'C';
export type ShiftCode = 'M' | 'S' | 'N';

export interface Team {
  id: string;
  code: TeamCode;
  name: string;
  color: string;
  is_active: boolean;
}

export interface FixedShift {
  id: string;
  code: ShiftCode;
  name: string;
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  is_cross_day: boolean;
}

export interface RotationConfig {
  id: string;
  name: string;
  is_active: boolean;
  cycle_start_date: string;
  days_per_block: number;
  blocks_per_cycle: number;
  block_assignments: BlockAssignment[];
  weekend_freeze_enabled: boolean;
}

export interface BlockAssignment {
  block: number;
  assignments: Record<TeamCode, ShiftCode>;
}

export interface TeamShiftAssignment {
  team_code: TeamCode;
  team_name: string;
  shift_code: ShiftCode;
  shift_name: string;
  start_time: string;
  end_time: string;
  is_cross_day: boolean;
  block_number: number;
  cycle_day: number;
}

export interface WorkerShiftInfo {
  worker_id: string;
  team_code: TeamCode | null;
  shift: TeamShiftAssignment | null;
  is_weekend: boolean;
  production_date: string;
}

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_BLOCK_ASSIGNMENTS: BlockAssignment[] = [
  { block: 1, assignments: { A: 'M', B: 'S', C: 'N' } },
  { block: 2, assignments: { A: 'N', B: 'M', C: 'S' } },
  { block: 3, assignments: { A: 'S', B: 'N', C: 'M' } },
];

export const SHIFT_LABELS: Record<ShiftCode, string> = {
  M: 'Matin (07h-15h)',
  S: 'Soir (15h-23h)',
  N: 'Nuit (23h-07h)',
};

export const SHIFT_COLORS: Record<ShiftCode, string> = {
  M: '#3B82F6', // Blue
  S: '#F59E0B', // Amber
  N: '#6366F1', // Indigo
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Count working days between two dates (excluding weekends)
 */
export function countWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate rotation position for a given production date
 */
export function calculateRotationPosition(
  productionDate: Date,
  cycleStartDate: Date,
  daysPerBlock: number = 2,
  blocksPerCycle: number = 3
): { cycleDay: number; blockNumber: number } | null {
  // Weekend check
  if (isWeekend(productionDate)) {
    return null;
  }
  
  // Calculate working days since cycle start
  const workingDays = countWorkingDays(cycleStartDate, productionDate);
  
  // Calculate cycle length
  const cycleLength = daysPerBlock * blocksPerCycle;
  
  // Calculate position within cycle (1-indexed)
  const cycleDay = ((workingDays - 1) % cycleLength) + 1;
  
  // Calculate block number (1-indexed)
  const blockNumber = Math.floor((cycleDay - 1) / daysPerBlock) + 1;
  
  return { cycleDay, blockNumber };
}

/**
 * Get team shift assignment for a production date (pure calculation)
 */
export function getTeamShiftForDate(
  teamCode: TeamCode,
  productionDate: Date,
  cycleStartDate: Date,
  blockAssignments: BlockAssignment[] = DEFAULT_BLOCK_ASSIGNMENTS,
  daysPerBlock: number = 2,
  blocksPerCycle: number = 3
): { shiftCode: ShiftCode; blockNumber: number; cycleDay: number } | null {
  const position = calculateRotationPosition(
    productionDate,
    cycleStartDate,
    daysPerBlock,
    blocksPerCycle
  );
  
  if (!position) {
    return null; // Weekend
  }
  
  const blockAssignment = blockAssignments.find(b => b.block === position.blockNumber);
  if (!blockAssignment) {
    throw new Error(`No assignment found for block ${position.blockNumber}`);
  }
  
  const shiftCode = blockAssignment.assignments[teamCode];
  if (!shiftCode) {
    throw new Error(`No shift assignment for team ${teamCode} in block ${position.blockNumber}`);
  }
  
  return {
    shiftCode,
    blockNumber: position.blockNumber,
    cycleDay: position.cycleDay,
  };
}

/**
 * Get all team assignments for a production date (pure calculation)
 */
export function getAllTeamAssignmentsForDate(
  productionDate: Date,
  cycleStartDate: Date,
  blockAssignments: BlockAssignment[] = DEFAULT_BLOCK_ASSIGNMENTS,
  daysPerBlock: number = 2,
  blocksPerCycle: number = 3
): Map<TeamCode, { shiftCode: ShiftCode; blockNumber: number; cycleDay: number }> | null {
  const position = calculateRotationPosition(
    productionDate,
    cycleStartDate,
    daysPerBlock,
    blocksPerCycle
  );
  
  if (!position) {
    return null; // Weekend
  }
  
  const blockAssignment = blockAssignments.find(b => b.block === position.blockNumber);
  if (!blockAssignment) {
    throw new Error(`No assignment found for block ${position.blockNumber}`);
  }
  
  const result = new Map<TeamCode, { shiftCode: ShiftCode; blockNumber: number; cycleDay: number }>();
  
  for (const [teamCode, shiftCode] of Object.entries(blockAssignment.assignments)) {
    result.set(teamCode as TeamCode, {
      shiftCode: shiftCode as ShiftCode,
      blockNumber: position.blockNumber,
      cycleDay: position.cycleDay,
    });
  }
  
  return result;
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Fetch all active teams from database
 */
export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('is_active', true)
    .order('code');
  
  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }
  
  return data as Team[];
}

/**
 * Fetch all fixed shifts from database
 */
export async function fetchFixedShifts(): Promise<FixedShift[]> {
  const { data, error } = await supabase
    .from('fixed_shifts')
    .select('*')
    .order('start_time');
  
  if (error) {
    throw new Error(`Failed to fetch fixed shifts: ${error.message}`);
  }
  
  return data as FixedShift[];
}

/**
 * Fetch active rotation configuration
 */
export async function fetchRotationConfig(): Promise<RotationConfig | null> {
  const { data, error } = await supabase
    .from('rotation_config')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No active config
    }
    throw new Error(`Failed to fetch rotation config: ${error.message}`);
  }
  
  return {
    ...data,
    block_assignments: data.block_assignments as unknown as BlockAssignment[],
  } as RotationConfig;
}

/**
 * Get team shift assignment using database RPC
 */
export async function getTeamShiftFromDB(
  teamCode: TeamCode,
  productionDate: string
): Promise<TeamShiftAssignment | null> {
  const { data, error } = await supabase.rpc('get_team_shift', {
    p_team_code: teamCode,
    p_production_date: productionDate,
  });
  
  if (error) {
    throw new Error(`Failed to get team shift: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return null; // Weekend or no config
  }
  
  const row = data[0];
  return {
    team_code: teamCode,
    team_name: `Équipe ${teamCode}`,
    shift_code: row.shift_code as ShiftCode,
    shift_name: row.shift_name,
    start_time: row.start_time,
    end_time: row.end_time,
    is_cross_day: row.is_cross_day,
    block_number: row.block_number,
    cycle_day: row.cycle_day,
  };
}

/**
 * Get full rotation schedule for a production date using database RPC
 */
export async function getRotationScheduleFromDB(
  productionDate: string
): Promise<TeamShiftAssignment[]> {
  const { data, error } = await supabase.rpc('get_rotation_schedule', {
    p_production_date: productionDate,
  });
  
  if (error) {
    throw new Error(`Failed to get rotation schedule: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return []; // Weekend
  }
  
  return data.map((row: any) => ({
    team_code: row.team_code as TeamCode,
    team_name: row.team_name,
    shift_code: row.shift_code as ShiftCode,
    shift_name: row.shift_name,
    start_time: row.start_time,
    end_time: row.end_time,
    is_cross_day: row.is_cross_day,
    block_number: row.block_number,
    cycle_day: row.cycle_day,
  }));
}

/**
 * Get worker's shift info for a production date
 */
export async function getWorkerShiftInfo(
  workerId: string,
  productionDate: string
): Promise<WorkerShiftInfo> {
  // 1. Get worker with team
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('id, team_id, teams(code, name)')
    .eq('id', workerId)
    .single();
  
  if (workerError) {
    throw new Error(`Failed to fetch worker: ${workerError.message}`);
  }
  
  const date = new Date(productionDate);
  const isWeekendDay = isWeekend(date);
  
  // If worker has no team or it's weekend, return early
  if (!worker.team_id || !worker.teams || isWeekendDay) {
    return {
      worker_id: workerId,
      team_code: worker.teams ? (worker.teams as any).code as TeamCode : null,
      shift: null,
      is_weekend: isWeekendDay,
      production_date: productionDate,
    };
  }
  
  const teamCode = (worker.teams as any).code as TeamCode;
  
  // 2. Get shift assignment
  const shift = await getTeamShiftFromDB(teamCode, productionDate);
  
  return {
    worker_id: workerId,
    team_code: teamCode,
    shift,
    is_weekend: false,
    production_date: productionDate,
  };
}

// ============================================
// SCHEDULE PREVIEW HELPERS
// ============================================

/**
 * Generate rotation schedule preview for a date range
 */
export async function generateRotationPreview(
  startDate: string,
  days: number = 14
): Promise<Map<string, TeamShiftAssignment[]>> {
  const result = new Map<string, TeamShiftAssignment[]>();
  const start = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (isWeekend(date)) {
      result.set(dateStr, []); // Empty for weekends
    } else {
      const schedule = await getRotationScheduleFromDB(dateStr);
      result.set(dateStr, schedule);
    }
  }
  
  return result;
}

/**
 * Get rotation info for display
 */
export function formatRotationInfo(assignment: TeamShiftAssignment): string {
  return `Bloc ${assignment.block_number}, Jour ${assignment.cycle_day} - ${assignment.shift_name}`;
}

/**
 * Get shift time range as string
 */
export function formatShiftTimeRange(assignment: TeamShiftAssignment): string {
  const start = assignment.start_time.slice(0, 5);
  const end = assignment.end_time.slice(0, 5);
  return `${start} - ${end}${assignment.is_cross_day ? ' (+1j)' : ''}`;
}
