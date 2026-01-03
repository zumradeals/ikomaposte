import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useTodayEvents, useDateRangeEvents } from '@/hooks/useWorkEvents';
import { WorkEventWithWorker, EVENT_LABELS, EVENT_ICONS } from '@/types/work-events';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Download, Eye, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminEvents() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();
  const { data: events, isLoading, refetch } = useTodayEvents();
  const [selectedEvent, setSelectedEvent] = useState<WorkEventWithWorker | null>(null);

  if (!isUnlocked) {
    navigate('/');
    return null;
  }

  const handleExportCSV = () => {
    if (!events?.length) return;

    const headers = ['Heure', 'Travailleur', 'Matricule', 'Catégorie', 'Action', 'Device'];
    const rows = events.map(event => [
      format(new Date(event.occurred_at), 'HH:mm:ss'),
      event.workers?.nom_affiche || 'N/A',
      event.workers?.matricule || 'N/A',
      event.workers?.categories?.nom || 'N/A',
      EVENT_LABELS[event.event_type],
      event.device_id,
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

  return (
    <AdminLayout title="Flux du jour">
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">
              {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
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
                    <TableHead className="hidden lg:table-cell">Device</TableHead>
                    <TableHead className="text-right">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
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
                      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {event.device_id.slice(0, 8)}...
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Stats summary */}
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
            <DialogTitle>
              Vérification - {selectedEvent?.workers?.nom_affiche}
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

              {/* Snapshot */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Snapshot ({format(new Date(selectedEvent.occurred_at), 'HH:mm:ss')})
                </p>
                <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                  {selectedEvent.snapshot_url ? (
                    <img 
                      src={selectedEvent.snapshot_url} 
                      alt="Snapshot"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <p>Pas de snapshot</p>
                      {selectedEvent.incident_flag && (
                        <p className="text-destructive text-sm mt-2">
                          {selectedEvent.incident_flag}
                        </p>
                      )}
                    </div>
                  )}
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
