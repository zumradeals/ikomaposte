// ============================================
// Document QR Code Display Component
// ============================================
// Shows QR code for document verification
// DOCTRINE: QR contains ONLY URL, no data
// ============================================

import { QRCodeSVG } from 'qrcode.react';
import { getQrCodeContent } from '@/lib/qr-verification';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentQRCodeProps {
  documentCode: string;
  size?: number;
  showCard?: boolean;
}

export function DocumentQRCode({ documentCode, size = 180, showCard = true }: DocumentQRCodeProps) {
  const verificationUrl = getQrCodeContent(documentCode);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(verificationUrl);
    toast.success('URL de vérification copiée');
  };

  const handleOpenUrl = () => {
    window.open(verificationUrl, '_blank');
  };

  const qrCodeElement = (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-lg">
        <QRCodeSVG
          value={verificationUrl}
          size={size}
          level="M" // Medium error correction
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono text-center break-all max-w-[200px]">
        {documentCode}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          Copier URL
        </Button>
        <Button variant="outline" size="sm" onClick={handleOpenUrl} className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Tester
        </Button>
      </div>
    </div>
  );

  if (!showCard) {
    return qrCodeElement;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          QR Code de vérification
        </CardTitle>
        <CardDescription>
          Scanner ce code pour vérifier l'authenticité du document
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        {qrCodeElement}
      </CardContent>
    </Card>
  );
}
