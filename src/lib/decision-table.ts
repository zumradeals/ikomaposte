// ============================================
// Phase 7: Decision Table Engine
// Table de décision pour calcul automatique day_status/anomaly_code
// ============================================

import {
  DayStatusType,
  AnomalyCodeType,
  DecisionInput,
  DecisionResult,
  WorkSchedule,
} from '@/types/business-rules';

/**
 * Table de décision - Calcule automatiquement le statut jour et code anomalie
 * 
 * Priorités (ordre décroissant):
 * 1. ANOMALIE - Erreur technique dans les données
 * 2. ABSENT - Aucun pointage et pas d'horaire prévu
 * 3. RETARD - Arrivée après tolérance
 * 4. PRESENT - Arrivée dans les temps
 */
export function evaluateDecisionTable(input: DecisionInput): DecisionResult {
  const { actual_checkin, actual_checkout, schedule, events } = input;

  // ============================================
  // PRIORITÉ 1: Détection des anomalies
  // ============================================

  // Vérifier anomalies dans les événements
  const anomalyCheck = detectEventAnomalies(events);
  if (anomalyCheck.hasAnomaly) {
    return {
      day_status: 'ANOMALIE',
      anomaly_code: anomalyCheck.code,
      total_work_minutes: 0,
      late_minutes: 0,
      reason: anomalyCheck.reason,
    };
  }

  // Pas d'horaire théorique configuré
  if (!schedule) {
    // S'il y a des événements mais pas d'horaire, c'est une config manquante
    if (events.length > 0) {
      return {
        day_status: 'PRESENT', // Présent par défaut si travail effectué
        anomaly_code: null,
        total_work_minutes: calculateWorkMinutes(actual_checkin, actual_checkout),
        late_minutes: 0,
        reason: 'Horaire théorique non configuré',
      };
    }
    // Aucun événement, pas d'horaire = jour non travaillé (pas d'anomalie)
    return {
      day_status: 'ABSENT',
      anomaly_code: null,
      total_work_minutes: 0,
      late_minutes: 0,
      reason: 'Jour non travaillé (pas d\'horaire prévu)',
    };
  }

  // ============================================
  // PRIORITÉ 2: Vérification présence
  // ============================================

  // Pas de pointage entrée
  if (!actual_checkin) {
    return {
      day_status: 'ANOMALIE',
      anomaly_code: 'NO_CHECKIN',
      total_work_minutes: 0,
      late_minutes: 0,
      reason: 'Aucun pointage d\'entrée enregistré',
    };
  }

  // Pas de pointage sortie
  if (!actual_checkout) {
    return {
      day_status: 'ANOMALIE',
      anomaly_code: 'NO_CHECKOUT',
      total_work_minutes: 0,
      late_minutes: 0,
      reason: 'Aucun pointage de sortie enregistré',
    };
  }

  // ============================================
  // PRIORITÉ 3: Calcul retard
  // ============================================

  const checkinTime = parseTimeFromDatetime(actual_checkin);
  const scheduleStart = parseTimeFromString(schedule.start_time);
  const toleranceMs = schedule.tolerance_late_minutes * 60 * 1000;

  const lateMs = checkinTime - scheduleStart;
  const lateMinutes = Math.max(0, Math.floor(lateMs / 60000));

  // Calcul des minutes travaillées
  const totalWorkMinutes = calculateWorkMinutes(actual_checkin, actual_checkout);

  // ============================================
  // PRIORITÉ 4: Détermination statut final
  // ============================================

  if (lateMs > toleranceMs) {
    return {
      day_status: 'RETARD',
      anomaly_code: null,
      total_work_minutes: totalWorkMinutes,
      late_minutes: lateMinutes,
      reason: `Arrivée avec ${lateMinutes} minutes de retard`,
    };
  }

  return {
    day_status: 'PRESENT',
    anomaly_code: null,
    total_work_minutes: totalWorkMinutes,
    late_minutes: 0,
    reason: 'Présent dans les temps',
  };
}

/**
 * Détecte les anomalies dans les événements bruts
 */
