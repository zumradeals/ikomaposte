import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Clock, 
  Banknote, 
  AlertTriangle, 
  RefreshCw,
  Coffee,
  Calendar,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { WorkSummaryWithWorker, WorkSegment } from '@/types/work-summaries';
import { useWorkerDayEventsForDate, useCalculateSummary } from '@/hooks/useWorkSummaries';
import { formatMinutesAsTime, formatAmount } from '@/lib/work-calculator';
import { EVENT_LABELS, EVENT_ICONS, TrustStatus, TRUST_LABELS } from '@/types/work-events';

interface SummaryDetailModalProps {
  summary: WorkSummaryWithWorker | null;
  onClose: () => void;
}

export default function SummaryDetailModal({ summary, onClose }: SummaryDetailModalProps) {
  const [activeTab, setActiveTab] = useState('segments');
  const calculateSummary = useCalculateSummary();

  const workDate = summary?.work_date ? parseISO(summary.work_date) : new Date();
  const { data: events, isLoading: eventsLoading } = useWorkerDayEventsForDate(
    summary?.worker_id || '',
    workDate
  );

  if (!summary) return null;

  const handleRecalculate = () => {
    calculateSummary.mutate({
      workerId: summary.worker_id,
      date: workDate,
    });
  };

  const segments = summary.segments_json || [];

  return (
    <Dialog open={!!summary} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              {summary.workers?.photo_url ? (
                <img 
                  src={summary.workers.photo_url} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p>{summary.workers?.nom_affiche}</p>
              <p className="text-sm font-normal text-muted-foreground">
                {summary.workers?.matricule} • {format(workDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{formatMinutesAsTime(summary.total_work_minutes)}</p>
            <p className="text-xs text-muted-foreground">Travail</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <Coffee className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{summary.total_pause_minutes}m</p>
            <p className="text-xs text-muted-foreground">Pauses</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <Banknote className="w-5 h-5 mx-auto text-success mb-1" />
            <p className="text-lg font-bold text-success">
              {formatAmount(summary.total_amount, summary.devise)}
            </p>
            <p className="text-xs text-muted-foreground">Montant</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            {summary.workers?.categories?.nom}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Taux: {summary.taux_horaire_applied} {summary.devise}/h
          </Badge>
          {summary.auto_closed && (
            <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Auto-clôturé à {summary.auto_close_time?.slice(0, 5)}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs text-muted-foreground">
            v{summary.calculation_version}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="segments">Segments ({segments.length})</TabsTrigger>
            <TabsTrigger value="events">Événements ({events?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Segments timeline */}
          <TabsContent value="segments" className="mt-4">
            <div className="space-y-3">
              {segments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun segment</p>
              ) : (
                segments.map((segment, idx) => (
                  <SegmentCard key={idx} segment={segment} index={idx} />
                ))
              )}
            </div>
          </TabsContent>

          {/* Events list */}
          <TabsContent value="events" className="mt-4">
            {eventsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {events?.map((event) => (
                  <div 
                    key={event.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      event.trust_status === 'trusted' 
                        ? 'bg-card border-border' 
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{EVENT_ICONS[event.event_type]}</span>
                      <div>
                        <p className="font-medium text-sm">{EVENT_LABELS[event.event_type]}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {format(new Date(event.occurred_at), 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={event.trust_status === 'trusted' 
                        ? 'bg-success/20 text-success border-success/30' 
                        : 'bg-destructive/20 text-destructive border-destructive/30'}
                    >
                      {event.trust_status === 'trusted' ? (
                        <ShieldCheck className="w-3 h-3 mr-1" />
                      ) : (
                        <ShieldAlert className="w-3 h-3 mr-1" />
                      )}
                      {TRUST_LABELS[event.trust_status as TrustStatus]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Notes/warnings */}
        {summary.notes && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Notes
            </p>
            <p className="text-xs text-muted-foreground mt-1">{summary.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button 
            onClick={handleRecalculate}
            disabled={calculateSummary.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${calculateSummary.isPending ? 'animate-spin' : ''}`} />
            Recalculer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SegmentCard({ segment, index }: { segment: WorkSegment; index: number }) {
  const startTime = format(new Date(segment.start_at), 'HH:mm');
  const endTime = format(new Date(segment.end_at), 'HH:mm');

  return (
    <div className={`relative p-3 rounded-lg border ${
      segment.is_auto_closed 
        ? 'bg-warning/5 border-warning/20' 
        : 'bg-card border-border'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-medium">
              {segment.start_type} → {segment.end_type}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {startTime} → {endTime}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono font-bold">{formatMinutesAsTime(segment.duration_minutes)}</p>
          {segment.is_auto_closed && (
            <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30 mt-1">
              Auto-clôturé
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
