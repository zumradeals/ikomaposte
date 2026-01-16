import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Calendar,
  Sun,
  Moon,
  Sunrise
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  fetchTeams,
  fetchFixedShifts,
  fetchRotationConfig,
  getRotationScheduleFromDB,
  isWeekend,
  TeamShiftAssignment,
  Team,
  FixedShift,
  ShiftCode,
} from '@/lib/rotation-engine';

const SHIFT_ICONS: Record<ShiftCode, React.ElementType> = {
  M: Sunrise,
  S: Sun,
  N: Moon,
};

const SHIFT_BG_COLORS: Record<ShiftCode, string> = {
  M: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  S: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  N: 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700',
};

const SHIFT_TEXT_COLORS: Record<ShiftCode, string> = {
  M: 'text-blue-700 dark:text-blue-300',
  S: 'text-amber-700 dark:text-amber-300',
  N: 'text-indigo-700 dark:text-indigo-300',
};

export default function AdminRotation() {
  const { isUnlocked } = useAdmin();
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Fetch rotation data
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['fixed-shifts'],
    queryFn: fetchFixedShifts,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['rotation-config'],
    queryFn: fetchRotationConfig,
  });

  // Generate 14 days of dates
  const dates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  // Fetch schedule for all dates
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['rotation-schedule', startDate.toISOString()],
    queryFn: async () => {
      const result = new Map<string, TeamShiftAssignment[]>();
      for (const date of dates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (isWeekend(date)) {
          result.set(dateStr, []);
        } else {
          const schedule = await getRotationScheduleFromDB(dateStr);
          result.set(dateStr, schedule);
        }
      }
      return result;
    },
    enabled: !!config,
  });

  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  const isLoading = teamsLoading || shiftsLoading || configLoading || scheduleLoading;

  const handlePrevWeeks = () => setStartDate(prev => addDays(prev, -14));
  const handleNextWeeks = () => setStartDate(prev => addDays(prev, 14));
  const handleToday = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getShiftInfo = (shiftCode: ShiftCode): FixedShift | undefined => {
    return shifts.find(s => s.code === shiftCode);
  };

  const getTeamForShift = (dateStr: string, shiftCode: ShiftCode): Team | undefined => {
    const daySchedule = scheduleData?.get(dateStr) || [];
    const assignment = daySchedule.find(a => a.shift_code === shiftCode);
    if (assignment) {
      return teams.find(t => t.code === assignment.team_code);
    }
    return undefined;
  };

  const renderDayCell = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isWeekendDay = isWeekend(date);
    const isTodayDate = isToday(date);
    const daySchedule = scheduleData?.get(dateStr) || [];

    if (isWeekendDay) {
      return (
        <div 
          className={`rounded-lg p-3 h-full min-h-[120px] bg-muted/30 border border-dashed border-border flex items-center justify-center ${
            isTodayDate ? 'ring-2 ring-primary' : ''
          }`}
        >
          <span className="text-sm text-muted-foreground">Weekend</span>
        </div>
      );
    }

    if (daySchedule.length === 0 && !isLoading) {
      return (
        <div 
          className={`rounded-lg p-3 h-full min-h-[120px] bg-muted/10 border border-border flex items-center justify-center ${
            isTodayDate ? 'ring-2 ring-primary' : ''
          }`}
        >
          <span className="text-sm text-muted-foreground">Pas de rotation</span>
        </div>
      );
    }

    return (
      <div 
        className={`rounded-lg p-2 h-full min-h-[120px] bg-card border border-border space-y-1 ${
          isTodayDate ? 'ring-2 ring-primary' : ''
        }`}
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          daySchedule.map((assignment) => {
            const team = teams.find(t => t.code === assignment.team_code);
            const ShiftIcon = SHIFT_ICONS[assignment.shift_code];
            return (
              <div 
                key={assignment.team_code}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border ${SHIFT_BG_COLORS[assignment.shift_code]}`}
              >
                <ShiftIcon className={`h-4 w-4 ${SHIFT_TEXT_COLORS[assignment.shift_code]}`} />
                <span className={`text-xs font-medium ${SHIFT_TEXT_COLORS[assignment.shift_code]}`}>
                  {assignment.shift_code}
                </span>
                <Badge 
                  variant="secondary" 
                  className="ml-auto text-xs px-1.5"
                  style={{ backgroundColor: team?.color || undefined }}
                >
                  {team?.name || assignment.team_code}
                </Badge>
              </div>
            );
          })
        )}
        {daySchedule.length > 0 && (
          <div className="text-[10px] text-muted-foreground text-center pt-1">
            Bloc {daySchedule[0]?.block_number} · Jour {daySchedule[0]?.cycle_day}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout title="Rotation des Équipes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <RotateCcw className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Rotation des Équipes</h1>
              <p className="text-muted-foreground">
                Calendrier sur 2 semaines · {config?.name || 'Configuration 3×8'}
              </p>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeeks}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              <Calendar className="h-4 w-4 mr-2" />
              Aujourd'hui
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextWeeks}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Légende des postes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {shifts.map((shift) => {
              const ShiftIcon = SHIFT_ICONS[shift.code as ShiftCode];
              return (
                <div 
                  key={shift.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${SHIFT_BG_COLORS[shift.code as ShiftCode]}`}
                >
                  <ShiftIcon className={`h-5 w-5 ${SHIFT_TEXT_COLORS[shift.code as ShiftCode]}`} />
                  <div>
                    <span className={`font-medium ${SHIFT_TEXT_COLORS[shift.code as ShiftCode]}`}>
                      {shift.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                      {shift.is_cross_day && ' (+1j)'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Teams info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Équipes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <Badge 
                key={team.id}
                variant="outline"
                className="px-3 py-1"
                style={{ borderColor: team.color || undefined, color: team.color || undefined }}
              >
                {team.name}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardHeader>
            <CardTitle>
              {format(startDate, 'd MMMM', { locale: fr })} - {format(addDays(startDate, 13), 'd MMMM yyyy', { locale: fr })}
            </CardTitle>
            <CardDescription>
              Cycle de {config?.blocks_per_cycle || 3} blocs × {config?.days_per_block || 2} jours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Week 1 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Semaine 1</h3>
              <div className="grid grid-cols-7 gap-2">
                {dates.slice(0, 7).map((date) => (
                  <div key={date.toISOString()} className="space-y-1">
                    <div className={`text-center text-xs font-medium pb-1 ${isToday(date) ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(date, 'EEE', { locale: fr })}
                      <br />
                      <span className={`text-sm ${isToday(date) ? 'text-primary font-bold' : ''}`}>
                        {format(date, 'd')}
                      </span>
                    </div>
                    {renderDayCell(date)}
                  </div>
                ))}
              </div>
            </div>

            {/* Week 2 */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Semaine 2</h3>
              <div className="grid grid-cols-7 gap-2">
                {dates.slice(7, 14).map((date) => (
                  <div key={date.toISOString()} className="space-y-1">
                    <div className={`text-center text-xs font-medium pb-1 ${isToday(date) ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(date, 'EEE', { locale: fr })}
                      <br />
                      <span className={`text-sm ${isToday(date) ? 'text-primary font-bold' : ''}`}>
                        {format(date, 'd')}
                      </span>
                    </div>
                    {renderDayCell(date)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cycle Info */}
        {config && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration du cycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date de début du cycle</span>
                <span className="font-medium">
                  {format(new Date(config.cycle_start_date), 'd MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durée d'un bloc</span>
                <span className="font-medium">{config.days_per_block} jours de production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blocs par cycle</span>
                <span className="font-medium">{config.blocks_per_cycle} blocs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gel week-end</span>
                <Badge variant={config.weekend_freeze_enabled ? 'default' : 'secondary'}>
                  {config.weekend_freeze_enabled ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
