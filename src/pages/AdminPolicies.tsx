import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Archive,
  Clock,
  Calendar,
  Users,
  Shield,
  FileText
} from 'lucide-react';
import { 
  usePolicies, 
  useCreatePolicy, 
  useUpdatePolicy, 
  useActivatePolicy,
  useArchivePolicy,
  useDeletePolicy 
} from '@/hooks/usePolicies';
import { PolicyForm } from '@/components/admin/PolicyForm';
import { 
  TimePolicy, 
  PolicyStatus, 
  POLICY_STATUS_LABELS,
  WeekPattern,
  TolerancesConfig,
  RoundingRulesConfig,
  OvertimeRulesConfig 
} from '@/types/policies';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_COLORS: Record<PolicyStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-green-500/10 text-green-600 border-green-500/30',
  SUPERSEDED: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
};

export default function AdminPolicies() {
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<TimePolicy | null>(null);
  const [activatingPolicy, setActivatingPolicy] = useState<TimePolicy | null>(null);
  const [activationJustification, setActivationJustification] = useState('');
  const [deletingPolicy, setDeletingPolicy] = useState<TimePolicy | null>(null);
  
  const { data: policies = [], isLoading } = usePolicies(
    statusFilter === 'ALL' ? undefined : statusFilter
  );
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const activatePolicy = useActivatePolicy();
  const archivePolicy = useArchivePolicy();
  const deletePolicy = useDeletePolicy();

  const handleCreate = async (data: {
    code: string;
    name: string;
    description?: string | null;
    timezone: string;
    valid_from: string;
    valid_to?: string | null;
    week_pattern: WeekPattern;
    tolerances: TolerancesConfig;
    rounding_rules: RoundingRulesConfig;
    overtime_rules: OvertimeRulesConfig;
    immutable_when_active: boolean;
  }) => {
    await createPolicy.mutateAsync(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: {
    code: string;
    name: string;
    description?: string | null;
    timezone: string;
    valid_from: string;
    valid_to?: string | null;
    week_pattern: WeekPattern;
    tolerances: TolerancesConfig;
    rounding_rules: RoundingRulesConfig;
    overtime_rules: OvertimeRulesConfig;
    immutable_when_active: boolean;
    justification?: string;
  }) => {
    if (!editingPolicy) return;
    await updatePolicy.mutateAsync({ id: editingPolicy.id, updates: data });
    setEditingPolicy(null);
  };

  const handleActivate = async () => {
    if (!activatingPolicy) return;
    await activatePolicy.mutateAsync({ 
      id: activatingPolicy.id, 
      justification: activationJustification 
    });
    setActivatingPolicy(null);
    setActivationJustification('');
  };

  const handleArchive = async (policy: TimePolicy) => {
    await archivePolicy.mutateAsync(policy.id);
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    await deletePolicy.mutateAsync(deletingPolicy.id);
    setDeletingPolicy(null);
  };

  const countWorkingDays = (pattern: WeekPattern): number => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    return days.filter(day => pattern[day]?.working_day).length;
  };

  return (
    <AdminLayout title="Politiques de temps">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Politiques de temps de travail</h2>
              <p className="text-muted-foreground">
                Gérez les règles d'horaires, tolérances et heures supplémentaires
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle politique
          </Button>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as PolicyStatus | 'ALL')}>
          <TabsList>
            <TabsTrigger value="ALL">Toutes</TabsTrigger>
            <TabsTrigger value="DRAFT">Brouillons</TabsTrigger>
            <TabsTrigger value="ACTIVE">Actives</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archivées</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement...
          </div>
        ) : policies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium mb-2">Aucune politique</p>
              <p className="text-muted-foreground mb-4">
                Créez votre première politique de temps de travail
              </p>
              <Button onClick={() => setShowForm(true)}>
                Créer une politique
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <Card key={policy.id} className="relative overflow-hidden">
                {/* Status indicator */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  policy.status === 'ACTIVE' ? 'bg-green-500' :
                  policy.status === 'DRAFT' ? 'bg-blue-500' :
                  'bg-gray-300'
                }`} />
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className={STATUS_COLORS[policy.status]} variant="outline">
                        {POLICY_STATUS_LABELS[policy.status]}
                      </Badge>
                      <CardTitle className="text-lg mt-2">{policy.name}</CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">
                        {policy.code} • v{policy.version}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {policy.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {policy.description}
                    </p>
                  )}
                  
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted rounded">
                      <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-medium">
                        {countWorkingDays(policy.week_pattern)} jours
                      </p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-medium">
                        {policy.tolerances.late_grace_minutes}min
                      </p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <Shield className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs font-medium">
                        {policy.overtime_rules.threshold_hours}h
                      </p>
                    </div>
                  </div>
                  
                  {/* Validity */}
                  <div className="text-xs text-muted-foreground">
                    Valide: {policy.valid_from ? format(new Date(policy.valid_from), 'dd MMM yyyy', { locale: fr }) : '-'}
                    {policy.valid_to && ` → ${format(new Date(policy.valid_to), 'dd MMM yyyy', { locale: fr })}`}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPolicy(policy)}
                      className="flex-1 gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Éditer
                    </Button>
                    
                    {policy.status === 'DRAFT' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setActivatingPolicy(policy)}
                          className="gap-1"
                        >
                          <Play className="h-3 w-3" />
                          Activer
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingPolicy(policy)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {policy.status === 'ACTIVE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(policy)}
                        disabled={archivePolicy.isPending}
                        className="gap-1"
                      >
                        <Archive className="h-3 w-3" />
                        Archiver
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle politique de temps</DialogTitle>
          </DialogHeader>
          <PolicyForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createPolicy.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPolicy} onOpenChange={(open) => !open && setEditingPolicy(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifier la politique: {editingPolicy?.name}
              {editingPolicy?.status === 'ACTIVE' && (
                <Badge variant="outline" className="ml-2 text-yellow-600">
                  Version incrémentale
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <PolicyForm
            policy={editingPolicy}
            onSubmit={handleUpdate}
            onCancel={() => setEditingPolicy(null)}
            isLoading={updatePolicy.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Activation Dialog */}
      <AlertDialog open={!!activatingPolicy} onOpenChange={(open) => !open && setActivatingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activer la politique</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous activer la politique "{activatingPolicy?.name}"?
              <br />
              Cela la rendra effective immédiatement et désactivera les politiques conflictuelles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="justification">Justification (optionnelle)</Label>
            <Textarea
              id="justification"
              value={activationJustification}
              onChange={(e) => setActivationJustification(e.target.value)}
              placeholder="Raison de l'activation..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={activatePolicy.isPending}>
              {activatePolicy.isPending ? 'Activation...' : 'Activer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPolicy} onOpenChange={(open) => !open && setDeletingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la politique</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{deletingPolicy?.name}"?
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deletePolicy.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePolicy.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
