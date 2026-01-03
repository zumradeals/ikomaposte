import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WorkerWithCategory } from '@/hooks/useWorkers';
import { Download, Printer, User } from 'lucide-react';

interface WorkerQRModalProps {
  worker: WorkerWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkerQRModal({ worker, open, onOpenChange }: WorkerQRModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  if (!worker) return null;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      
      if (ctx) {
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // QR code centered
        ctx.drawImage(img, 50, 50, 300, 300);
        
        // Name and matricule
        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(worker.nom_affiche, canvas.width / 2, 400);
        
        ctx.font = '16px Inter, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText(worker.matricule, canvas.width / 2, 430);
        
        if (worker.categories) {
          ctx.fillText(worker.categories.nom, canvas.width / 2, 460);
        }
        
        // Download
        const link = document.createElement('a');
        link.download = `QR_${worker.matricule}_${worker.nom_affiche}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${worker.nom_affiche}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
            }
            h2 { margin: 20px 0 5px; font-size: 24px; }
            p { margin: 5px 0; color: #666; }
            svg { width: 300px; height: 300px; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${svgData}
            <h2>${worker.nom_affiche}</h2>
            <p>${worker.matricule}</p>
            ${worker.categories ? `<p>${worker.categories.nom}</p>` : ''}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code Travailleur</DialogTitle>
          <DialogDescription>
            {worker.nom_affiche} - {worker.matricule}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          {/* Worker photo */}
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

          {/* QR Code */}
          <div ref={qrRef} className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={worker.qr_token}
              size={200}
              level="H"
              includeMargin
            />
          </div>

          {/* Worker info */}
          <div className="text-center">
            <p className="text-xl font-bold">{worker.nom_affiche}</p>
            <p className="text-muted-foreground">{worker.matricule}</p>
            {worker.categories && (
              <p className="text-sm text-primary">{worker.categories.nom}</p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
