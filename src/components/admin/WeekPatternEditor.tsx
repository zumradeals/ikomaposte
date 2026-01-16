import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { WeekPattern, WeekdayConfig, TimeSlot } from '@/types/policies';

const WEEKDAY_LABELS: Record<keyof WeekPattern, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const WEEKDAY_ORDER: (keyof WeekPattern)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

interface WeekPatternEditorProps {
  value: WeekPattern;
  onChange: (pattern: WeekPattern) => void;
  disabled?: boolean;
}

export function WeekPatternEditor({ value, onChange, disabled }: WeekPatternEditorProps) {
  const [expandedDay, setExpandedDay] = useState<keyof WeekPattern | null>(null);

  const updateDay = (day: keyof WeekPattern, config: WeekdayConfig) => {
    onChange({
      ...value,
      [day]: config,
    });
  };

  const toggleWorkingDay = (day: keyof WeekPattern) => {
    const current = value[day];
    updateDay(day, {
      ...current,
      working_day: !current.working_day,
      // Add default slot if enabling
      time_slots: !current.working_day && current.time_slots.length === 0 
        ? [{ start_time: '08:00', end_time: '17:00', allow_cross_day: false }]
        : current.time_slots,
    });
  };

  const addTimeSlot = (day: keyof WeekPattern) => {
    const current = value[day];
    updateDay(day, {
      ...current,
      time_slots: [
        ...current.time_slots,
        { start_time: '08:00', end_time: '17:00', allow_cross_day: false },
      ],
    });
  };

  const updateTimeSlot = (day: keyof WeekPattern, index: number, slot: TimeSlot) => {
    const current = value[day];
    const newSlots = [...current.time_slots];
    newSlots[index] = slot;
    updateDay(day, { ...current, time_slots: newSlots });
  };

  const removeTimeSlot = (day: keyof WeekPattern, index: number) => {
    const current = value[day];
    updateDay(day, {
      ...current,
      time_slots: current.time_slots.filter((_, i) => i !== index),
    });
  };

  const copyToAllWeekdays = (sourceDay: keyof WeekPattern) => {
    const sourceConfig = value[sourceDay];
    const weekdays: (keyof WeekPattern)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    const newPattern = { ...value };
    weekdays.forEach(day => {
      newPattern[day] = { ...sourceConfig };
    });
    onChange(newPattern);
  };

  return (
    <div className="space-y-3">
      {WEEKDAY_ORDER.map((day) => {
        const config = value[day];
        const isExpanded = expandedDay === day;
        
        return (
          <Card 
            key={day} 
            className={`transition-colors ${config.working_day ? 'border-primary/30' : 'opacity-60'}`}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={config.working_day}
                    onCheckedChange={() => toggleWorkingDay(day)}
                    disabled={disabled}
                  />
                  <CardTitle className="text-base font-medium">
                    {WEEKDAY_LABELS[day]}
                  </CardTitle>
                </div>
                
                {config.working_day && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {config.time_slots.length} créneau{config.time_slots.length > 1 ? 'x' : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedDay(isExpanded ? null : day)}
                      disabled={disabled}
                    >
                      {isExpanded ? 'Réduire' : 'Éditer'}
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Quick preview */}
              {config.working_day && !isExpanded && config.time_slots.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.time_slots.map((slot, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                    >
                      {slot.start_time} - {slot.end_time}
                      {slot.allow_cross_day && ' (nuit)'}
                    </span>
                  ))}
                </div>
              )}
            </CardHeader>
            
            {isExpanded && config.working_day && (
              <CardContent className="pt-0 pb-4 space-y-3">
                {config.time_slots.map((slot, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Début</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateTimeSlot(day, index, { ...slot, start_time: e.target.value })}
                          disabled={disabled}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Fin</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateTimeSlot(day, index, { ...slot, end_time: e.target.value })}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`cross-day-${day}-${index}`}
                          checked={slot.allow_cross_day}
                          onCheckedChange={(checked) => updateTimeSlot(day, index, { ...slot, allow_cross_day: checked })}
                          disabled={disabled}
                        />
                        <Label 
                          htmlFor={`cross-day-${day}-${index}`}
                          className="text-xs"
                        >
                          Nuit
                        </Label>
                      </div>
                      
                      {config.time_slots.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTimeSlot(day, index)}
                          disabled={disabled}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTimeSlot(day)}
                    disabled={disabled}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter créneau
                  </Button>
                  
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToAllWeekdays(day)}
                      disabled={disabled}
                    >
                      Copier à tous les jours ouvrés
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
