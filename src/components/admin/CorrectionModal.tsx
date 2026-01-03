import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Clock, User, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateCorrection } from '@/hooks/useCorrections';
import {
  DaySummary,
  AnomalyType,
  CorrectionAction,
  ANOMALY_TYPE_LABELS,
  CORRECTION_ACTION_LABELS,
} from '@/types/corrections';

interface CorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daySummary: DaySummary | null;
}

export function CorrectionModal({ open, onOpenChange, daySummary }: CorrectionModalProps) {
  const { user } = useAuth();
  const createCorrection = useCreateCorrection();

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyType | ''>('');
  const [selectedAction, setSelectedAction] = useState<CorrectionAction | ''>('');
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    if (!daySummary || !user || !selectedAnomaly || !selectedAction || !justification.trim()) {
      return;
    }

    await createCorrection.mutateAsync({
      worker_id: daySummary.worker_id,
      work_date: daySummary.work_date,
      anomaly_type: selectedAnomaly,
      correction_action: selectedAction,
      justification: justification.trim(),
      admin_id: user.id,
      payload: {
        original_events: daySummary.events.map(e => e.id),
      },
    });

    // Reset and close
    setSelectedAnomaly('');
    setSelectedAction('');
    setJustification('');
    onOpenChange(false);
  };

  if (!daySummary) return null;

  const uncorrectedAnomalies = daySummary.anomalies.filter(
    a => !daySummary.corrections.some(c => c.anomaly_type === a.anomaly_type)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Corriger une anomalie
          </DialogTitle>
          <DialogDescription>
            Créez une correction pour cette journée. Les événements originaux ne seront pas modifiés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Day info */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{daySummary.worker_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(parseISO(daySummary.work_date), 'EEEE d MMMM yyyy', { locale: fr })}
              </span>
            </div>
          </div>

          {/* Events timeline */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Événements de la journée</Label>
            <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {daySummary.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement</p>
              ) : (
                <div className="space-y-1">
                  {daySummary.events.map((event, idx) => (
                    <div key={event.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-16">
                        {format(parseISO(event.occurred_at), 'HH:mm')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {event.event_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Anomalies detected */}
          {uncorrectedAnomalies.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Anomalies détectées</Label>
              <div className="space-y-1">
                {uncorrectedAnomalies.map((anomaly, idx) => (
                  <div
                    key={idx}
                    className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{ANOMALY_TYPE_LABELS[anomaly.anomaly_type]}</span>
                    <span className="text-destructive/80 ml-2">— {anomaly.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing corrections */}
          {daySummary.corrections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Corrections existantes</Label>
              <div className="space-y-1">
                {daySummary.corrections.map((correction) => (
                  <div
                    key={correction.id}
                    className="bg-success/10 text-success rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {ANOMALY_TYPE_LABELS[correction.anomaly_type]}
                    </span>
                    <span className="text-success/80 ml-2">
                      → {CORRECTION_ACTION_LABELS[correction.correction_action]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correction form */}
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="anomaly-type">Type d'anomalie *</Label>
              <Select
                value={selectedAnomaly}
                onValueChange={(val) => setSelectedAnomaly(val as AnomalyType)}
              >
                <SelectTrigger id="anomaly-type">
                  <SelectValue placeholder="Sélectionner le type d'anomalie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-action">Action de correction *</Label>
              <Select
                value={selectedAction}
                onValueChange={(val) => setSelectedAction(val as CorrectionAction)}
              >
                <SelectTrigger id="correction-action">
                  <SelectValue placeholder="Sélectionner l'action" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CORRECTION_ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">
                <FileText className="h-4 w-4 inline mr-1" />
                Justification *
              </Label>
              <Textarea
                id="justification"
                placeholder="Expliquez la raison de cette correction (obligatoire)..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Cette justification sera conservée dans l'historique des corrections.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedAnomaly ||
              !selectedAction ||
              !justification.trim() ||
              createCorrection.isPending
            }
          >
            {createCorrection.isPending ? 'Enregistrement...' : 'Enregistrer la correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
