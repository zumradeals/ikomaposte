import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useDetectAnomalies } from '@/hooks/useCorrections';
import { CorrectionModal } from '@/components/admin/CorrectionModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DaySummary, ANOMALY_TYPE_LABELS } from '@/types/corrections';

type StatusFilter = 'all' | 'incoherent' | 'corrected' | 'healthy';

export default function AdminAnomalies() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedSummary, setSelectedSummary] = useState<DaySummary | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const { data, isLoading, refetch } = useDetectAnomalies(selectedDate);

  useEffect(() => {
    if (!isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  if (!isUnlocked) return null;

  const filteredSummaries = data?.summaries.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  }) || [];

  const stats = {
    total: data?.summaries.length || 0,
    incoherent: data?.summaries.filter((s) => s.status === 'incoherent').length || 0,
    corrected: data?.summaries.filter((s) => s.status === 'corrected').length || 0,
    healthy: data?.summaries.filter((s) => s.status === 'healthy').length || 0,
  };

  const handleCorrect = (summary: DaySummary) => {
    setSelectedSummary(summary);
    setShowCorrectionModal(true);
  };

  const getStatusBadge = (status: DaySummary['status']) => {
    switch (status) {
      case 'incoherent':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            INCOHÉRENT
          </Badge>
        );
      case 'corrected':
        return (
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            CORRIGÉ
          </Badge>
        );
      case 'healthy':
        return (
          <Badge variant="outline" className="bg-success/20 text-success border-success/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            SAIN
          </Badge>
        );
    }
  };

  return (
    <AdminLayout title="Anomalies & Corrections">
      <div className="space-y-6">
        {/* Info card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Système de correction
            </CardTitle>
            <CardDescription>
              Les corrections sont des overlays sur les événements originaux. Aucun événement n'est
              jamais modifié ou supprimé. Chaque correction est tracée et horodatée.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Journées analysées</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">{stats.incoherent}</div>
              <p className="text-xs text-muted-foreground">Incohérentes</p>
            </CardContent>
          </Card>
          <Card className="border-warning/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{stats.corrected}</div>
              <p className="text-xs text-muted-foreground">Corrigées</p>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{stats.healthy}</div>
              <p className="text-xs text-muted-foreground">Saines</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as StatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="incoherent">Incohérents</SelectItem>
                <SelectItem value="corrected">Corrigés</SelectItem>
                <SelectItem value="healthy">Sains</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => refetch()} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune anomalie détectée</p>
              <p className="text-sm mt-1">
                Toutes les journées pour cette date sont cohérentes
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Travailleur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Événements</TableHead>
                    <TableHead>Anomalies</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummaries.map((summary) => (
                    <TableRow key={`${summary.worker_id}-${summary.work_date}`}>
                      <TableCell className="font-medium">{summary.worker_name}</TableCell>
                      <TableCell>
                        {format(parseISO(summary.work_date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {summary.events.slice(0, 4).map((e, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {e.event_type}
                            </Badge>
                          ))}
                          {summary.events.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{summary.events.length - 4}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {summary.anomalies.slice(0, 2).map((a, idx) => (
                            <div key={idx} className="text-xs text-destructive">
                              {ANOMALY_TYPE_LABELS[a.anomaly_type]}
                            </div>
                          ))}
                          {summary.anomalies.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{summary.anomalies.length - 2} autres
                            </div>
                          )}
                          {summary.anomalies.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(summary.status)}</TableCell>
                      <TableCell className="text-right">
                        {summary.status !== 'healthy' && (
                          <Button
                            size="sm"
                            variant={summary.status === 'incoherent' ? 'default' : 'outline'}
                            onClick={() => handleCorrect(summary)}
                          >
                            {summary.status === 'incoherent' ? 'Corriger' : 'Voir'}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Quick date navigation */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Raccourcis :</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
          >
            Hier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'))}
          >
            Il y a 7 jours
          </Button>
        </div>
      </div>

      {/* Correction modal */}
      <CorrectionModal
        open={showCorrectionModal}
        onOpenChange={setShowCorrectionModal}
        daySummary={selectedSummary}
      />
    </AdminLayout>
  );
}