function detectEventAnomalies(
  events: Array<{ id: string; event_type: string; occurred_at: string }>
): { hasAnomaly: boolean; code: AnomalyCodeType | null; reason: string } {
  if (events.length === 0) {
    return { hasAnomaly: false, code: null, reason: '' };
  }

  // Trier par date
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Compter les types d'événements
  const takeCount = sorted.filter(e => e.event_type === 'TAKE').length;
  const endCount = sorted.filter(e => e.event_type === 'END').length;

  // Double TAKE
  if (takeCount > 1) {
    return {
      hasAnomaly: true,
      code: 'DUPLICATE_CHECKIN',
      reason: `${takeCount} pointages d'entrée détectés`,
    };
  }

  // Double END
  if (endCount > 1) {
    return {
      hasAnomaly: true,
      code: 'DUPLICATE_CHECKOUT',
      reason: `${endCount} pointages de sortie détectés`,
    };
  }

  // Vérifier la séquence (TAKE doit précéder END)
  const firstTakeIdx = sorted.findIndex(e => e.event_type === 'TAKE');
  const firstEndIdx = sorted.findIndex(e => e.event_type === 'END');

  if (firstEndIdx !== -1 && (firstTakeIdx === -1 || firstEndIdx < firstTakeIdx)) {
    return {
      hasAnomaly: true,
      code: 'INVALID_SEQUENCE',
      reason: 'Pointage sortie avant pointage entrée',
    };
  }

  // Vérifier événements futurs
  const now = new Date();
  const futureEvent = sorted.find(e => new Date(e.occurred_at) > now);
  if (futureEvent) {
    return {
      hasAnomaly: true,
      code: 'FUTURE_EVENT',
      reason: 'Événement avec date future détecté',
    };
  }

  // Vérifier durée impossible (>24h)
  if (sorted.length >= 2) {
    const first = new Date(sorted[0].occurred_at);
    const last = new Date(sorted[sorted.length - 1].occurred_at);
    const durationMs = last.getTime() - first.getTime();
    const maxDurationMs = 24 * 60 * 60 * 1000; // 24h

    if (durationMs > maxDurationMs) {
      return {
        hasAnomaly: true,
        code: 'IMPOSSIBLE_DURATION',
        reason: 'Durée de travail supérieure à 24h',
      };
    }
  }

  return { hasAnomaly: false, code: null, reason: '' };
}

/**
 * Calcule les minutes travaillées entre checkin et checkout
 */
function calculateWorkMinutes(checkin: string | null, checkout: string | null): number {
  if (!checkin || !checkout) return 0;

  const start = new Date(checkin).getTime();
  const end = new Date(checkout).getTime();

  if (end <= start) return 0;

  return Math.floor((end - start) / 60000);
}

/**
 * Parse le temps d'un datetime ISO vers millisecondes depuis minuit
 */
function parseTimeFromDatetime(datetime: string): number {
  const date = new Date(datetime);
  return (
    date.getHours() * 60 * 60 * 1000 +
    date.getMinutes() * 60 * 1000 +
    date.getSeconds() * 1000
  );
}

/**
 * Parse un string HH:MM:SS vers millisecondes depuis minuit
 */
function parseTimeFromString(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;

  return hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
}

/**
 * Extrait le premier TAKE et le dernier END des événements
 */
export function extractCheckinCheckout(
  events: Array<{ event_type: string; occurred_at: string }>
): { checkin: string | null; checkout: string | null } {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const takeEvent = sorted.find(e => e.event_type === 'TAKE');
  const endEvents = sorted.filter(e => e.event_type === 'END');
  const lastEndEvent = endEvents[endEvents.length - 1];

  return {
    checkin: takeEvent?.occurred_at || null,
    checkout: lastEndEvent?.occurred_at || null,
  };
}

/**
 * Obtient le jour de la semaine (0-6) pour une date
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Vérifie si un jour est travaillé selon les horaires
 */
export function isWorkingDay(schedule: WorkSchedule | null): boolean {
  return schedule !== null && schedule.is_active;
}
