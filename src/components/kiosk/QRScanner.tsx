import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeviceId } from '@/lib/storage';

interface QRScannerProps {
  onScan: (qrToken: string) => void;
  isActive: boolean;
}

// Storage keys for camera preference
const CAMERA_PREF_KEY = 'ikoma_camera_facing';

function getCameraPreference(): 'user' | 'environment' {
  const deviceId = getDeviceId();
  const stored = localStorage.getItem(`${CAMERA_PREF_KEY}_${deviceId}`);
  return stored === 'environment' ? 'environment' : 'user'; // Default to 'user' (front)
}

function setCameraPreference(facing: 'user' | 'environment') {
  const deviceId = getDeviceId();
  localStorage.setItem(`${CAMERA_PREF_KEY}_${deviceId}`, facing);
}

export function QRScanner({ onScan, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(getCameraPreference);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const stopScanner = useCallback(async () => {
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
  }, []);

  const startScanner = useCallback(async (facing: 'user' | 'environment') => {
    if (!containerRef.current) return;
    
    // Stop any existing scanner first
    await stopScanner();
    
    try {
      setError(null);
      setFallbackMessage(null);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: facing },
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
      setCameraPreference(facing);
    } catch (err) {
      console.error('QR Scanner error with facing:', facing, err);
      
      // If front camera fails, try back camera as fallback
      if (facing === 'user') {
        console.log('Front camera failed, trying back camera...');
        setFallbackMessage('Caméra selfie indisponible → arrière');
        try {
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
            () => {}
          );
          
          setIsScanning(true);
          setFacingMode('environment');
          setCameraPreference('environment');
        } catch (fallbackErr) {
          console.error('Fallback camera also failed:', fallbackErr);
          setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
          setIsScanning(false);
        }
      } else {
        setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        setIsScanning(false);
      }
    }
  }, [onScan, stopScanner]);

  const toggleCamera = useCallback(async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    setFallbackMessage(null);
    if (isActive) {
      await startScanner(newFacing);
    }
  }, [facingMode, isActive, startScanner]);

  useEffect(() => {
    if (isActive) {
      startScanner(facingMode);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive]); // Only trigger on isActive change, not on facingMode

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
      
      {/* Camera toggle button */}
      {isScanning && !error && (
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleCamera}
          className="absolute top-3 right-3 z-20 bg-black/60 hover:bg-black/80 border-none"
          title={facingMode === 'user' ? 'Passer à caméra arrière' : 'Passer à caméra selfie'}
        >
          <SwitchCamera className="w-5 h-5 text-white" />
        </Button>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card rounded-2xl border-2 border-destructive/50 p-6 text-center">
          <CameraOff className="w-16 h-16 text-destructive mb-4" />
          <p className="text-destructive font-medium">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => startScanner(facingMode)}
            className="mt-4"
          >
            <Camera className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Fallback message */}
      {fallbackMessage && !error && (
        <div className="absolute top-3 left-3 right-14 z-20">
          <span className="bg-warning/90 text-warning-foreground px-3 py-1.5 rounded-lg text-xs font-medium">
            {fallbackMessage}
          </span>
        </div>
      )}

      {/* Scanning indicator */}
      {isScanning && !error && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            {facingMode === 'user' ? '📷 Selfie' : '📷 Arrière'} — Placez le QR code dans le cadre
          </span>
        </div>
      )}
    </div>
  );
}
