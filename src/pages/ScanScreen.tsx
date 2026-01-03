import { useState, useRef, useCallback } from 'react';
import { QrCode, Wifi, WifiOff, FlaskConical } from 'lucide-react';
import { AdminUnlockModal } from '@/components/AdminUnlockModal';
import { TestScanModal } from '@/components/TestScanModal';
import { useAdmin } from '@/contexts/AdminContext';
import { getDeviceId } from '@/lib/storage';
import { Button } from '@/components/ui/button';

export default function ScanScreen() {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTestScan, setShowTestScan] = useState(false);
  const [isOnline] = useState(navigator.onLine);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const { isUnlocked } = useAdmin();

  const deviceId = getDeviceId();

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

  return (
    <div className="kiosk-mode min-h-screen bg-background flex flex-col items-center justify-center p-8 relative overflow-hidden">
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

      {/* Test scan button (admin only) */}
      {isUnlocked && (
        <div className="absolute top-6 right-6 z-50">
          <Button
            variant="outline"
            onClick={() => setShowTestScan(true)}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4" />
            Mode Test
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        {/* Logo / Title */}
        <div className="mb-12 text-center">
          <h1 className="text-kiosk-title text-foreground mb-2">
            IKOMA <span className="text-primary">POSTE</span>
          </h1>
          <p className="text-kiosk-small text-muted-foreground">
            Système de Pointage
          </p>
        </div>

        {/* Scan Frame */}
        <div className="relative w-80 h-80 md:w-96 md:h-96 mb-12">
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-scan-pulse" />
          
          {/* Main frame */}
          <div className="absolute inset-2 rounded-2xl bg-card border-2 border-border flex items-center justify-center">
            {/* Corner indicators */}
            <div className="scan-corner scan-corner-tl" />
            <div className="scan-corner scan-corner-tr" />
            <div className="scan-corner scan-corner-bl" />
            <div className="scan-corner scan-corner-br" />
            
            {/* QR placeholder */}
            <div className="flex flex-col items-center text-muted-foreground">
              <QrCode className="w-24 h-24 md:w-32 md:h-32 mb-4 animate-glow" />
              <p className="text-kiosk-body">Scanner QR</p>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3 px-6 py-4 bg-card rounded-2xl border border-border">
          <div className="status-dot status-ready" />
          <span className="text-kiosk-body text-success">Prêt</span>
        </div>
      </div>

      {/* Footer - device info & status */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
          <span className="font-mono text-xs">{deviceId}</span>
        </div>
        
        <div className="flex items-center gap-2 text-muted-foreground/60">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-success" />
          ) : (
            <WifiOff className="w-5 h-5 text-destructive" />
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
      />
    </div>
  );
}
