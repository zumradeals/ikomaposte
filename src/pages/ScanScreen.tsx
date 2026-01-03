import { useState, useRef, useCallback, useEffect } from 'react';
import { QrCode, Wifi, WifiOff, FlaskConical, Camera, CameraOff } from 'lucide-react';
import { AdminUnlockModal } from '@/components/AdminUnlockModal';
import { TestScanModal } from '@/components/TestScanModal';
import { QRScanner } from '@/components/kiosk/QRScanner';
import { WorkerActionCard } from '@/components/kiosk/WorkerActionCard';
import { useAdmin } from '@/contexts/AdminContext';
import { useWorkerByQrToken, WorkerWithCategory } from '@/hooks/useWorkers';
import { getDeviceId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ScreenState = 'idle' | 'scanning' | 'worker-action';

export default function ScanScreen() {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTestScan, setShowTestScan] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [currentWorker, setCurrentWorker] = useState<WorkerWithCategory | null>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const { isUnlocked } = useAdmin();
  const { toast } = useToast();

  const deviceId = getDeviceId();

  // Fetch worker when QR is scanned
  const { data: worker, isLoading: isLoadingWorker } = useWorkerByQrToken(scannedToken || undefined);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle worker lookup result
  useEffect(() => {
    if (scannedToken && !isLoadingWorker) {
      if (worker) {
        setCurrentWorker(worker);
        setScreenState('worker-action');
      } else {
        toast({
          title: 'QR non reconnu',
          description: 'Ce code QR ne correspond à aucun travailleur actif.',
          variant: 'destructive',
        });
        setScannedToken(null);
        setScreenState('scanning');
      }
    }
  }, [worker, isLoadingWorker, scannedToken, toast]);

  // Long press detection for admin unlock (5 seconds)
  const handlePressStart = useCallback(() => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(() => {
      setShowAdminModal(true);
      setIsPressed(false);
    }, 5000);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle QR scan
  const handleQRScan = useCallback((qrToken: string) => {
    setScannedToken(qrToken);
  }, []);

  // Start scanning mode
  const handleStartScan = () => {
    setScreenState('scanning');
  };

  // Return to idle
  const handleBackToIdle = () => {
    setScreenState('idle');
    setScannedToken(null);
    setCurrentWorker(null);
  };

  // After action complete, return to idle
  const handleActionComplete = () => {
    setScreenState('idle');
    setScannedToken(null);
    setCurrentWorker(null);
  };

  // Test scan handler (admin mode)
  const handleTestScan = (token: string) => {
    setShowTestScan(false);
    setScannedToken(token);
  };

  return (
    <div className="kiosk-mode min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
      
      {/* Admin unlock zone (top-left corner, invisible) */}
      <div
        className="admin-unlock-zone top-0 left-0 z-50"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        {isPressed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Admin controls (top right) */}
      {isUnlocked && (
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTestScan(true)}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4" />
            Test
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        
        {/* IDLE STATE - Show logo and start button */}
        {screenState === 'idle' && (
          <>
            {/* Logo / Title */}
            <div className="mb-8 text-center">
              <h1 className="text-4xl md:text-kiosk-title text-foreground mb-2">
                IKOMA <span className="text-primary">POSTE</span>
              </h1>
              <p className="text-lg md:text-kiosk-small text-muted-foreground">
                Système de Pointage
              </p>
            </div>

            {/* Scan Frame / Start Button */}
            <div className="relative w-72 h-72 md:w-80 md:h-80 mb-8">
              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-scan-pulse" />
              
              {/* Main frame - clickable */}
              <button
                onClick={handleStartScan}
                className="absolute inset-2 rounded-2xl bg-card border-2 border-border flex items-center justify-center hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {/* Corner indicators */}
                <div className="scan-corner scan-corner-tl" />
                <div className="scan-corner scan-corner-tr" />
                <div className="scan-corner scan-corner-bl" />
                <div className="scan-corner scan-corner-br" />
                
                {/* QR placeholder */}
                <div className="flex flex-col items-center text-muted-foreground">
                  <QrCode className="w-20 h-20 md:w-24 md:h-24 mb-4 animate-glow" />
                  <p className="text-lg md:text-kiosk-body font-medium">Appuyez pour scanner</p>
                </div>
              </button>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3 px-6 py-4 bg-card rounded-2xl border border-border">
              <div className="status-dot status-ready" />
              <span className="text-lg md:text-kiosk-body text-success">Prêt</span>
            </div>
          </>
        )}

        {/* SCANNING STATE - Show QR Scanner */}
        {screenState === 'scanning' && !currentWorker && (
          <>
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Scanner votre badge
              </h2>
              <p className="text-muted-foreground">
                Présentez votre QR code devant la caméra
              </p>
            </div>

            <div className="w-full max-w-sm mb-6">
              <QRScanner 
                onScan={handleQRScan}
                isActive={screenState === 'scanning' && !scannedToken}
              />
            </div>

            {isLoadingWorker && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Recherche du travailleur...</span>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleBackToIdle}
              className="mt-4"
            >
              Annuler
            </Button>
          </>
        )}

        {/* WORKER ACTION STATE - Show worker card with actions */}
        {screenState === 'worker-action' && currentWorker && (
          <div className="w-full relative">
            <WorkerActionCard
              worker={currentWorker}
              onComplete={handleActionComplete}
              onCancel={handleBackToIdle}
            />
          </div>
        )}
      </div>

      {/* Footer - device info & status */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground/60">
          <span className="font-mono">{deviceId}</span>
        </div>
        
        <div className="flex items-center gap-2 text-muted-foreground/60">
          {isOnline ? (
            <Wifi className="w-4 h-4 md:w-5 md:h-5 text-success" />
          ) : (
            <WifiOff className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
          )}
        </div>
      </div>

      {/* Admin unlock modal */}
      <AdminUnlockModal 
        open={showAdminModal} 
        onOpenChange={setShowAdminModal} 
      />

      {/* Test scan modal (admin only) */}
      <TestScanModal
        open={showTestScan}
        onOpenChange={setShowTestScan}
        onTestScan={handleTestScan}
      />
    </div>
  );
}
