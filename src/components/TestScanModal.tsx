import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkerByQrToken, WorkerWithCategory } from '@/hooks/useWorkers';
import { User, CheckCircle, XCircle, Search } from 'lucide-react';

interface TestScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestScanModal({ open, onOpenChange }: TestScanModalProps) {
  const [qrToken, setQrToken] = useState('');
  const [searchToken, setSearchToken] = useState('');
  const [result, setResult] = useState<'found' | 'not-found' | null>(null);

  const { data: worker, isLoading, refetch } = useWorkerByQrToken(searchToken);

  const handleSearch = () => {
    if (qrToken.trim()) {
      setSearchToken(qrToken.trim());
      setResult(null);
    }
  };

  // Update result when worker data changes
  if (searchToken && !isLoading && result === null) {
    setResult(worker ? 'found' : 'not-found');
  }

  const handleClose = () => {
    setQrToken('');
    setSearchToken('');
    setResult(null);
    onOpenChange(false);
  };

  const handleReset = () => {
    setQrToken('');
    setSearchToken('');
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mode Test Scan</DialogTitle>
          <DialogDescription>
            Simulez un scan QR en entrant un token. Aucun événement ne sera enregistré.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!result ? (
            <>
              <div className="space-y-2">
                <Input
                  placeholder="Entrez le qr_token du travailleur..."
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="font-mono text-sm"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                className="w-full gap-2"
                disabled={!qrToken.trim() || isLoading}
              >
                <Search className="h-4 w-4" />
                {isLoading ? 'Recherche...' : 'Simuler le scan'}
              </Button>
            </>
          ) : result === 'found' && worker ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
              
              <div className="w-20 h-20 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden">
                {worker.photo_url ? (
                  <img 
                    src={worker.photo_url} 
                    alt={worker.nom_affiche} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>

              <div>
                <p className="text-xl font-bold text-success">Travailleur reconnu</p>
                <p className="text-2xl font-bold mt-2">{worker.nom_affiche}</p>
                <p className="text-muted-foreground">{worker.matricule}</p>
                {worker.categories && (
                  <p className="text-primary mt-1">{worker.categories.nom}</p>
                )}
              </div>

              <Button variant="outline" onClick={handleReset} className="mt-4">
                Nouveau test
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>

              <div>
                <p className="text-xl font-bold text-destructive">Travailleur non trouvé</p>
                <p className="text-muted-foreground mt-2">
                  Le token QR ne correspond à aucun travailleur actif.
                </p>
              </div>

              <Button variant="outline" onClick={handleReset} className="mt-4">
                Réessayer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
