// ============================================
// PDF Generator Card Component
// ============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Users, Loader2 } from 'lucide-react';
import { useWorkers } from '@/hooks/useWorkers';
import { useCategories } from '@/hooks/useCategories';
import { useGeneratePDF } from '@/hooks/useDocuments';

interface PDFGeneratorCardProps {
  periodMonth: string;
  periodLabel: string;
  hasValidatedData: boolean;
}

export function PDFGeneratorCard({
  periodMonth,
  periodLabel,
  hasValidatedData,
}: PDFGeneratorCardProps) {
  const [rapWorkerId, setRapWorkerId] = useState<string>('');
  const [ptgCategoryId, setPtgCategoryId] = useState<string>('');

  const { data: workers } = useWorkers();
  const { data: categories } = useCategories();
  const generatePDF = useGeneratePDF();

  const handleGenerateRAP = () => {
    if (!rapWorkerId) return;
    generatePDF.mutate({
      type: 'RAP',
      periodMonth,
      workerId: rapWorkerId,
    });
  };

  const handleGeneratePTG = () => {
    generatePDF.mutate({
      type: 'PTG',
      periodMonth,
      categoryId: ptgCategoryId || undefined,
    });
  };

  const activeWorkers = workers?.filter(w => w.actif) || [];
  const activeCategories = categories?.filter(c => c.actif) || [];

  return (
    <Card className="border-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Rapports PDF
        </CardTitle>
        <CardDescription>
          Générer des rapports PDF opposables pour {periodLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasValidatedData && (
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
            Aucune donnée validée pour cette période. Validez d'abord les résumés.
          </div>
        )}

        {/* IKP-RAP: Individual Report */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">Rapport Individuel (IKP-RAP)</span>
            <Badge variant="outline" className="text-xs">1 salarié</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Détail journalier pour un salarié sur la période sélectionnée
          </p>
          <div className="flex gap-2">
            <Select value={rapWorkerId} onValueChange={setRapWorkerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choisir un salarié..." />
              </SelectTrigger>
              <SelectContent>
                {activeWorkers.map(worker => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.nom_affiche} ({worker.matricule})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerateRAP}
              disabled={!rapWorkerId || !hasValidatedData || generatePDF.isPending}
              className="gap-2"
            >
              {generatePDF.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Générer PDF
            </Button>
          </div>
        </div>

        {/* IKP-PTG: Global Attendance */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">Pointage Global (IKP-PTG)</span>
            <Badge variant="outline" className="text-xs">Tous salariés</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Récapitulatif mensuel de tous les salariés (avec filtre catégorie optionnel)
          </p>
          <div className="flex gap-2">
            <Select value={ptgCategoryId} onValueChange={(val) => setPtgCategoryId(val === '__all__' ? '' : val)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Toutes catégories (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes catégories</SelectItem>
                {activeCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGeneratePTG}
              disabled={!hasValidatedData || generatePDF.isPending}
              className="gap-2"
            >
              {generatePDF.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Générer PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
