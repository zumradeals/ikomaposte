import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Category, CategoryInsert, CategoryUpdate } from '@/hooks/useCategories';

interface CategoryFormProps {
  category?: Category | null;
  onSubmit: (data: CategoryInsert | CategoryUpdate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CategoryForm({ category, onSubmit, onCancel, isLoading }: CategoryFormProps) {
  const [nom, setNom] = useState('');
  const [tauxHoraire, setTauxHoraire] = useState('');
  const [devise, setDevise] = useState('XOF');
  const [actif, setActif] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) {
      setNom(category.nom);
      setTauxHoraire(category.taux_horaire.toString());
      setDevise(category.devise);
      setActif(category.actif);
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const rate = parseFloat(tauxHoraire);
    if (isNaN(rate) || rate <= 0) {
      setError('Le taux horaire doit être supérieur à 0');
      return;
    }

    if (!nom.trim()) {
      setError('Le nom est requis');
      return;
    }

    onSubmit({
      nom: nom.trim(),
      taux_horaire: rate,
      devise,
      actif,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nom">Nom de la catégorie</Label>
        <Input
          id="nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex: Maçon, Soudeur..."
          className="text-lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tauxHoraire">Taux horaire</Label>
          <Input
            id="tauxHoraire"
            type="number"
            step="0.01"
            min="0.01"
            value={tauxHoraire}
            onChange={(e) => setTauxHoraire(e.target.value)}
            placeholder="0.00"
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="devise">Devise</Label>
          <Input
            id="devise"
            value={devise}
            onChange={(e) => setDevise(e.target.value)}
            placeholder="XOF"
            className="text-lg"
          />
        </div>
      </div>

      {category && (
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div>
            <Label htmlFor="actif">Catégorie active</Label>
            <p className="text-sm text-muted-foreground">
              Les catégories inactives ne sont plus sélectionnables
            </p>
          </div>
          <Switch
            id="actif"
            checked={actif}
            onCheckedChange={setActif}
          />
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading}
        >
          {isLoading ? 'Enregistrement...' : category ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
