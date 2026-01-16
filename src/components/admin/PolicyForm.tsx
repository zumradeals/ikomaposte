import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { WeekPatternEditor } from './WeekPatternEditor';
import { PolicyScopeManager } from './PolicyScopeManager';
import { 
  TimePolicy, 
  WeekPattern, 
  TolerancesConfig, 
  RoundingRulesConfig, 
  OvertimeRulesConfig,
  RoundingMode,
  OvertimeMode,
  ROUNDING_MODE_LABELS,
  OVERTIME_MODE_LABELS 
} from '@/types/policies';
import { 
  DEFAULT_WEEK_PATTERN, 
  DEFAULT_TOLERANCES, 
  DEFAULT_ROUNDING_RULES, 
  DEFAULT_OVERTIME_RULES 
} from '@/hooks/usePolicies';
import { format } from 'date-fns';
import { Calendar, Clock, Settings, Users, Shield } from 'lucide-react';

const policySchema = z.object({
  code: z.string().min(2, 'Code requis (min 2 caractères)').max(20),
  name: z.string().min(3, 'Nom requis (min 3 caractères)'),
  description: z.string().optional(),
  timezone: z.string().default('Africa/Dakar'),
  valid_from: z.string().min(1, 'Date de début requise'),
  valid_to: z.string().optional(),
  immutable_when_active: z.boolean().default(true),
  // Tolerances
  late_grace_minutes: z.number().min(0).max(120).default(15),
  early_leave_grace_minutes: z.number().min(0).max(120).default(15),
  // Rounding
  rounding_mode: z.string().default('NONE'),
  rounding_step_minutes: z.number().min(1).max(60).default(15),
  // Overtime
  overtime_mode: z.string().default('DAILY'),
  overtime_threshold_hours: z.number().min(1).max(24).default(8),
  overtime_approval_required: z.boolean().default(false),
  // Justification (for updates)
  justification: z.string().optional(),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface PolicyFormProps {
  policy?: TimePolicy | null;
  onSubmit: (data: {
    code: string;
    name: string;
    description?: string | null;
    timezone: string;
    valid_from: string;
    valid_to?: string | null;
    week_pattern: WeekPattern;
    tolerances: TolerancesConfig;
    rounding_rules: RoundingRulesConfig;
    overtime_rules: OvertimeRulesConfig;
    immutable_when_active: boolean;
    justification?: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PolicyForm({ policy, onSubmit, onCancel, isLoading }: PolicyFormProps) {
  const [weekPattern, setWeekPattern] = useState<WeekPattern>(
    policy?.week_pattern || DEFAULT_WEEK_PATTERN
  );
  const [activeTab, setActiveTab] = useState('general');
  
  const isEditing = !!policy;
  const isActive = policy?.status === 'ACTIVE';
  
  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      code: policy?.code || '',
      name: policy?.name || '',
      description: policy?.description || '',
      timezone: policy?.timezone || 'Africa/Dakar',
      valid_from: policy?.valid_from || format(new Date(), 'yyyy-MM-dd'),
      valid_to: policy?.valid_to || '',
      immutable_when_active: policy?.immutable_when_active ?? true,
      late_grace_minutes: policy?.tolerances?.late_grace_minutes || 15,
      early_leave_grace_minutes: policy?.tolerances?.early_leave_grace_minutes || 15,
      rounding_mode: policy?.rounding_rules?.mode || 'NONE',
      rounding_step_minutes: policy?.rounding_rules?.step_minutes || 15,
      overtime_mode: policy?.overtime_rules?.mode || 'DAILY',
      overtime_threshold_hours: policy?.overtime_rules?.threshold_hours || 8,
      overtime_approval_required: policy?.overtime_rules?.approval_required || false,
    },
  });

  const handleSubmit = (data: PolicyFormData) => {
    onSubmit({
      code: data.code,
      name: data.name,
      description: data.description || null,
      timezone: data.timezone,
      valid_from: data.valid_from,
      valid_to: data.valid_to || null,
      week_pattern: weekPattern,
      tolerances: {
        late_grace_minutes: data.late_grace_minutes,
        early_leave_grace_minutes: data.early_leave_grace_minutes,
        day_overrides: policy?.tolerances?.day_overrides || {},
      },
      rounding_rules: {
        mode: data.rounding_mode as RoundingMode,
        step_minutes: data.rounding_step_minutes,
        apply_to: policy?.rounding_rules?.apply_to || ['worked_time'],
      },
      overtime_rules: {
        mode: data.overtime_mode as OvertimeMode,
        threshold_hours: data.overtime_threshold_hours,
        approval_required: data.overtime_approval_required,
      },
      immutable_when_active: data.immutable_when_active,
      justification: data.justification,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="general" className="gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Général</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Horaires</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Règles</span>
            </TabsTrigger>
            {isEditing && (
              <TabsTrigger value="scopes" className="gap-1">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Scopes</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="POL-ADM" 
                        disabled={isActive}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuseau horaire</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Africa/Dakar">Africa/Dakar (GMT)</SelectItem>
                        <SelectItem value="Africa/Abidjan">Africa/Abidjan (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la politique</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Politique Administration" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Description de la politique..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valide à partir du</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="valid_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valide jusqu'au (optionnel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Laisser vide pour durée indéterminée</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="immutable_when_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Immuable quand active</FormLabel>
                    <FormDescription>
                      Les modifications créeront une nouvelle version
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </TabsContent>
          
          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Horaires par jour</CardTitle>
                <CardDescription>
                  Définissez les jours ouvrés et les créneaux horaires
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeekPatternEditor
                  value={weekPattern}
                  onChange={setWeekPattern}
                  disabled={isActive}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4 mt-4">
            {/* Tolerances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Tolérances
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="late_grace_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retard toléré (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="early_leave_grace_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Départ anticipé toléré (min)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            {/* Rounding */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Arrondi du temps</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rounding_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode d'arrondi</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ROUNDING_MODE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="rounding_step_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pas (minutes)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            {/* Overtime */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Heures supplémentaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="overtime_mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode de calcul</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(OVERTIME_MODE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="overtime_threshold_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seuil (heures)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="overtime_approval_required"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Approbation requise</FormLabel>
                        <FormDescription>
                          Les heures supp. nécessitent une validation
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Scopes Tab (only for editing) */}
          {isEditing && (
            <TabsContent value="scopes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Scopes d'application
                  </CardTitle>
                  <CardDescription>
                    Définissez à qui cette politique s'applique
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PolicyScopeManager 
                    policyId={policy.id} 
                    disabled={isActive}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
        
        {/* Justification for active policy edits */}
        {isActive && (
          <FormField
            control={form.control}
            name="justification"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-destructive">
                  Justification (requise pour modifier une politique active)
                </FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="Raison de la modification..."
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
