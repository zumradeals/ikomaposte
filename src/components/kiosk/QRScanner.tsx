import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (qrToken: string) => void;
  isActive: boolean;
}

export function QRScanner({ onScan, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const startScanner = async () => {
    if (!containerRef.current || scannerRef.current) return;
    
    try {
      setError(null);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Debounce: don't scan same code within 3 seconds
          const now = Date.now();
          if (
            decodedText === lastScannedRef.current && 
            now - lastScanTimeRef.current < 3000
          ) {
            return;
          }
          
          lastScannedRef.current = decodedText;
          lastScanTimeRef.current = now;
          onScan(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('QR Scanner error:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive]);

  // Reset last scanned when becoming inactive
  useEffect(() => {
    if (!isActive) {
      lastScannedRef.current = '';
      lastScanTimeRef.current = 0;
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Scanner container */}
      <div 
        id="qr-reader" 
        ref={containerRef}
        className="rounded-2xl overflow-hidden bg-black"
      />
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card rounded-2xl border-2 border-destructive/50 p-6 text-center">
          <CameraOff className="w-16 h-16 text-destructive mb-4" />
          <p className="text-destructive font-medium">{error}</p>
          <Button 
            variant="outline" 
            onClick={startScanner}
            className="mt-4"
          >
            <Camera className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Scanning indicator */}
      {isScanning && !error && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            Placez le QR code dans le cadre
          </span>
        </div>
      )}
    </div>
  );
}
