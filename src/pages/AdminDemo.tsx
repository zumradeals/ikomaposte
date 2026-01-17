// ============================================
// IKOMA POSTE - Enterprise Demo Dashboard
// ============================================
// Comprehensive view for management, HR, and audit demonstration
// Showcases all modules working together in real-world conditions
//

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes, eachDayOfInterval, isWeekend as dfnsIsWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart3,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield,
  History,
  Calculator,
  Download,
  RefreshCw,
  Calendar,
  Eye,
  TrendingUp,
  Building2,
  Banknote,
  XCircle,
  Play,
  Printer,
  Activity,
  Database,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ============================================
// DATA HOOKS
// ============================================

function useDemoStats(month: Date) {
  const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['demo-stats', monthStart, monthEnd],
    queryFn: async () => {
      // Get events stats
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('id, worker_id, event_type, occurred_at, trust_status, incident_flag, production_date')
        .gte('production_date', monthStart)
        .lte('production_date', monthEnd);

      if (eventsError) throw eventsError;

      // Get summaries stats
      const { data: summaries, error: summariesError } = await supabase
        .from('work_summaries')
        .select(`
          id, worker_id, work_date, day_status, anomaly_code, validation_status,
          total_work_minutes, total_pause_minutes, total_amount, late_minutes,
          revision, is_current, policy_version_id
        `)
        .eq('is_current', true)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd);

      if (summariesError) throw summariesError;

      // Get workers with categories
      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select(`
          id, nom_affiche, matricule, actif, team_id,
          categories!inner(id, nom, taux_horaire, devise),
          teams(id, name, code)
        `)
        .eq('actif', true);

      if (workersError) throw workersError;

      // Get policies
      const { data: policies, error: policiesError } = await supabase
        .from('time_policies')
        .select('id, code, name, status, version, is_active')
        .eq('is_active', true);

      if (policiesError) throw policiesError;

      // Get audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('admin_audit')
        .select('id, event, created_at, actor_user_id, reason')
        .gte('created_at', monthStart)
        .order('created_at', { ascending: false })
        .limit(50);

      if (auditError) throw auditError;

      // Aggregate stats
      const totalEvents = events?.length || 0;
      const uniqueWorkers = new Set(events?.map(e => e.worker_id) || []).size;
      const uniqueDays = new Set(events?.map(e => e.production_date) || []).size;
      
      const eventsByType = {
        TAKE: events?.filter(e => e.event_type === 'TAKE').length || 0,
        END: events?.filter(e => e.event_type === 'END').length || 0,
        PAUSE: events?.filter(e => e.event_type === 'PAUSE').length || 0,
        RESUME: events?.filter(e => e.event_type === 'RESUME').length || 0,
      };

      const summariesByStatus = {
        PRESENT: summaries?.filter(s => s.day_status === 'PRESENT').length || 0,
        RETARD: summaries?.filter(s => s.day_status === 'RETARD').length || 0,
        ABSENT: summaries?.filter(s => s.day_status === 'ABSENT').length || 0,
        ANOMALIE: summaries?.filter(s => s.day_status === 'ANOMALIE').length || 0,
      };

      const validationStats = {
        draft: summaries?.filter(s => s.validation_status === 'DRAFT').length || 0,
        validated: summaries?.filter(s => s.validation_status === 'VALIDATED').length || 0,
      };

      const totalWorkMinutes = summaries
        ?.filter(s => s.day_status === 'PRESENT' || s.day_status === 'RETARD')
        .reduce((sum, s) => sum + (s.total_work_minutes || 0), 0) || 0;

      const totalAmount = summaries
        ?.filter(s => s.day_status === 'PRESENT' || s.day_status === 'RETARD')
        .reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

      const totalLateMinutes = summaries
        ?.filter(s => s.day_status === 'RETARD')
        .reduce((sum, s) => sum + (s.late_minutes || 0), 0) || 0;

      // Workers by category
      const workersByCategory = workers?.reduce((acc, w) => {
        const catName = (w.categories as any)?.nom || 'Non catégorisé';
        acc[catName] = (acc[catName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get top 10 late workers
      const lateByWorker = new Map<string, number>();
      summaries?.filter(s => s.day_status === 'RETARD').forEach(s => {
        const current = lateByWorker.get(s.worker_id) || 0;
        lateByWorker.set(s.worker_id, current + (s.late_minutes || 0));
      });

      const topLateWorkers = Array.from(lateByWorker.entries())
        .map(([id, minutes]) => {
          const worker = workers?.find(w => w.id === id);
          return {
            id,
            name: worker?.nom_affiche || 'N/A',
            matricule: worker?.matricule || 'N/A',
            category: (worker?.categories as any)?.nom || 'N/A',
            totalLateMinutes: minutes,
          };
        })
        .sort((a, b) => b.totalLateMinutes - a.totalLateMinutes)
        .slice(0, 10);

      // Get anomalies by type
      const anomaliesByCode = summaries
        ?.filter(s => s.anomaly_code)
        .reduce((acc, s) => {
          const code = s.anomaly_code || 'OTHER';
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

      // Daily breakdown
      const dailyStats = Array.from(
        (summaries || []).reduce((acc, s) => {
          if (!acc.has(s.work_date)) {
            acc.set(s.work_date, { date: s.work_date, present: 0, retard: 0, absent: 0, anomalie: 0, total: 0 });
          }
          const day = acc.get(s.work_date)!;
          if (s.day_status === 'PRESENT') day.present++;
          else if (s.day_status === 'RETARD') day.retard++;
          else if (s.day_status === 'ABSENT') day.absent++;
          else if (s.day_status === 'ANOMALIE') day.anomalie++;
          day.total++;
          return acc;
        }, new Map<string, any>())
      ).map(([, v]) => v).sort((a, b) => a.date.localeCompare(b.date));

      return {
        events: events || [],
        summaries: summaries || [],
        workers: workers || [],
        policies: policies || [],
        auditLogs: auditLogs || [],
        stats: {
          totalEvents,
          uniqueWorkers,
          uniqueDays,
          eventsByType,
          summariesByStatus,
          validationStats,
          totalWorkMinutes,
          totalAmount,
          totalLateMinutes,
          workersByCategory,
          topLateWorkers,
          anomaliesByCode,
          dailyStats,
        },
      };
    },
  });
}

// ============================================
// BATCH CALCULATION MUTATION
// ============================================

function useBatchCalculateMonth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ month }: { month: Date }) => {
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');

      // Get all events for the month
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('*')
        .eq('trust_status', 'trusted')
        .gte('production_date', monthStart)
        .lte('production_date', monthEnd);

      if (eventsError) throw eventsError;
      if (!events?.length) return { calculated: 0, errors: 0 };

      // Group by worker and production_date
      const eventsByWorkerDay = new Map<string, typeof events>();
      for (const event of events) {
        const key = `${event.worker_id}:${event.production_date}`;
        if (!eventsByWorkerDay.has(key)) {
          eventsByWorkerDay.set(key, []);
        }
        eventsByWorkerDay.get(key)!.push(event);
      }

      // Get workers with categories
      const workerIds = Array.from(new Set(events.map(e => e.worker_id)));
      const { data: workers } = await supabase
        .from('workers')
        .select('id, categories(id, taux_horaire, devise)')
        .in('id', workerIds);

      const workersMap = new Map(workers?.map(w => [w.id, w]) || []);

      // Get work schedules
      const { data: schedules } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('is_active', true);

      const schedulesMap = new Map<string, typeof schedules>();
      for (const schedule of schedules || []) {
        const key = `${schedule.category_id}:${schedule.day_of_week}`;
        if (!schedulesMap.has(key)) {
          schedulesMap.set(key, []);
        }
        schedulesMap.get(key)!.push(schedule);
      }

      let calculated = 0;
      let errors = 0;

      // Process each worker-day
      for (const [key, dayEvents] of eventsByWorkerDay) {
        const [workerId, productionDate] = key.split(':');
        const worker = workersMap.get(workerId);
        if (!worker || !worker.categories) continue;

        try {
          // Check for existing summary
          const { data: existingSummary } = await supabase
            .from('work_summaries')
            .select('id, locked')
            .eq('worker_id', workerId)
            .eq('work_date', productionDate)
            .eq('is_current', true)
            .maybeSingle();

          if (existingSummary?.locked) continue;

          // Sort events
          const sortedEvents = dayEvents.sort((a, b) => 
            new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
          );

          // Extract check-in/out
          const takeEvent = sortedEvents.find(e => e.event_type === 'TAKE');
          const endEvents = sortedEvents.filter(e => e.event_type === 'END');
          const lastEndEvent = endEvents[endEvents.length - 1];

          // Get schedule for this day
          const dateObj = parseISO(productionDate);
          const dayOfWeek = dateObj.getDay();
          const categoryId = (worker.categories as any).id;
          const scheduleKey = `${categoryId}:${dayOfWeek}`;
          const daySchedules = schedulesMap.get(scheduleKey) || [];
          const schedule = daySchedules[0] || null;

          // Determine status
          let day_status: 'PRESENT' | 'RETARD' | 'ABSENT' | 'ANOMALIE' = 'PRESENT';
          let anomaly_code: string | null = null;
          let late_minutes = 0;
          let total_work_minutes = 0;

          const takeCount = sortedEvents.filter(e => e.event_type === 'TAKE').length;
          const endCount = sortedEvents.filter(e => e.event_type === 'END').length;

          // Check for anomalies
          if (takeCount > 1) {
            day_status = 'ANOMALIE';
            anomaly_code = 'DUPLICATE_CHECKIN';
          } else if (endCount > 1) {
            day_status = 'ANOMALIE';
            anomaly_code = 'DUPLICATE_CHECKOUT';
          } else if (!takeEvent) {
            day_status = 'ANOMALIE';
            anomaly_code = 'NO_CHECKIN';
          } else if (!lastEndEvent) {
            day_status = 'ANOMALIE';
            anomaly_code = 'NO_CHECKOUT';
          } else if (schedule) {
            // Calculate work minutes
            const startTime = new Date(takeEvent.occurred_at);
            const endTime = new Date(lastEndEvent.occurred_at);
            total_work_minutes = Math.floor(differenceInMinutes(endTime, startTime));

            // Check for late arrival
            const scheduleStartParts = schedule.start_time.split(':').map(Number);
            const scheduleStart = new Date(startTime);
            scheduleStart.setHours(scheduleStartParts[0], scheduleStartParts[1], 0, 0);

            const tolerance = schedule.tolerance_late_minutes || 15;
            const lateMs = startTime.getTime() - scheduleStart.getTime();
            late_minutes = Math.max(0, Math.floor(lateMs / 60000));

            if (lateMs > tolerance * 60000) {
              day_status = 'RETARD';
            }
          } else {
            // No schedule = ABSENT
            day_status = 'ABSENT';
          }

          // Calculate amount (only for PRESENT/RETARD)
          const rate = (worker.categories as any).taux_horaire || 0;
          const devise = (worker.categories as any).devise || 'XOF';
          const total_amount = day_status === 'PRESENT' || day_status === 'RETARD'
            ? (total_work_minutes / 60) * rate
            : 0;

          // Calculate pause minutes
          const pauseEvents = sortedEvents.filter(e => e.event_type === 'PAUSE');
          const resumeEvents = sortedEvents.filter(e => e.event_type === 'RESUME');
          let total_pause_minutes = 0;
          for (let i = 0; i < Math.min(pauseEvents.length, resumeEvents.length); i++) {
            const pauseStart = new Date(pauseEvents[i].occurred_at);
            const pauseEnd = new Date(resumeEvents[i].occurred_at);
            total_pause_minutes += Math.floor(differenceInMinutes(pauseEnd, pauseStart));
          }

          // Insert or update summary
          if (existingSummary) {
            // Mark old as not current
            await supabase
              .from('work_summaries')
              .update({ is_current: false })
              .eq('id', existingSummary.id);
          }

          const { error: insertError } = await supabase
            .from('work_summaries')
            .insert({
              worker_id: workerId,
              work_date: productionDate,
              production_date: productionDate,
              day_status,
              anomaly_code: anomaly_code as any,
              late_minutes,
              total_work_minutes: day_status === 'ANOMALIE' ? 0 : total_work_minutes,
              total_pause_minutes,
              total_amount,
              taux_horaire_applied: rate,
              devise,
              events_used: sortedEvents.map(e => e.id),
              calculation_version: 'v2.0',
              revision: (existingSummary ? 2 : 1),
              is_current: true,
              validation_status: 'DRAFT',
            });

          if (insertError) {
            errors++;
          } else {
            calculated++;
          }
        } catch (err) {
          errors++;
        }
      }

      return { calculated, errors };
    },
    onSuccess: ({ calculated, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['demo-stats'] });
      toast({
        title: 'Calcul terminé',
        description: `${calculated} résumés calculés, ${errors} erreurs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur de calcul',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Batch validate mutation
function useBatchValidateMonth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ month }: { month: Date }) => {
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');

      // Get all DRAFT summaries for the month
      const { data: summaries, error } = await supabase
        .from('work_summaries')
        .select('id')
        .eq('is_current', true)
        .eq('validation_status', 'DRAFT')
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd);

      if (error) throw error;
      if (!summaries?.length) return { validated: 0 };

      // Batch validate
      const { error: updateError } = await supabase
        .from('work_summaries')
        .update({
          validation_status: 'VALIDATED',
          validated_at: new Date().toISOString(),
          validated_by: 'demo-batch-validation',
        })
        .in('id', summaries.map(s => s.id));

      if (updateError) throw updateError;

      return { validated: summaries.length };
    },
    onSuccess: ({ validated }) => {
      queryClient.invalidateQueries({ queryKey: ['demo-stats'] });
      toast({
        title: 'Validation terminée',
        description: `${validated} résumés validés`,
      });
    },
  });
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'primary',
  trend,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'muted';
  trend?: 'up' | 'down';
}) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className={cn('text-2xl font-bold', colorClasses[color])}>{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
          </div>
          <div className={cn('p-3 rounded-full bg-muted', colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatAmount(amount: number, devise = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise,
    minimumFractionDigits: 0,
  }).format(amount);
}

const ANOMALY_LABELS: Record<string, string> = {
  NO_CHECKIN: 'Pointage entrée manquant',
  NO_CHECKOUT: 'Pointage sortie manquant',
  DUPLICATE_CHECKIN: 'Double entrée',
  DUPLICATE_CHECKOUT: 'Double sortie',
  INVALID_SEQUENCE: 'Séquence invalide',
  TIME_OVERLAP: 'Chevauchement horaire',
  FUTURE_EVENT: 'Événement futur',
  IMPOSSIBLE_DURATION: 'Durée impossible',
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminDemo() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date(2026, 2, 1)); // March 2026
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, refetch } = useDemoStats(selectedMonth);
  const batchCalculate = useBatchCalculateMonth();
  const batchValidate = useBatchValidateMonth();

  if (!isUnlocked) {
    navigate('/');
    return null;
  }

  const stats = data?.stats;
  const hasData = (stats?.totalEvents || 0) > 0;
  const hasSummaries = (stats?.summariesByStatus?.PRESENT || 0) > 0 || 
                       (stats?.summariesByStatus?.RETARD || 0) > 0 ||
                       (stats?.summariesByStatus?.ANOMALIE || 0) > 0;

  const attendanceRate = stats && hasSummaries
    ? Math.round(((stats.summariesByStatus.PRESENT + stats.summariesByStatus.RETARD) / 
        (stats.summariesByStatus.PRESENT + stats.summariesByStatus.RETARD + stats.summariesByStatus.ABSENT + stats.summariesByStatus.ANOMALIE)) * 100)
    : 0;

  return (
    <AdminLayout title="Démonstration Enterprise">
      <div className="space-y-6">
        {/* Header */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-6 w-6 text-primary" />
                  IKOMA POSTE - Tableau de Bord Enterprise
                </CardTitle>
                <CardDescription className="mt-1">
                  Vue consolidée pour la direction, les RH et l'audit
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={format(selectedMonth, 'yyyy-MM')}
                  onValueChange={(val) => {
                    const [year, month] = val.split('-').map(Number);
                    setSelectedMonth(new Date(year, month - 1, 1));
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-03">Mars 2026</SelectItem>
                    <SelectItem value="2026-02">Février 2026</SelectItem>
                    <SelectItem value="2026-01">Janvier 2026</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Actions */}
        {hasData && !hasSummaries && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">Données non calculées</p>
                    <p className="text-sm text-muted-foreground">
                      {stats?.totalEvents} événements détectés, calculs en attente
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => batchCalculate.mutate({ month: selectedMonth })}
                  disabled={batchCalculate.isPending}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {batchCalculate.isPending ? 'Calcul en cours...' : 'Lancer les calculs'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {hasSummaries && stats?.validationStats?.draft > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{stats.validationStats.draft} résumés en attente de validation</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.validationStats.validated} déjà validés
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => batchValidate.mutate({ month: selectedMonth })}
                  disabled={batchValidate.isPending}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {batchValidate.isPending ? 'Validation...' : 'Valider tout le mois'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            icon={Users}
            label="Travailleurs actifs"
            value={stats?.uniqueWorkers || 0}
            subValue={`sur ${data?.workers?.length || 0} total`}
            color="primary"
          />
          <StatCard
            icon={Calendar}
            label="Jours travaillés"
            value={stats?.uniqueDays || 0}
            subValue={format(selectedMonth, 'MMMM yyyy', { locale: fr })}
          />
          <StatCard
            icon={Activity}
            label="Événements"
            value={stats?.totalEvents || 0}
            subValue={`${stats?.eventsByType?.TAKE || 0} entrées`}
          />
          <StatCard
            icon={CheckCircle2}
            label="Taux présence"
            value={`${attendanceRate}%`}
            color="success"
          />
          <StatCard
            icon={Clock}
            label="Heures totales"
            value={formatMinutes(stats?.totalWorkMinutes || 0)}
            color="primary"
          />
          <StatCard
            icon={Banknote}
            label="Masse salariale"
            value={formatAmount(stats?.totalAmount || 0)}
            color="success"
          />
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Vue d'ensemble</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Présence</span>
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Anomalies</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exports</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Répartition des statuts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Présent', value: stats?.summariesByStatus?.PRESENT || 0, color: 'bg-success' },
                    { label: 'Retard', value: stats?.summariesByStatus?.RETARD || 0, color: 'bg-warning' },
                    { label: 'Absent', value: stats?.summariesByStatus?.ABSENT || 0, color: 'bg-muted' },
                    { label: 'Anomalie', value: stats?.summariesByStatus?.ANOMALIE || 0, color: 'bg-destructive' },
                  ].map(item => {
                    const total = (stats?.summariesByStatus?.PRESENT || 0) + 
                                  (stats?.summariesByStatus?.RETARD || 0) + 
                                  (stats?.summariesByStatus?.ABSENT || 0) + 
                                  (stats?.summariesByStatus?.ANOMALIE || 0);
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    
                    return (
                      <div key={item.label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="font-medium">{item.value} ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className={cn('h-2', item.color)} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Workers by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Effectif par catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats?.workersByCategory || {}).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{cat}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Policies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Politiques actives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data?.policies?.map(policy => (
                      <div key={policy.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{policy.name}</p>
                          <p className="text-xs text-muted-foreground">{policy.code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{policy.version}</Badge>
                          <Badge className="bg-success">{policy.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Validation Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Statut de validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-warning/10 rounded-lg border border-warning/30">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-warning" />
                        <div>
                          <p className="font-medium">En attente (DRAFT)</p>
                          <p className="text-xs text-muted-foreground">À valider par RH</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-warning">{stats?.validationStats?.draft || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <div>
                          <p className="font-medium">Validés</p>
                          <p className="text-xs text-muted-foreground">Prêts pour export</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-success">{stats?.validationStats?.validated || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard
                icon={Clock}
                label="Retards totaux"
                value={formatMinutes(stats?.totalLateMinutes || 0)}
                subValue={`${stats?.summariesByStatus?.RETARD || 0} jours concernés`}
                color="warning"
              />
              <StatCard
                icon={XCircle}
                label="Absences"
                value={stats?.summariesByStatus?.ABSENT || 0}
                color="muted"
              />
              <StatCard
                icon={TrendingUp}
                label="Moyenne heures/jour"
                value={stats?.uniqueDays ? formatMinutes(Math.round((stats.totalWorkMinutes || 0) / stats.uniqueDays)) : '0m'}
              />
            </div>

            {/* Top Late Workers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 10 retards cumulés</CardTitle>
                <CardDescription>Travailleurs avec le plus de minutes de retard</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rang</TableHead>
                      <TableHead>Travailleur</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Retard cumulé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.topLateWorkers?.map((worker, idx) => (
                      <TableRow key={worker.id}>
                        <TableCell>
                          <Badge variant={idx < 3 ? 'destructive' : 'secondary'}>{idx + 1}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{worker.name}</p>
                            <p className="text-xs text-muted-foreground">{worker.matricule}</p>
                          </div>
                        </TableCell>
                        <TableCell>{worker.category}</TableCell>
                        <TableCell className="text-right font-mono text-warning">
                          {formatMinutes(worker.totalLateMinutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!stats?.topLateWorkers || stats.topLateWorkers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Aucun retard enregistré
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Évolution journalière</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Présent</TableHead>
                        <TableHead className="text-center">Retard</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Anomalie</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.dailyStats?.map(day => (
                        <TableRow key={day.date}>
                          <TableCell className="font-mono">
                            {format(parseISO(day.date), 'EEE dd/MM', { locale: fr })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-success/20 text-success">{day.present}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-warning/20 text-warning">{day.retard}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{day.absent}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-destructive/20 text-destructive">{day.anomalie}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">{day.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Anomalies by Type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Anomalies par type
                  </CardTitle>
                  <CardDescription>
                    Total: {stats?.summariesByStatus?.ANOMALIE || 0} anomalies détectées
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats?.anomaliesByCode || {}).length > 0 ? (
                      Object.entries(stats.anomaliesByCode).map(([code, count]) => (
                        <div key={code} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <div>
                              <p className="font-medium text-sm">{ANOMALY_LABELS[code] || code}</p>
                              <p className="text-xs text-muted-foreground">{code}</p>
                            </div>
                          </div>
                          <Badge variant="destructive">{count}</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success" />
                        <p>Aucune anomalie détectée</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resolution Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions de résolution</CardTitle>
                  <CardDescription>Workflow de correction des anomalies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <h4 className="font-medium">Processus de résolution :</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Identifier l'anomalie (NO_CHECKIN, NO_CHECKOUT, etc.)</li>
                      <li>Créer une correction avec justification obligatoire</li>
                      <li>Le système recalcule automatiquement le résumé</li>
                      <li>La trace d'audit conserve l'historique complet</li>
                      <li>Validation RH finale pour export officiel</li>
                    </ol>
                  </div>
                  <Button className="w-full" variant="outline" onClick={() => navigate('/admin/anomalies')}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir le module de corrections
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Audit Principles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Principes d'audit IKOMA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { icon: Database, label: 'Immutabilité', desc: 'Les événements bruts ne sont jamais modifiés' },
                    { icon: History, label: 'Traçabilité', desc: 'Chaque calcul génère une trace complète' },
                    { icon: Play, label: 'Rejouabilité', desc: 'Les calculs peuvent être rejoués à l\'identique' },
                    { icon: FileText, label: 'Versioning', desc: 'Politiques et résumés sont versionnés' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <item.icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Audit Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Derniers événements d'audit</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {data?.auditLogs?.slice(0, 20).map(log => (
                        <div key={log.id} className="p-3 bg-muted/30 rounded-lg border text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline">{log.event}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(log.created_at), 'dd/MM HH:mm')}
                            </span>
                          </div>
                          {log.reason && (
                            <p className="text-xs text-muted-foreground truncate">{log.reason}</p>
                          )}
                        </div>
                      ))}
                      {(!data?.auditLogs || data.auditLogs.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          Aucun événement d'audit
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate('/admin/audit')}>
              <History className="h-4 w-4 mr-2" />
              Accéder au journal d'audit complet
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </TabsContent>

          {/* Exports Tab */}
          <TabsContent value="exports" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Official Exports */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Exports Officiels
                  </CardTitle>
                  <CardDescription>Données VALIDÉES uniquement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm bg-muted/50 p-3 rounded space-y-1">
                    <p><strong>IKP-DAILY:</strong> 1 ligne/travailleur/jour</p>
                    <p><strong>IKP-MONTH:</strong> Agrégation mensuelle</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats?.validationStats?.validated || 0} résumés validés disponibles
                    </p>
                  </div>
                  <Button className="w-full" onClick={() => navigate('/admin/exports')}>
                    <Download className="h-4 w-4 mr-2" />
                    Générer exports
                  </Button>
                </CardContent>
              </Card>

              {/* PDF Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Rapports PDF
                  </CardTitle>
                  <CardDescription>Documents signés numériquement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm bg-muted/50 p-3 rounded space-y-1">
                    <p><strong>IKP-RAP:</strong> Rapport individuel</p>
                    <p><strong>IKP-PTG:</strong> Pointage global</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Avec hash SHA-256 et QR de vérification
                    </p>
                  </div>
                  <Button className="w-full" variant="outline" onClick={() => navigate('/admin/exports')}>
                    <Printer className="h-4 w-4 mr-2" />
                    Générer PDFs
                  </Button>
                </CardContent>
              </Card>

              {/* Payroll Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Intégration Paie
                  </CardTitle>
                  <CardDescription>Export pour systèmes de paie</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm bg-muted/50 p-3 rounded space-y-1">
                    <p><strong>Format:</strong> CSV avec séparateur point-virgule</p>
                    <p><strong>Arrondi:</strong> Au quart d'heure</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Compatible SAP, Sage, etc.
                    </p>
                  </div>
                  <Button className="w-full" variant="outline" onClick={() => navigate('/admin/exports')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export paie
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Export Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Récapitulatif exportable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats?.uniqueWorkers || 0}</p>
                    <p className="text-sm text-muted-foreground">Travailleurs</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats?.uniqueDays || 0}</p>
                    <p className="text-sm text-muted-foreground">Jours ouvrés</p>
                  </div>
                  <div className="text-center p-4 bg-success/10 rounded-lg">
                    <p className="text-2xl font-bold text-success">{formatMinutes(stats?.totalWorkMinutes || 0)}</p>
                    <p className="text-sm text-muted-foreground">Heures totales</p>
                  </div>
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{formatAmount(stats?.totalAmount || 0)}</p>
                    <p className="text-sm text-muted-foreground">Masse salariale</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer - System Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <Database className="h-3 w-3" />
                  CALCULATION_VERSION v2.0
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  EXPORT_VERSION 1.0
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span>IKOMA POSTE</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Production Day: 07:00-07:00</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Timezone: Africa/Dakar</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
