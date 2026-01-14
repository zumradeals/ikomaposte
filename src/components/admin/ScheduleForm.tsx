import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkSchedule, WorkScheduleInsert, DAY_OF_WEEK_LABELS } from '@/types/business-rules';

interface ScheduleFormProps {
  schedule?: WorkSchedule | null;
  categoryId: string;
  onSubmit: (data: WorkScheduleInsert | Partial<WorkSchedule>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ScheduleForm({ 
  schedule, 
  categoryId, 
  onSubmit, 
  onCancel, 
  isLoading 
}: ScheduleFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [toleranceLate, setToleranceLate] = useState('15');
  const [toleranceEarlyLeave, setToleranceEarlyLeave] = useState('15');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (schedule) {
      setDayOfWeek(schedule.day_of_week);
      setStartTime(schedule.start_time.slice(0, 5)); // HH:MM
      setEndTime(schedule.end_time.slice(0, 5));
      setToleranceLate(schedule.tolerance_late_minutes.toString());
      setToleranceEarlyLeave(schedule.tolerance_early_leave_minutes.toString());
      setIsActive(schedule.is_active);
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lateTol = parseInt(toleranceLate, 10);
    const earlyTol = parseInt(toleranceEarlyLeave, 10);

    if (isNaN(lateTol) || lateTol < 0) {
      setError('La tolérance retard doit être >= 0');
      return;
    }

    if (isNaN(earlyTol) || earlyTol < 0) {
      setError('La tolérance départ anticipé doit être >= 0');
      return;
    }

    if (!startTime || !endTime) {
      setError('Les horaires sont requis');
      return;
    }

    if (startTime >= endTime) {
      setError('L\'heure de début doit être avant l\'heure de fin');
      return;
    }

    const data: WorkScheduleInsert = {
      category_id: categoryId,
      day_of_week: dayOfWeek,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      tolerance_late_minutes: lateTol,
      tolerance_early_leave_minutes: earlyTol,
      is_active: isActive,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="dayOfWeek">Jour de la semaine</Label>
        <Select
          value={dayOfWeek.toString()}
          onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}
          disabled={!!schedule} // Can't change day when editing
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <SelectItem key={day} value={day.toString()}>
                {DAY_OF_WEEK_LABELS[day]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Heure de début</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">Heure de fin</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="text-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="toleranceLate">Tolérance retard (min)</Label>
          <Input
            id="toleranceLate"
            type="number"
            min="0"
            max="120"
            value={toleranceLate}
            onChange={(e) => setToleranceLate(e.target.value)}
            className="text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Minutes de retard tolérées avant statut RETARD
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="toleranceEarlyLeave">Tolérance départ anticipé (min)</Label>
          <Input
            id="toleranceEarlyLeave"
            type="number"
            min="0"
            max="120"
            value={toleranceEarlyLeave}
            onChange={(e) => setToleranceEarlyLeave(e.target.value)}
            className="text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Minutes de départ anticipé tolérées
          </p>
        </div>
      </div>

      {schedule && (
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div>
            <Label htmlFor="isActive">Horaire actif</Label>
            <p className="text-sm text-muted-foreground">
              Les horaires inactifs sont ignorés par le calcul
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading}
        >
          {isLoading ? 'Enregistrement...' : schedule ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
