// ============================================
// Phase 7: Validation Detail Modal
// View summary details, HR override, validate
// ============================================

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  User,
  Loader2,
  Edit,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useValidateSummary } from '@/hooks/useValidation';
import { useHROverride } from '@/hooks/useHROverride';
import { useWorkerDayEventsForDate } from '@/hooks/useWorkSummaries';
import { DAY_STATUS_LABELS, DAY_STATUS_COLORS, ANOMALY_CODE_LABELS } from '@/types/business-rules';
import { WorkSegment } from '@/types/work-summaries';

interface ValidationDetailModalProps {
  summary: any;
  onClose: () => void;
}

export function ValidationDetailModal({ summary, onClose }: ValidationDetailModalProps) {
  const { user } = useAuth();
  const validateSummary = useValidateSummary();
  const hrOverride = useHROverride();
  
  const workDate = new Date(summary.work_date);
  const { data: events } = useWorkerDayEventsForDate(summary.worker_id, workDate);
  
  // HR Override form state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideCheckin, setOverrideCheckin] = useState(summary.hr_override_checkin || '');
  const [overrideCheckout, setOverrideCheckout] = useState(summary.hr_override_checkout || '');
  const [overrideReason, setOverrideReason] = useState(summary.hr_override_reason || '');

  // Parse segments
  const segments: WorkSegment[] = summary.segments_json || [];

  // Format time
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    return timeStr.substring(0, 5); // HH:MM
  };

  // Extract checkin/checkout from events
  const extractTimes = () => {
    if (!events || events.length === 0) return { checkin: null, checkout: null };
    
    const sorted = [...events].sort((a, b) => 
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    
    const takeEvent = sorted.find(e => e.event_type === 'TAKE');
    const endEvent = [...sorted].reverse().find(e => e.event_type === 'END');
    
    return {
      checkin: takeEvent ? format(new Date(takeEvent.occurred_at), 'HH:mm') : null,
      checkout: endEvent ? format(new Date(endEvent.occurred_at), 'HH:mm') : null,
    };
  };

  const times = extractTimes();

  // Handle validation
  const handleValidate = async () => {
    if (!user?.id) return;
    
    await validateSummary.mutateAsync({
      summaryId: summary.id,
      validatorId: user.id,
    });
    
    onClose();
  };

  // Handle HR override
  const handleOverride = async () => {
    if (!user?.id || !overrideReason.trim()) return;
    
    await hrOverride.mutateAsync({
      summaryId: summary.id,
      workerId: summary.worker_id,
      workDate: summary.work_date,
      hrOverrideCheckin: overrideCheckin || null,
      hrOverrideCheckout: overrideCheckout || null,
      hrOverrideReason: overrideReason,
      adminId: user.id,
    });
    
    setShowOverrideForm(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Détail du résumé
          </DialogTitle>
          <DialogDescription>
            {format(workDate, 'EEEE d MMMM yyyy', { locale: fr })} — {summary.workers?.nom_affiche}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                Salarié
              </div>
              <p className="font-medium">{summary.workers?.nom_affiche}</p>
              <p className="text-xs text-muted-foreground">{summary.workers?.matricule}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Statut</div>
              <Badge 
                variant="secondary"
                className={cn(
                  summary.day_status && DAY_STATUS_COLORS[summary.day_status as keyof typeof DAY_STATUS_COLORS]
                )}
              >
                {summary.day_status 
                  ? DAY_STATUS_LABELS[summary.day_status as keyof typeof DAY_STATUS_LABELS]
                  : '—'
                }
              </Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Temps travail
              </div>
              <p className="font-mono font-bold">
                {summary.day_status === 'ANOMALIE' || summary.day_status === 'ABSENT'
                  ? '0 min'
                  : `${summary.total_work_minutes} min`
                }
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Retard</div>
              <p className={cn(
                'font-mono font-bold',
                summary.late_minutes > 0 ? 'text-orange-600' : 'text-muted-foreground'
              )}>
                {summary.late_minutes > 0 ? `${summary.late_minutes} min` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Anomaly Alert */}
        {summary.anomaly_code && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Anomalie détectée</p>
              <p className="text-sm text-muted-foreground">
                {ANOMALY_CODE_LABELS[summary.anomaly_code as keyof typeof ANOMALY_CODE_LABELS] || summary.anomaly_code}
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="events">Événements</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Check-in</Label>
                <p className="font-mono text-lg">
                  {summary.hr_override_checkin 
                    ? <span className="text-blue-600">{formatTime(summary.hr_override_checkin)} (HR)</span>
                    : times.checkin || '—'
                  }
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Check-out</Label>
                <p className="font-mono text-lg">
                  {summary.hr_override_checkout 
                    ? <span className="text-blue-600">{formatTime(summary.hr_override_checkout)} (HR)</span>
                    : times.checkout || '—'
                  }
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Version calcul</Label>
                <p className="font-mono">{summary.calculation_version}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Révision</Label>
                <p className="font-mono">#{summary.revision}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Événements utilisés</Label>
                <p className="font-mono">{summary.events_used?.length || 0}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Auto-clôturé</Label>
                <p>{summary.auto_closed ? 'Oui' : 'Non'}</p>
              </div>
            </div>

            {summary.notes && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{summary.notes}</p>
                </div>
              </>
            )}

            {/* HR Override Form */}
            {showOverrideForm ? (
              <>
                <Separator />
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Correction RH
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="override-checkin">Check-in corrigé (HH:MM)</Label>
                        <Input
                          id="override-checkin"
                          type="time"
                          value={overrideCheckin}
                          onChange={(e) => setOverrideCheckin(e.target.value)}
                          placeholder="08:00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="override-checkout">Check-out corrigé (HH:MM)</Label>
                        <Input
                          id="override-checkout"
                          type="time"
                          value={overrideCheckout}
                          onChange={(e) => setOverrideCheckout(e.target.value)}
                          placeholder="17:00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="override-reason">Justification (obligatoire)</Label>
                      <Textarea
                        id="override-reason"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Raison de la correction..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOverrideForm(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleOverride}
                        disabled={!overrideReason.trim() || hrOverride.isPending}
                      >
                        {hrOverride.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Recalculer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOverrideForm(true)}
                className="mt-2"
              >
                <Edit className="h-4 w-4 mr-2" />
                Correction RH
              </Button>
            )}
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments">
            {segments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Aucun segment</p>
            ) : (
              <div className="space-y-2">
                {segments.map((seg, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="mr-2">
                          {seg.start_type} → {seg.end_type}
                        </Badge>
                        <span className="text-sm">
                          {format(new Date(seg.start_at), 'HH:mm')} — {format(new Date(seg.end_at), 'HH:mm')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold">{seg.duration_minutes} min</span>
                        {seg.is_auto_closed && (
                          <Badge variant="secondary" className="ml-2 text-xs">Auto</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            {!events || events.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Aucun événement</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{event.event_type}</Badge>
                      <span className="font-mono text-sm">
                        {format(new Date(event.occurred_at), 'HH:mm:ss')}
                      </span>
                    </div>
                    <Badge
                      variant={event.trust_status === 'trusted' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {event.trust_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            onClick={handleValidate}
            disabled={validateSummary.isPending}
            className="gap-2"
          >
            {validateSummary.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Valider et verrouiller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
