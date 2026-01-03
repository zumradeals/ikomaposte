import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkerWithCategory, WorkerInsert, WorkerUpdate, uploadWorkerPhoto } from '@/hooks/useWorkers';
import { useCategories } from '@/hooks/useCategories';
import { Camera, Upload, User } from 'lucide-react';

interface WorkerFormProps {
  worker?: WorkerWithCategory | null;
  onSubmit: (data: WorkerInsert | WorkerUpdate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function WorkerForm({ worker, onSubmit, onCancel, isLoading }: WorkerFormProps) {
  const [matricule, setMatricule] = useState('');
  const [nomAffiche, setNomAffiche] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [actif, setActif] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useCategories();

  useEffect(() => {
    if (worker) {
      setMatricule(worker.matricule);
      setNomAffiche(worker.nom_affiche);
      setCategoryId(worker.category_id);
      setActif(worker.actif);
      setPhotoUrl(worker.photo_url);
    }
  }, [worker]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!matricule.trim()) {
      setError('Le matricule est requis');
      return;
    }

    if (!nomAffiche.trim()) {
      setError('Le nom affiché est requis');
      return;
    }

    if (!categoryId) {
      setError('La catégorie est requise');
      return;
    }

    let finalPhotoUrl = photoUrl;

    // Upload photo if new file selected
    if (photoFile && worker?.id) {
      setUploading(true);
      try {
        finalPhotoUrl = await uploadWorkerPhoto(photoFile, worker.id);
      } catch (err) {
        setError('Erreur lors du téléchargement de la photo');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSubmit({
      matricule: matricule.trim(),
      nom_affiche: nomAffiche.trim(),
      category_id: categoryId,
      actif,
      photo_url: finalPhotoUrl,
    });
  };

  const displayPhoto = photoPreview || photoUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo upload */}
      <div className="flex flex-col items-center gap-4">
        <div 
          className="w-32 h-32 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {displayPhoto ? (
            <img 
              src={displayPhoto} 
              alt="Photo travailleur" 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-16 h-16 text-muted-foreground" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          {displayPhoto ? 'Changer la photo' : 'Ajouter une photo'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="matricule">Matricule</Label>
          <Input
            id="matricule"
            value={matricule}
            onChange={(e) => setMatricule(e.target.value.toUpperCase())}
            placeholder="Ex: TRV001"
            className="text-lg font-mono"
            disabled={!!worker} // Can't change matricule after creation
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nomAffiche">Nom affiché</Label>
          <Input
            id="nomAffiche"
            value={nomAffiche}
            onChange={(e) => setNomAffiche(e.target.value.toUpperCase())}
            placeholder="Ex: KOFFI"
            className="text-lg"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="text-lg">
            <SelectValue placeholder="Sélectionner une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nom} ({cat.taux_horaire} {cat.devise}/h)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {worker && (
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div>
            <Label htmlFor="actif">Travailleur actif</Label>
            <p className="text-sm text-muted-foreground">
              Les travailleurs inactifs ne peuvent plus pointer
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
          disabled={isLoading || uploading}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading || uploading}
        >
          {uploading ? 'Téléchargement...' : isLoading ? 'Enregistrement...' : worker ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
