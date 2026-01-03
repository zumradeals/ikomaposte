import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkers } from '@/hooks/useWorkers';
import { Search, Copy, Check } from 'lucide-react';

interface TestScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestScan?: (qrToken: string) => void;
}

export function TestScanModal({ open, onOpenChange, onTestScan }: TestScanModalProps) {
  const [qrToken, setQrToken] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  const { data: workers } = useWorkers({ includeInactive: false });

  const handleSimulateScan = () => {
    if (qrToken.trim() && onTestScan) {
      onTestScan(qrToken.trim());
      onOpenChange(false);
      setQrToken('');
    }
  };

  const handleQuickSelect = (token: string) => {
    if (onTestScan) {
      onTestScan(token);
      onOpenChange(false);
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleClose = () => {
    setQrToken('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mode Test Scan</DialogTitle>
          <DialogDescription>
            Simulez un scan QR en sélectionnant un travailleur ou en entrant un token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick select from existing workers */}
          {workers && workers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Sélection rapide
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {workers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{worker.nom_affiche}</p>
                      <p className="text-xs text-muted-foreground">{worker.matricule}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToken(worker.qr_token)}
                        title="Copier le token"
                      >
                        {copiedToken === worker.qr_token ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickSelect(worker.qr_token)}
                      >
                        Scanner
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual token entry */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Ou entrez un token manuellement
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="qr_token..."
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSimulateScan()}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleSimulateScan}
                disabled={!qrToken.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {workers && workers.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Aucun travailleur actif. Créez des travailleurs dans l'admin.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
