import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  FileText, 
  Gavel,
  CalendarIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  Activity,
  Info
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useExportData,
  usePayrollExport,
  useAuditExport,
  useSyncExport,
  useDisputeExport,
} from '@/hooks/useExports';
import { useWorkers } from '@/hooks/useWorkers';

export default function AdminExports() {
  // Date range state
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Dispute export state
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch data
  const { data: exportData, isLoading } = useExportData(dateRange.from, dateRange.to);
  const { data: workers } = useWorkers();

  // Export mutations
  const payrollExport = usePayrollExport();
  const auditExport = useAuditExport();
  const syncExport = useSyncExport();
  const disputeExport = useDisputeExport();

  // Derived data
  const stats = exportData?.stats;
  const hasIncoherent = (stats?.incoherentDays || 0) > 0;

  // Handle date range presets
  const handlePreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ from: today, to: today });
        break;
      case 'week':
        setDateRange({ from: subDays(today, 7), to: today });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case 'last-month':
        const lastMonth = subDays(startOfMonth(today), 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
    }
  };

  // Export handlers
  const handlePayrollExport = () => {
    if (!exportData) return;
    payrollExport.mutate({
      summaries: exportData.summaries,
      daySummaries: exportData.daySummaries,
      periodFrom: format(dateRange.from, 'yyyy-MM-dd'),
      periodTo: format(dateRange.to, 'yyyy-MM-dd'),
    });
  };

  const handleAuditExport = () => {
    if (!exportData) return;
    auditExport.mutate({
      events: exportData.events,
      corrections: exportData.corrections,
      summaries: exportData.summaries,
      periodFrom: format(dateRange.from, 'yyyy-MM-dd'),
      periodTo: format(dateRange.to, 'yyyy-MM-dd'),
    });
  };

  const handleSyncExport = () => {
    if (!exportData) return;
    syncExport.mutate({
      events: exportData.events,
      corrections: exportData.corrections,
      summaries: exportData.summaries,
      periodFrom: format(dateRange.from, 'yyyy-MM-dd'),
      periodTo: format(dateRange.to, 'yyyy-MM-dd'),
    });
  };

  const handleDisputeExport = () => {
    if (!exportData || !selectedWorker) return;

    const worker = workers?.find(w => w.id === selectedWorker);
    if (!worker) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const workerEvents = exportData.events.filter(
      e => e.worker_id === selectedWorker && 
           format(new Date(e.occurred_at), 'yyyy-MM-dd') === dateStr
    );
    const workerCorrections = exportData.corrections.filter(
      c => c.worker_id === selectedWorker && c.work_date === dateStr
    );
    const workerSummary = exportData.summaries.find(
      s => s.worker_id === selectedWorker && s.work_date === dateStr
    ) || null;

    disputeExport.mutate({
      workerName: worker.nom_affiche,
      matricule: worker.matricule,
      date: dateStr,
      events: workerEvents,
      corrections: workerCorrections,
      summary: workerSummary,
    });
  };

  return (
    <AdminLayout title="Exports">
      <div className="space-y-6">
        {/* Date Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Période d'export
            </CardTitle>
            <CardDescription>
              Sélectionnez la période pour les exports de données
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePreset('today')}>
                Aujourd'hui
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePreset('week')}>
                7 derniers jours
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePreset('month')}>
                Ce mois
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePreset('last-month')}>
                Mois dernier
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd MMM yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">→</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, 'dd MMM yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Résumé de la période
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{stats.totalWorkers}</p>
                    <p className="text-sm text-muted-foreground">Travailleurs</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{stats.totalDays}</p>
                    <p className="text-sm text-muted-foreground">Jours</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <Activity className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{stats.totalEvents}</p>
                    <p className="text-sm text-muted-foreground">Événements</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{stats.totalCorrections}</p>
                    <p className="text-sm text-muted-foreground">Corrections</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {stats.healthyDays} jours sains
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    {stats.correctedDays} jours corrigés
                  </Badge>
                  <Badge 
                    variant={hasIncoherent ? 'destructive' : 'outline'} 
                    className="gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    {stats.incoherentDays} jours incohérents
                  </Badge>
                </div>

                {hasIncoherent && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      <strong>Attention:</strong> {stats.incoherentDays} jour(s) non corrigé(s). 
                      Les exports marqueront ces entrées comme "INCOMPLET".
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Export Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Payroll CSV */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Export Paie (CSV)
              </CardTitle>
              <CardDescription>
                Données de paie formatées pour import comptable
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>Colonnes: matricule, nom, catégorie, date, heures, pauses, taux, montant, statut</p>
              </div>
              <Button 
                onClick={handlePayrollExport}
                disabled={isLoading || !exportData || payrollExport.isPending}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger CSV Paie
              </Button>
            </CardContent>
          </Card>

          {/* Audit JSON */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-blue-600" />
                Export Audit (JSON)
              </CardTitle>
              <CardDescription>
                Données complètes pour audit et traçabilité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>Contient: RAW events + corrections + summaries FINAL</p>
              </div>
              <Button 
                onClick={handleAuditExport}
                disabled={isLoading || !exportData || auditExport.isPending}
                className="w-full gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Télécharger JSON Audit
              </Button>
            </CardContent>
          </Card>

          {/* Sync NDJSON */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Export Sync (NDJSON)
              </CardTitle>
              <CardDescription>
                Format append-only compatible MCP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>Chaque ligne: {`{ kind, id, created_at, payload, checksum }`}</p>
              </div>
              <Button 
                onClick={handleSyncExport}
                disabled={isLoading || !exportData || syncExport.isPending}
                className="w-full gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Télécharger NDJSON Sync
              </Button>
            </CardContent>
          </Card>

          {/* Dispute HTML */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-orange-600" />
                Export Litige (HTML)
              </CardTitle>
              <CardDescription>
                Rapport imprimable pour un travailleur et une date
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3">
                <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un travailleur" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers?.filter(w => w.actif).map(worker => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.nom_affiche} ({worker.matricule})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'dd MMM yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button 
                onClick={handleDisputeExport}
                disabled={!selectedWorker || disputeExport.isPending}
                className="w-full gap-2"
                variant="outline"
              >
                <Gavel className="h-4 w-4" />
                Générer rapport litige
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
