import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Users, User, Tag, Globe } from 'lucide-react';
import { PolicyScope, PolicyScopeType, SCOPE_TYPE_LABELS, SCOPE_TYPE_PRIORITY } from '@/types/policies';
import { useCategories } from '@/hooks/useCategories';
import { useWorkers } from '@/hooks/useWorkers';
import { useAddPolicyScope, useRemovePolicyScope, usePolicyScopes } from '@/hooks/usePolicies';

interface PolicyScopeManagerProps {
  policyId: string;
  disabled?: boolean;
}

const SCOPE_ICONS: Record<PolicyScopeType, typeof User> = {
  individual: User,
  team: Users,
  category: Tag,
  default: Globe,
};

export function PolicyScopeManager({ policyId, disabled }: PolicyScopeManagerProps) {
  const [newScopeType, setNewScopeType] = useState<PolicyScopeType | null>(null);
  const [newTargetId, setNewTargetId] = useState<string>('');
  const [newPriority, setNewPriority] = useState<number>(0);
  
  const { data: scopes = [], isLoading } = usePolicyScopes(policyId);
  const { data: categories = [] } = useCategories();
  const { data: workers = [] } = useWorkers();
  const addScope = useAddPolicyScope();
  const removeScope = useRemovePolicyScope();

  const handleAddScope = async () => {
    if (!newScopeType) return;
    
    await addScope.mutateAsync({
      policy_id: policyId,
      scope_type: newScopeType,
      target_id: newScopeType === 'default' ? null : newTargetId || null,
      priority: newPriority || SCOPE_TYPE_PRIORITY[newScopeType],
    });
    
    setNewScopeType(null);
    setNewTargetId('');
    setNewPriority(0);
  };

  const handleRemoveScope = async (scopeId: string) => {
    await removeScope.mutateAsync({ scopeId, policyId });
  };

  const getTargetLabel = (scope: PolicyScope): string => {
    if (scope.scope_type === 'default') return 'Tous les travailleurs';
    if (!scope.target_id) return 'Non défini';
    
    if (scope.scope_type === 'category') {
      const category = categories.find(c => c.id === scope.target_id);
      return category?.nom || scope.target_id;
    }
    
    if (scope.scope_type === 'individual') {
      const worker = workers.find(w => w.id === scope.target_id);
      return worker?.nom_affiche || scope.target_id;
    }
    
    return scope.target_id;
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Existing scopes */}
      {scopes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              Aucun scope défini. Ajoutez un scope pour définir à qui cette politique s'applique.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {scopes.map((scope) => {
            const Icon = SCOPE_ICONS[scope.scope_type];
            return (
              <Card key={scope.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {SCOPE_TYPE_LABELS[scope.scope_type]}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Priorité: {scope.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getTargetLabel(scope)}
                      </p>
                    </div>
                  </div>
                  
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveScope(scope.id)}
                      disabled={removeScope.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Add new scope */}
      {!disabled && (
        <Card className="border-primary/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type de scope</Label>
                <Select 
                  value={newScopeType || ''} 
                  onValueChange={(v) => {
                    setNewScopeType(v as PolicyScopeType);
                    setNewPriority(SCOPE_TYPE_PRIORITY[v as PolicyScopeType]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      <span className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Par défaut (tous)
                      </span>
                    </SelectItem>
                    <SelectItem value="category">
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Catégorie
                      </span>
                    </SelectItem>
                    <SelectItem value="team">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Équipe
                      </span>
                    </SelectItem>
                    <SelectItem value="individual">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Individuel
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Priorité</Label>
                <Input
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
            
            {/* Target selection based on scope type */}
            {newScopeType === 'category' && (
              <div>
                <Label className="text-xs">Catégorie</Label>
                <Select value={newTargetId} onValueChange={setNewTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {newScopeType === 'individual' && (
              <div>
                <Label className="text-xs">Travailleur</Label>
                <Select value={newTargetId} onValueChange={setNewTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un travailleur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map(worker => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.nom_affiche} ({worker.matricule})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {newScopeType === 'team' && (
              <div>
                <Label className="text-xs">ID Équipe</Label>
                <Input
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  placeholder="Identifiant de l'équipe"
                />
              </div>
            )}
            
            <Button
              onClick={handleAddScope}
              disabled={!newScopeType || addScope.isPending || (newScopeType !== 'default' && !newTargetId)}
              className="w-full"
            >
              {addScope.isPending ? 'Ajout...' : 'Ajouter le scope'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
