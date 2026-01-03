import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { 
  useSummaries, 
  useBatchCalculateSummaries,
  exportSummariesToCSV 
} from '@/hooks/useWorkSummaries';
import { formatMinutesAsTime, formatAmount } from '@/lib/work-calculator';
import { WorkSummaryWithWorker } from '@/types/work-summaries';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  User, 
  Download, 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Clock, 
  Coffee,
  Banknote,
  AlertTriangle,
  Calculator,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import SummaryDetailModal from '@/components/admin/SummaryDetailModal';

export default function AdminCalculations() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();
  
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  });
  const [selectedSummary, setSelectedSummary] = useState<WorkSummaryWithWorker | null>(null);
  
  const { data: summaries, isLoading, refetch } = useSummaries(dateRange.start, dateRange.end);
  const batchCalculate = useBatchCalculateSummaries();

  if (!isUnlocked) {
    navigate('/');
    return null;
  }

  const handleBatchCalculate = () => {
    batchCalculate.mutate({ date: dateRange.start });
  };

  const handleExport = () => {
    if (!summaries?.length) return;
    const fileName = `calculs-${format(dateRange.start, 'yyyy-MM-dd')}-${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    exportSummariesToCSV(summaries, fileName);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDateRange({
        start: startOfDay(date),
        end: endOfDay(date),
      });
    }
  };

  // Aggregate stats
  const totalMinutes = summaries?.reduce((sum, s) => sum + s.total_work_minutes, 0) || 0;
  const totalAmount = summaries?.reduce((sum, s) => sum + s.total_amount, 0) || 0;
  const autoClosedCount = summaries?.filter(s => s.auto_closed).length || 0;

  return (
    <AdminLayout title="Calculs journaliers">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">Travailleurs</span>
            </div>
            <p className="text-2xl font-bold">{summaries?.length || 0}</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Heures totales</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatMinutesAsTime(totalMinutes)}</p>
          </div>
          <div className="bg-success/10 rounded-xl p-4 border border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <Banknote className="w-4 h-4" />
              <span className="text-sm">Montant total</span>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(totalAmount, 'XOF')}</p>
          </div>
          <div className="bg-warning/10 rounded-xl p-4 border border-warning/20">
            <div className="flex items-center gap-2 text-warning mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Auto-clôturés</span>
            </div>
            <p className="text-2xl font-bold text-warning">{autoClosedCount}</p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Date picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.start, 'EEEE d MMMM yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.start}
                  onSelect={handleDateSelect}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            {/* Quick nav */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateSelect(subDays(dateRange.start, 1))}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateSelect(new Date())}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateSelect(addDays(dateRange.start, 1))}
                disabled={dateRange.start >= startOfDay(new Date())}
              >
                →
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleBatchCalculate}
              disabled={batchCalculate.isPending}
            >
              <Calculator className="w-4 h-4 mr-2" />
              {batchCalculate.isPending ? 'Calcul...' : 'Calculer la journée'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!summaries?.length}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Seuls les événements <span className="font-medium text-primary">VÉRIFIÉS</span> sont pris en compte dans les calculs.
            Les événements non vérifiés sont visibles dans le flux mais exclus des montants.
          </p>
        </div>

        {/* Results table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !summaries?.length ? (
            <div className="text-center p-12 text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun calcul pour cette date</p>
              <p className="text-sm mb-4">Cliquez sur "Calculer la journée" pour générer les résumés</p>
              <Button onClick={handleBatchCalculate} disabled={batchCalculate.isPending}>
                <Calculator className="w-4 h-4 mr-2" />
                Calculer maintenant
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Travailleur</TableHead>
                    <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                    <TableHead className="text-center">Heures</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Pauses</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((summary) => (
                    <TableRow 
                      key={summary.id} 
                      className={summary.auto_closed ? 'bg-warning/5' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                            {summary.workers?.photo_url ? (
                              <img 
                                src={summary.workers.photo_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{summary.workers?.nom_affiche || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">
                              {summary.workers?.matricule}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {summary.workers?.categories?.nom || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-mono font-medium">
                            {formatMinutesAsTime(summary.total_work_minutes)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                          <Coffee className="w-4 h-4" />
                          <span className="font-mono text-sm">
                            {summary.total_pause_minutes}m
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-bold text-success">
                          {formatAmount(summary.total_amount, summary.devise)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {summary.auto_closed ? (
                          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Auto-clôturé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Complet
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSummary(summary)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Totals footer */}
        {summaries && summaries.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {summaries.length} travailleur(s) • Version: {summaries[0]?.calculation_version}
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Heures totales</p>
                  <p className="text-xl font-bold">{formatMinutesAsTime(totalMinutes)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Montant total</p>
                  <p className="text-xl font-bold text-success">{formatAmount(totalAmount, 'XOF')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <SummaryDetailModal 
        summary={selectedSummary} 
        onClose={() => setSelectedSummary(null)} 
      />
    </AdminLayout>
  );
}
