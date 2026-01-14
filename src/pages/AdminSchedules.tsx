import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScheduleForm } from '@/components/admin/ScheduleForm';
import { useCategories } from '@/hooks/useCategories';
import { 
  useCategorySchedules, 
  useUpsertSchedule, 
  useDeactivateSchedule,
  useCopySchedules 
} from '@/hooks/useWorkSchedules';
import { WorkSchedule, DAY_OF_WEEK_LABELS, DAY_OF_WEEK_SHORT } from '@/types/business-rules';
import { Plus, Edit, Clock, Copy, Calendar } from 'lucide-react';

export default function AdminSchedules() {
  const { isUnlocked } = useAdmin();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyTargetCategoryId, setCopyTargetCategoryId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useCategories(true);
  const activeCategories = categories.filter(c => c.actif);
  
  // Select first category by default
  const effectiveCategoryId = selectedCategoryId || activeCategories[0]?.id || null;
  
  const { data: schedules = [], isLoading: schedulesLoading } = useCategorySchedules(
    effectiveCategoryId || ''
  );
  const upsertSchedule = useUpsertSchedule();
  const deactivateSchedule = useDeactivateSchedule();
  const copySchedules = useCopySchedules();

  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  const filteredSchedules = showInactive 
    ? schedules 
    : schedules.filter(s => s.is_active);

  // Group schedules by day
  const schedulesByDay = filteredSchedules.reduce((acc, schedule) => {
    const day = schedule.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(schedule);
    return acc;
  }, {} as Record<number, WorkSchedule[]>);

  const handleSubmit = async (data: any) => {
    await upsertSchedule.mutateAsync(data);
    setShowForm(false);
    setEditingSchedule(null);
  };

  const handleEdit = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleToggleActive = async (schedule: WorkSchedule) => {
    if (schedule.is_active) {
      await deactivateSchedule.mutateAsync(schedule.id);
    } else {
      await upsertSchedule.mutateAsync({
        ...schedule,
        is_active: true,
      });
    }
  };

  const handleCopySchedules = async () => {
    if (!effectiveCategoryId || !copyTargetCategoryId) return;
    await copySchedules.mutateAsync({
      sourceCategoryId: effectiveCategoryId,
      targetCategoryId: copyTargetCategoryId,
    });
    setShowCopyDialog(false);
    setCopyTargetCategoryId(null);
  };

  const weekDays = [1, 2, 3, 4, 5, 6, 0]; // Lundi à Dimanche

  return (
    <AdminLayout title="Horaires Théoriques">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Horaires Théoriques</h1>
              <p className="text-muted-foreground">
                Configurez les horaires de travail par catégorie et jour
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {effectiveCategoryId && filteredSchedules.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setShowCopyDialog(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier vers...
              </Button>
            )}
            <Button onClick={() => setShowForm(true)} disabled={!effectiveCategoryId}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un horaire
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        {categoriesLoading ? (
          <div className="text-muted-foreground">Chargement des catégories...</div>
        ) : activeCategories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Aucune catégorie active. Créez d'abord une catégorie.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs 
            value={effectiveCategoryId || undefined} 
            onValueChange={setSelectedCategoryId}
          >
            <TabsList className="flex-wrap h-auto gap-1 p-1">
              {activeCategories.map((category) => (
                <TabsTrigger 
                  key={category.id} 
                  value={category.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {category.nom}
                </TabsTrigger>
              ))}
            </TabsList>

            {activeCategories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-6">
                {/* Show inactive toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    id="showInactive"
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <label htmlFor="showInactive" className="text-sm">
                    Afficher les horaires inactifs
                  </label>
                </div>

                {schedulesLoading ? (
                  <div className="text-muted-foreground">Chargement...</div>
                ) : filteredSchedules.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Aucun horaire configuré pour cette catégorie
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Configurer les horaires
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {weekDays.map((day) => {
                      const daySchedules = schedulesByDay[day] || [];
                      return (
                        <Card 
                          key={day} 
                          className={daySchedules.length === 0 ? 'opacity-50' : ''}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center justify-between">
                              {DAY_OF_WEEK_LABELS[day]}
                              {daySchedules.length === 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Non travaillé
                                </Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {daySchedules.length === 0 ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  setEditingSchedule(null);
                                  setShowForm(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                {daySchedules.map((schedule) => (
                                  <div 
                                    key={schedule.id}
                                    className={`p-3 rounded-lg border ${
                                      schedule.is_active 
                                        ? 'bg-card' 
                                        : 'bg-muted/50 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span className="font-medium">
                                          {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                        </span>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => handleEdit(schedule)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p>Tolérance retard: {schedule.tolerance_late_minutes} min</p>
                                      <p>Tolérance départ: {schedule.tolerance_early_leave_minutes} min</p>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <span className="text-xs">
                                        {schedule.is_active ? 'Actif' : 'Inactif'}
                                      </span>
                                      <Switch
                                        checked={schedule.is_active}
                                        onCheckedChange={() => handleToggleActive(schedule)}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Schedule Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Modifier l\'horaire' : 'Nouvel horaire'}
              </DialogTitle>
            </DialogHeader>
            {effectiveCategoryId && (
              <ScheduleForm
                schedule={editingSchedule}
                categoryId={effectiveCategoryId}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingSchedule(null);
                }}
                isLoading={upsertSchedule.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Copy Schedules Dialog */}
        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copier les horaires vers une autre catégorie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Les horaires actifs de la catégorie actuelle seront copiés vers la catégorie cible.
                Les horaires existants de la catégorie cible seront désactivés.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catégorie cible</label>
                <Tabs value={copyTargetCategoryId || undefined} onValueChange={setCopyTargetCategoryId}>
                  <TabsList className="flex-wrap h-auto gap-1 p-1">
                    {activeCategories
                      .filter(c => c.id !== effectiveCategoryId)
                      .map((category) => (
                        <TabsTrigger 
                          key={category.id} 
                          value={category.id}
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {category.nom}
                        </TabsTrigger>
                      ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCopyDialog(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCopySchedules}
                  className="flex-1"
                  disabled={!copyTargetCategoryId || copySchedules.isPending}
                >
                  {copySchedules.isPending ? 'Copie...' : 'Copier'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
