// ============================================
// Phase 7: HR Validation Screen
// IKOMA POSTE Doctrine - DRAFT → VALIDATED workflow
// ============================================

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  RefreshCw,
  Eye,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingValidations, useValidationStats, useBatchValidate } from '@/hooks/useValidation';
import { useCategories } from '@/hooks/useCategories';
import { ValidationDetailModal } from '@/components/admin/ValidationDetailModal';
import { DAY_STATUS_LABELS, DAY_STATUS_COLORS, ANOMALY_CODE_LABELS } from '@/types/business-rules';

export default function AdminValidation() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailModalSummary, setDetailModalSummary] = useState<any | null>(null);

  const { data: pendingData, isLoading, refetch } = usePendingValidations(startDate, endDate);
  const { data: stats } = useValidationStats(startDate, endDate);
  const { data: categories } = useCategories();
  const batchValidate = useBatchValidate();

  // Apply filters
  const filteredData = useMemo(() => {
    if (!pendingData) return [];
    
    return pendingData.filter(summary => {
      // Category filter
      if (categoryFilter !== 'all') {
        const categoryId = summary.workers?.categories?.id;
        if (categoryId !== categoryFilter) return false;
      }
      
      // Anomaly filter
      if (anomalyFilter === 'anomalies_only') {
        if (summary.day_status !== 'ANOMALIE') return false;
      } else if (anomalyFilter === 'no_anomalies') {
        if (summary.day_status === 'ANOMALIE') return false;
      }
      
      return true;
    });
  }, [pendingData, categoryFilter, anomalyFilter]);

  // Handle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(s => s.id)));
    }
  };

  // Handle batch validation
  const handleBatchValidate = async () => {
    if (!user?.id || selectedIds.size === 0) return;
    
    await batchValidate.mutateAsync({
      summaryIds: Array.from(selectedIds),
    });
    
    setSelectedIds(new Set());
  };

  // Handle validate all filtered
  const handleValidateAllFiltered = async () => {
    if (!user?.id || filteredData.length === 0) return;
    
    await batchValidate.mutateAsync({
      summaryIds: filteredData.map(s => s.id),
    });
    
    setSelectedIds(new Set());
  };

  // Format work minutes (0 for ANOMALIE/ABSENT per doctrine)
  const formatWorkMinutes = (summary: any) => {
    if (summary.day_status === 'ANOMALIE' || summary.day_status === 'ABSENT') {
      return '0 min';
    }
    const hours = Math.floor(summary.total_work_minutes / 60);
    const mins = summary.total_work_minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  };

  return (
    <AdminLayout title="Validation RH">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {stats?.draft || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Validés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.validated || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats?.byDayStatus?.ANOMALIE || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Retards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {stats?.byDayStatus?.RETARD || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtres
                </CardTitle>
                <CardDescription>
                  Sélectionnez la période et les critères de filtrage
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {/* Date range pickers */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Du</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-sm text-muted-foreground">au</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Category filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Anomaly filter */}
              <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Anomalies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="anomalies_only">Anomalies uniquement</SelectItem>
                  <SelectItem value="no_anomalies">Sans anomalies</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Batch Actions */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium">
                {selectedIds.size > 0 
                  ? `${selectedIds.size} résumé(s) sélectionné(s)`
                  : `${filteredData.length} résumé(s) dans le filtre`
                }
              </span>
              <div className="flex gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleBatchValidate}
                    disabled={batchValidate.isPending}
                    className="gap-2"
                    variant="secondary"
                  >
                    {batchValidate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    Valider la sélection
                  </Button>
                )}
                <Button
                  onClick={handleValidateAllFiltered}
                  disabled={batchValidate.isPending || filteredData.length === 0}
                  className="gap-2"
                >
                  {batchValidate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  Valider tout le filtre ({filteredData.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Résumés en attente de validation</CardTitle>
            <CardDescription>
              {filteredData.length} résumé(s) DRAFT à valider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Aucun résumé en attente de validation</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Salarié</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Anomalie</TableHead>
                      <TableHead className="text-right">Temps travail</TableHead>
                      <TableHead className="text-right">Retard</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((summary) => (
                      <TableRow 
                        key={summary.id}
                        className={cn(
                          summary.day_status === 'ANOMALIE' && 'bg-destructive/5'
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(summary.id)}
                            onCheckedChange={() => toggleSelection(summary.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(summary.work_date), 'dd/MM/yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{summary.workers?.nom_affiche || '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {summary.workers?.matricule}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {summary.workers?.categories?.nom || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              'text-xs',
                              summary.day_status && DAY_STATUS_COLORS[summary.day_status as keyof typeof DAY_STATUS_COLORS]
                            )}
                          >
                            {summary.day_status 
                              ? DAY_STATUS_LABELS[summary.day_status as keyof typeof DAY_STATUS_LABELS]
                              : '—'
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {summary.anomaly_code ? (
                            <Badge variant="destructive" className="text-xs">
                              {ANOMALY_CODE_LABELS[summary.anomaly_code as keyof typeof ANOMALY_CODE_LABELS] || summary.anomaly_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatWorkMinutes(summary)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {summary.late_minutes > 0 ? (
                            <span className="text-orange-600">{summary.late_minutes} min</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailModalSummary(summary)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      {detailModalSummary && (
        <ValidationDetailModal
          summary={detailModalSummary}
          onClose={() => setDetailModalSummary(null)}
        />
      )}
    </AdminLayout>
  );
}
