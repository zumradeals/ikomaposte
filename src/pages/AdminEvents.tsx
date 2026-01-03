import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useTodayEvents } from '@/hooks/useWorkEvents';
import { useSnapshotUrl } from '@/hooks/useSnapshotUrl';
import { WorkEventWithWorker, EVENT_LABELS, EVENT_ICONS, TrustStatus, TRUST_LABELS, TRUST_COLORS } from '@/types/work-events';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { User, Download, Eye, Calendar, RefreshCw, Shield, ShieldAlert, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Component for displaying snapshot with signed URL
function SnapshotImage({ snapshotUrl, className }: { snapshotUrl: string | null; className?: string }) {
  const { signedUrl, isLoading, error } = useSnapshotUrl(snapshotUrl);

  if (!snapshotUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <p className="text-muted-foreground text-sm">Pas de snapshot</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-destructive/10 ${className}`}>
        <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-destructive text-xs text-center px-2">{error}</p>
      </div>
    );
  }

  return (
    <img 
      src={signedUrl || ''} 
      alt="Snapshot"
      className={`object-cover ${className}`}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}

export default function AdminEvents() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();
  const [trustFilter, setTrustFilter] = useState<TrustStatus | 'all'>('all');
  const { data: events, isLoading, refetch } = useTodayEvents(trustFilter);
  const [selectedEvent, setSelectedEvent] = useState<WorkEventWithWorker | null>(null);

  useEffect(() => {
    if (!isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  if (!isUnlocked) return null;

  const handleExportCSV = () => {
    if (!events?.length) return;

    const headers = ['Heure', 'Travailleur', 'Matricule', 'Catégorie', 'Action', 'Device', 'Statut', 'Raison'];
    const rows = events.map(event => [
      format(new Date(event.occurred_at), 'HH:mm:ss'),
      event.workers?.nom_affiche || 'N/A',
      event.workers?.matricule || 'N/A',
      event.workers?.categories?.nom || 'N/A',
      EVENT_LABELS[event.event_type],
      event.device_id,
      event.trust_status === 'trusted' ? 'TRUSTED' : 'UNTRUSTED',
      event.trust_reason || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pointages-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'TAKE': return 'bg-success/20 text-success';
      case 'PAUSE': return 'bg-warning/20 text-warning';
      case 'RESUME': return 'bg-primary/20 text-primary';
      case 'END': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTrustIcon = (status: TrustStatus) => {
    return status === 'trusted' ? ShieldCheck : ShieldAlert;
  };

  // Stats
  const allEvents = events || [];
  const trustedCount = allEvents.filter(e => e.trust_status === 'trusted').length;
  const untrustedCount = allEvents.filter(e => e.trust_status === 'untrusted').length;

  return (
    <AdminLayout title="Flux du jour">
      <div className="space-y-6">
        {/* Trust summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Total</span>
            </div>
            <p className="text-2xl font-bold">{allEvents.length}</p>
          </div>
          <div className="bg-success/10 rounded-xl p-4 border border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-sm">Trusted</span>
            </div>
            <p className="text-2xl font-bold text-success">{trustedCount}</p>
          </div>
          <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-sm">Untrusted</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{untrustedCount}</p>
          </div>
        </div>

        {/* Info banner about calculations */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-primary">Calculs basés sur TRUSTED uniquement</p>
            <p className="text-sm text-muted-foreground">
              Les événements UNTRUSTED (appareils non enrôlés) sont affichés mais exclus des calculs de paie.
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </span>
            </div>
            
            {/* Trust filter */}
            <Select 
              value={trustFilter} 
              onValueChange={(v) => setTrustFilter(v as TrustStatus | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les événements</SelectItem>
                <SelectItem value="trusted">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    Trusted uniquement
                  </span>
                </SelectItem>
                <SelectItem value="untrusted">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                    Untrusted uniquement
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={!events?.length}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Events table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !events?.length ? (
            <div className="text-center p-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun pointage aujourd'hui</p>
              <p className="text-sm">Les événements apparaîtront ici en temps réel</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Travailleur</TableHead>
                    <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Device</TableHead>
                    <TableHead className="text-right">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const TrustIcon = getTrustIcon(event.trust_status as TrustStatus);
                    return (
                      <TableRow key={event.id} className={event.trust_status === 'untrusted' ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(event.occurred_at), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                              {event.workers?.photo_url ? (
                                <img 
                                  src={event.workers.photo_url} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{event.workers?.nom_affiche || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">
                                {event.workers?.matricule}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {event.workers?.categories?.nom || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getEventBadgeClass(event.event_type)}`}>
                            <span>{EVENT_ICONS[event.event_type]}</span>
                            <span className="hidden sm:inline">{EVENT_LABELS[event.event_type]}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={TRUST_COLORS[event.trust_status as TrustStatus]}
                          >
                            <TrustIcon className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">
                              {event.trust_status === 'trusted' ? 'Trusted' : 'Untrusted'}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {event.device_id.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="text-right">
                          {event.snapshot_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          ) : event.incident_flag ? (
                            <span className="text-xs text-destructive">
                              {event.incident_flag}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Stats summary by event type */}
        {events && events.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['TAKE', 'PAUSE', 'RESUME', 'END'] as const).map((type) => {
              const count = events.filter(e => e.event_type === type).length;
              return (
                <div 
                  key={type}
                  className={`${getEventBadgeClass(type)} rounded-xl p-4 text-center`}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm">{EVENT_LABELS[type]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo comparison modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Vérification - {selectedEvent?.workers?.nom_affiche}
              {selectedEvent && (
                <Badge 
                  variant="outline" 
                  className={TRUST_COLORS[selectedEvent.trust_status as TrustStatus]}
                >
                  {selectedEvent.trust_status === 'trusted' ? 'Trusted' : 'Untrusted'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="grid grid-cols-2 gap-6 py-4">
              {/* Reference photo */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Photo de référence
                </p>
                <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                  {selectedEvent.workers?.photo_url ? (
                    <img 
                      src={selectedEvent.workers.photo_url} 
                      alt="Référence"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Snapshot with signed URL */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Snapshot ({format(new Date(selectedEvent.occurred_at), 'HH:mm:ss')})
                </p>
                <div className="aspect-square rounded-xl overflow-hidden">
                  <SnapshotImage 
                    snapshotUrl={selectedEvent.snapshot_url} 
                    className="w-full h-full rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Event details */}
          {selectedEvent && (
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">
                  {EVENT_ICONS[selectedEvent.event_type]} {EVENT_LABELS[selectedEvent.event_type]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device</span>
                <span className="font-mono text-xs">{selectedEvent.device_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trust Status</span>
                <span className={`font-medium ${selectedEvent.trust_status === 'trusted' ? 'text-success' : 'text-destructive'}`}>
                  {selectedEvent.trust_status === 'trusted' ? '✓ Trusted' : '✗ Untrusted'}
                </span>
              </div>
              {selectedEvent.trust_reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raison</span>
                  <span className="text-xs">{selectedEvent.trust_reason}</span>
                </div>
              )}
              {selectedEvent.snapshot_hash && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hash</span>
                  <span className="font-mono text-xs">{selectedEvent.snapshot_hash}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
