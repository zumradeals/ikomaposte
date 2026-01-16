// ============================================
// IKOMA POSTE - Admin Audit Dashboard
// ============================================
//
// Full audit trail viewer with:
// - Calculation traces
// - Policy changes
// - Data integrity verification
//

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  History,
  FileText,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Filter,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Play,
  Eye,
  Clock,
  User,
  Database,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import {
  useAuditPeriodSummary,
  useAuditRecords,
  usePolicyChanges,
  useReplayCalculation,
  useVerifyEventIntegrity,
} from '@/hooks/useAuditTrail';
import { useWorkers } from '@/hooks/useWorkers';
import { usePolicies } from '@/hooks/usePolicies';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalculationAuditRecord, PolicyAuditEntry } from '@/types/audit-trail';

// ============================================
// STATUS BADGE HELPER
// ============================================

function getStatusBadge(status: string) {
  switch (status) {
    case 'PRESENT':
    case 'OK':
      return (
        <Badge variant="outline" className="bg-success/20 text-success border-success/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    case 'RETARD':
    case 'LATE':
      return (
        <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 gap-1">
          <Clock className="h-3 w-3" />
          {status}
        </Badge>
      );
    case 'ABSENT':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    case 'ANOMALIE':
    case 'INCOMPLETE_PUNCH':
      return (
        <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {status}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">{status}</Badge>
      );
  }
}

function getPolicyActionBadge(action: string) {
  switch (action) {
    case 'created':
      return <Badge className="bg-success text-success-foreground">Créé</Badge>;
    case 'activated':
      return <Badge className="bg-primary text-primary-foreground">Activé</Badge>;
    case 'deactivated':
    case 'archived':
      return <Badge variant="secondary">Archivé</Badge>;
    case 'version_bumped':
      return <Badge variant="outline" className="border-warning text-warning">Nouvelle version</Badge>;
    case 'updated':
      return <Badge variant="outline">Modifié</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminAudit() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();

  // Date range state
  const [dateFrom, setDateFrom] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('calculations');

  // Detail modals
  const [selectedTrace, setSelectedTrace] = useState<CalculationAuditRecord | null>(null);
  const [selectedPolicyChange, setSelectedPolicyChange] = useState<PolicyAuditEntry | null>(null);
  const [showTraceDetail, setShowTraceDetail] = useState(false);
  const [showPolicyDetail, setShowPolicyDetail] = useState(false);

  // Data queries
  const { data: workers } = useWorkers();
  const { data: policies } = usePolicies();
  
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useAuditPeriodSummary(
    dateFrom,
    dateTo,
    selectedWorkerId !== 'all' ? selectedWorkerId : undefined
  );

  const { data: auditRecords, isLoading: recordsLoading, refetch: refetchRecords } = useAuditRecords({
    worker_id: selectedWorkerId !== 'all' ? selectedWorkerId : undefined,
    production_date_from: dateFrom,
    production_date_to: dateTo,
    limit: 100,
  });

  const { data: policyChanges, isLoading: policyChangesLoading, refetch: refetchPolicyChanges } = usePolicyChanges(
    dateFrom + 'T00:00:00Z',
    dateTo + 'T23:59:59Z'
  );

  // Mutations
  const replayMutation = useReplayCalculation();
  const verifyIntegrityMutation = useVerifyEventIntegrity();

  useEffect(() => {
    if (!isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  if (!isUnlocked) return null;

  const handleRefresh = () => {
    refetchSummary();
    refetchRecords();
    refetchPolicyChanges();
  };

  const handleReplay = (record: CalculationAuditRecord) => {
    replayMutation.mutate({
      worker_id: record.worker_id,
      production_date: record.production_date,
    });
  };

  const handleVerifyIntegrity = (record: CalculationAuditRecord) => {
    verifyIntegrityMutation.mutate({
      workerId: record.worker_id,
      productionDate: record.production_date,
    });
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers?.find(w => w.id === workerId);
    return worker?.nom_affiche || workerId.slice(0, 8);
  };

  const getPolicyName = (policyId: string) => {
    const policy = policies?.find(p => p.id === policyId);
    return policy?.name || policyId.slice(0, 8);
  };

  return (
    <AdminLayout title="Audit & Traçabilité">
      <div className="space-y-6">
        {/* Info card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Journal d'audit
            </CardTitle>
            <CardDescription>
              Traçabilité complète des calculs et modifications de politiques. 
              Aucune donnée brute n'est jamais modifiée ou supprimée.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{summary.total_calculations}</div>
                <p className="text-xs text-muted-foreground">Calculs totaux</p>
              </CardContent>
            </Card>
            <Card className="border-success/30">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{summary.by_status?.PRESENT || 0}</div>
                <p className="text-xs text-muted-foreground">Présents</p>
              </CardContent>
            </Card>
            <Card className="border-warning/30">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-warning">{summary.by_status?.RETARD || 0}</div>
                <p className="text-xs text-muted-foreground">Retards</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{summary.anomalies_count}</div>
                <p className="text-xs text-muted-foreground">Anomalies</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{summary.unique_workers}</div>
                <p className="text-xs text-muted-foreground">Travailleurs</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-auto"
            />
            <span className="text-muted-foreground">à</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-auto"
            />
          </div>

          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tous les travailleurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les travailleurs</SelectItem>
                {workers?.map(worker => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.nom_affiche}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleRefresh} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Quick date navigation */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Raccourcis :</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom(format(new Date(), 'yyyy-MM-dd'));
              setDateTo(format(new Date(), 'yyyy-MM-dd'));
            }}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
              setDateTo(format(new Date(), 'yyyy-MM-dd'));
            }}
          >
            7 derniers jours
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
              setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}
          >
            Ce mois
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculations" className="gap-2">
              <Database className="h-4 w-4" />
              Traces de calcul
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <FileText className="h-4 w-4" />
              Changements de politiques
            </TabsTrigger>
            <TabsTrigger value="integrity" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Vérification d'intégrité
            </TabsTrigger>
          </TabsList>

          {/* Calculation Traces Tab */}
          <TabsContent value="calculations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traces de calcul</CardTitle>
                <CardDescription>
                  Historique complet de tous les calculs avec contexte de politique et entrées/sorties
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : !auditRecords?.length ? (
                  <div className="text-center p-12 text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucune trace trouvée</p>
                    <p className="text-sm mt-1">Aucun calcul enregistré pour cette période</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Travailleur</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Politique</TableHead>
                          <TableHead>Durée travaillée</TableHead>
                          <TableHead>Retard</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {format(parseISO(record.production_date), 'dd/MM/yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {getWorkerName(record.worker_id)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.calculation_outputs.day_status)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {record.policy_code || 'N/A'}
                                {record.policy_version_number && ` v${record.policy_version_number}`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {record.calculation_outputs.rounded_worked_minutes} min
                            </TableCell>
                            <TableCell>
                              {record.calculation_outputs.late_minutes > 0 ? (
                                <span className="text-warning">
                                  {record.calculation_outputs.late_minutes} min
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedTrace(record);
                                    setShowTraceDetail(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReplay(record)}
                                  disabled={replayMutation.isPending}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policy Changes Tab */}
          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Changements de politiques</CardTitle>
                <CardDescription>
                  Historique de toutes les modifications de politiques avec justifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {policyChangesLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : !policyChanges?.length ? (
                  <div className="text-center p-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun changement</p>
                    <p className="text-sm mt-1">Aucune modification de politique pour cette période</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Politique</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Justification</TableHead>
                          <TableHead className="text-right">Détails</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policyChanges.map((change) => (
                          <TableRow key={change.id}>
                            <TableCell>
                              {format(parseISO(change.changed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {getPolicyName(change.policy_id)}
                            </TableCell>
                            <TableCell>
                              {getPolicyActionBadge(change.action)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">v{change.version_at_change}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {change.justification || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPolicyChange(change);
                                  setShowPolicyDetail(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
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
          </TabsContent>

          {/* Integrity Tab */}
          <TabsContent value="integrity">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vérification d'intégrité</CardTitle>
                <CardDescription>
                  Vérifiez que les données brutes n'ont pas été altérées depuis leur enregistrement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Règles d'immutabilité
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Les pointages bruts (work_events) ne sont jamais modifiés ou supprimés
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Les traces de calcul (calculation_traces) sont immutables
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Le journal d'audit des politiques (policy_audit_trail) est en lecture seule
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Les événements de correction (correction_events) sont tracés et immutables
                      </li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-6">
                    <h3 className="font-semibold mb-4">Vérification individuelle</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sélectionnez une trace de calcul dans l'onglet "Traces de calcul" 
                      et cliquez sur le bouton de rejeu pour vérifier l'intégrité.
                    </p>
                    {verifyIntegrityMutation.data && (
                      <div className={`p-4 rounded-lg ${
                        verifyIntegrityMutation.data.valid 
                          ? 'bg-success/20 border border-success/30'
                          : 'bg-destructive/20 border border-destructive/30'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {verifyIntegrityMutation.data.valid ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-success" />
                              <span className="font-medium text-success">Intégrité vérifiée</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              <span className="font-medium text-destructive">Problèmes détectés</span>
                            </>
                          )}
                        </div>
                        {verifyIntegrityMutation.data.issues.length > 0 && (
                          <ul className="text-sm space-y-1">
                            {verifyIntegrityMutation.data.issues.map((issue, idx) => (
                              <li key={idx} className="text-destructive">{issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Trace Detail Modal */}
      <Dialog open={showTraceDetail} onOpenChange={setShowTraceDetail}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Détail de la trace de calcul</DialogTitle>
            <DialogDescription>
              Contexte complet du calcul pour rejouer exactement les mêmes règles
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {selectedTrace && (
              <div className="space-y-6 pr-4">
                {/* Header info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Travailleur</p>
                    <p className="font-medium">{getWorkerName(selectedTrace.worker_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de production</p>
                    <p className="font-medium">
                      {format(parseISO(selectedTrace.production_date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Politique appliquée</p>
                    <p className="font-medium">
                      {selectedTrace.policy_code || 'N/A'} 
                      {selectedTrace.policy_version_number && ` (v${selectedTrace.policy_version_number})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Calculé le</p>
                    <p className="font-medium">
                      {format(parseISO(selectedTrace.calculated_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Rotation info */}
                {selectedTrace.rotation_config_id && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Contexte de rotation</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Équipe:</span>{' '}
                        {selectedTrace.team_code}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Poste:</span>{' '}
                        {selectedTrace.shift_code}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bloc:</span>{' '}
                        {selectedTrace.rotation_block_number}
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw punches */}
                <div>
                  <h4 className="font-semibold mb-2">Pointages bruts</h4>
                  <div className="space-y-2">
                    {selectedTrace.raw_punches.map((punch, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{punch.event_type}</Badge>
                          <span>
                            {format(parseISO(punch.occurred_at), 'HH:mm:ss', { locale: fr })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{punch.device_id.slice(0, 8)}...</span>
                          <Badge variant={punch.trust_status === 'trusted' ? 'default' : 'secondary'}>
                            {punch.trust_status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation context */}
                <div>
                  <h4 className="font-semibold mb-2">Contexte de calcul</h4>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Début attendu:</span>{' '}
                        {selectedTrace.calculation_context.expected_start_time || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fin attendue:</span>{' '}
                        {selectedTrace.calculation_context.expected_end_time || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tolérance retard:</span>{' '}
                        {selectedTrace.calculation_context.late_grace_minutes} min
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tolérance départ anticipé:</span>{' '}
                        {selectedTrace.calculation_context.early_leave_grace_minutes} min
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mode d'arrondi:</span>{' '}
                        {selectedTrace.calculation_context.rounding_mode}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pas d'arrondi:</span>{' '}
                        {selectedTrace.calculation_context.rounding_step_minutes} min
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outputs */}
                <div>
                  <h4 className="font-semibold mb-2">Résultats du calcul</h4>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Statut:</span>{' '}
                        {getStatusBadge(selectedTrace.calculation_outputs.day_status)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Raison:</span>{' '}
                        {selectedTrace.calculation_outputs.status_reason}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Entrée observée:</span>{' '}
                        {selectedTrace.calculation_outputs.observed_in 
                          ? format(parseISO(selectedTrace.calculation_outputs.observed_in), 'HH:mm:ss')
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sortie observée:</span>{' '}
                        {selectedTrace.calculation_outputs.observed_out 
                          ? format(parseISO(selectedTrace.calculation_outputs.observed_out), 'HH:mm:ss')
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Durée brute:</span>{' '}
                        {selectedTrace.calculation_outputs.raw_worked_minutes} min
                      </div>
                      <div>
                        <span className="text-muted-foreground">Durée arrondie:</span>{' '}
                        {selectedTrace.calculation_outputs.rounded_worked_minutes} min
                      </div>
                      <div>
                        <span className="text-muted-foreground">Retard:</span>{' '}
                        <span className={selectedTrace.calculation_outputs.late_minutes > 0 ? 'text-warning' : ''}>
                          {selectedTrace.calculation_outputs.late_minutes} min
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Départ anticipé:</span>{' '}
                        <span className={selectedTrace.calculation_outputs.early_leave_minutes > 0 ? 'text-warning' : ''}>
                          {selectedTrace.calculation_outputs.early_leave_minutes} min
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Heures sup:</span>{' '}
                        <span className={selectedTrace.calculation_outputs.overtime_minutes > 0 ? 'text-success' : ''}>
                          {selectedTrace.calculation_outputs.overtime_minutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision path */}
                <div>
                  <h4 className="font-semibold mb-2">Chemin de décision</h4>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">
                    {selectedTrace.decision_path}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleReplay(selectedTrace)}
                    disabled={replayMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Rejouer le calcul
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleVerifyIntegrity(selectedTrace)}
                    disabled={verifyIntegrityMutation.isPending}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Vérifier l'intégrité
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Policy Change Detail Modal */}
      <Dialog open={showPolicyDetail} onOpenChange={setShowPolicyDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Détail du changement de politique</DialogTitle>
            <DialogDescription>
              États avant/après et justification du changement
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh]">
            {selectedPolicyChange && (
              <div className="space-y-6 pr-4">
                {/* Header */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Politique</p>
                    <p className="font-medium">{getPolicyName(selectedPolicyChange.policy_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Action</p>
                    {getPolicyActionBadge(selectedPolicyChange.action)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Version</p>
                    <p className="font-medium">v{selectedPolicyChange.version_at_change}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(parseISO(selectedPolicyChange.changed_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Justification */}
                {selectedPolicyChange.justification && (
                  <div>
                    <h4 className="font-semibold mb-2">Justification</h4>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                      {selectedPolicyChange.justification}
                    </div>
                  </div>
                )}

                {/* Previous state */}
                {selectedPolicyChange.previous_state && (
                  <div>
                    <h4 className="font-semibold mb-2">État précédent</h4>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono overflow-auto">
                      <pre>{JSON.stringify(selectedPolicyChange.previous_state, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* New state */}
                {selectedPolicyChange.new_state && (
                  <div>
                    <h4 className="font-semibold mb-2">Nouvel état</h4>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono overflow-auto">
                      <pre>{JSON.stringify(selectedPolicyChange.new_state, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
