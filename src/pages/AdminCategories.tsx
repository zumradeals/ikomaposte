import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { useCategories, useCreateCategory, useUpdateCategory, Category } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Tags } from 'lucide-react';

export default function AdminCategories() {
  const { isUnlocked } = useAdmin();
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useCategories(showInactive);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = (data: any) => {
    createCategory.mutate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleUpdate = (data: any) => {
    if (editingCategory) {
      updateCategory.mutate(
        { id: editingCategory.id, updates: data },
        { onSuccess: () => setEditingCategory(null) }
      );
    }
  };

  return (
    <AdminLayout title="Catégories">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Tags className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Catégories de travailleurs</h2>
              <p className="text-muted-foreground">
                Gérez les catégories et leurs taux horaires
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle catégorie
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
          <Switch
            id="showInactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <label htmlFor="showInactive" className="text-sm">
            Afficher les catégories inactives
          </label>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement...
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tags className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium mb-2">Aucune catégorie</p>
              <p className="text-muted-foreground mb-4">
                Créez votre première catégorie pour commencer
              </p>
              <Button onClick={() => setShowForm(true)}>
                Créer une catégorie
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card 
                key={category.id}
                className={!category.actif ? 'opacity-60' : ''}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{category.nom}</CardTitle>
                    <Badge variant={category.actif ? 'default' : 'secondary'}>
                      {category.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {category.taux_horaire.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {category.devise}/heure
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Edit className="h-4 w-4" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
          </DialogHeader>
          <CategoryForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createCategory.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={editingCategory}
            onSubmit={handleUpdate}
            onCancel={() => setEditingCategory(null)}
            isLoading={updateCategory.isPending}
          />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
