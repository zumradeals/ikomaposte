import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { WorkerForm } from '@/components/admin/WorkerForm';
import { WorkerQRModal } from '@/components/admin/WorkerQRModal';
import { useWorkers, useCreateWorker, useUpdateWorker, WorkerWithCategory, uploadWorkerPhoto } from '@/hooks/useWorkers';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, QrCode, Search, Users, User } from 'lucide-react';

export default function AdminWorkers() {
  const { isUnlocked } = useAdmin();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerWithCategory | null>(null);
  const [qrWorker, setQrWorker] = useState<WorkerWithCategory | null>(null);

  const { data: categories = [] } = useCategories(true);
  const { data: workers = [], isLoading } = useWorkers({
    search,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    includeInactive: showInactive,
  });
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();

  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (data: any) => {
    createWorker.mutate(data, {
      onSuccess: (newWorker) => {
        setShowForm(false);
      },
    });
  };

  const handleUpdate = (data: any) => {
    if (editingWorker) {
      updateWorker.mutate(
        { id: editingWorker.id, updates: data },
        { onSuccess: () => setEditingWorker(null) }
      );
    }
  };

  return (
    <AdminLayout title="Travailleurs">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Travailleurs</h2>
              <p className="text-muted-foreground">
                Gérez les travailleurs et leurs QR codes
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau travailleur
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border border-border">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou matricule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3">
            <Switch
              id="showInactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <label htmlFor="showInactive" className="text-sm whitespace-nowrap">
              Afficher inactifs
            </label>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement...
          </div>
        ) : workers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium mb-2">Aucun travailleur</p>
              <p className="text-muted-foreground mb-4">
                {search || categoryFilter !== 'all' 
                  ? 'Aucun résultat pour ces filtres' 
                  : 'Créez votre premier travailleur pour commencer'}
              </p>
              {!search && categoryFilter === 'all' && (
                <Button onClick={() => setShowForm(true)}>
                  Créer un travailleur
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workers.map((worker) => (
              <Card 
                key={worker.id}
                className={!worker.actif ? 'opacity-60' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Photo */}
                    <div className="w-16 h-16 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {worker.photo_url ? (
                        <img 
                          src={worker.photo_url} 
                          alt={worker.nom_affiche} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold truncate">{worker.nom_affiche}</h3>
                        <Badge variant={worker.actif ? 'default' : 'secondary'} className="flex-shrink-0">
                          {worker.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <p className="text-sm font-mono text-muted-foreground">
                        {worker.matricule}
                      </p>
                      {worker.categories && (
                        <p className="text-sm text-primary">
                          {worker.categories.nom}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setQrWorker(worker)}
                    >
                      <QrCode className="h-4 w-4" />
                      QR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setEditingWorker(worker)}
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau travailleur</DialogTitle>
          </DialogHeader>
          <WorkerForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createWorker.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingWorker} onOpenChange={(open) => !open && setEditingWorker(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le travailleur</DialogTitle>
          </DialogHeader>
          <WorkerForm
            worker={editingWorker}
            onSubmit={handleUpdate}
            onCancel={() => setEditingWorker(null)}
            isLoading={updateWorker.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <WorkerQRModal
        worker={qrWorker}
        open={!!qrWorker}
        onOpenChange={(open) => !open && setQrWorker(null)}
      />
    </AdminLayout>
  );
}
