import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, AlertCircle, CheckCircle } from 'lucide-react';

interface SnapshotCaptureProps {
  onCapture: (blob: Blob) => void;
  onError: (error: string) => void;
  trigger: boolean;
  onReady: () => void;
  autoCapture?: boolean; // If true, capture automatically after autoDelay
  autoDelay?: number; // Delay in ms before auto-capture (default: 1000)
}

export function SnapshotCapture({ 
  onCapture, 
  onError, 
  trigger, 
  onReady,
  autoCapture = true,
  autoDelay = 1000
}: SnapshotCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  // Start camera when component mounts
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Front camera for snapshot
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          await video.play();

          // Wait until metadata is available (prevents 0x0 / black frames)
          await new Promise<void>((resolve) => {
            if (video.readyState >= 2 && video.videoWidth > 0) return resolve();

            const onReady = () => {
              if (video.videoWidth > 0) {
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('canplay', onReady);
                resolve();
              }
            };

            video.addEventListener('loadedmetadata', onReady);
            video.addEventListener('canplay', onReady);

            // Failsafe: don't block forever
            setTimeout(() => {
              video.removeEventListener('loadedmetadata', onReady);
              video.removeEventListener('canplay', onReady);
              resolve();
            }, 1500);
          });

          setIsReady(true);
          setError(null);
          onReady();
        }
      } catch (err) {
        console.error('Snapshot camera error:', err);
        const errorMessage = 'Impossible d\'accéder à la caméra pour la capture.';
        setError(errorMessage);
        onError(errorMessage);
      }
    };

    startCamera();

    return () => {
      // Cleanup timers
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      // Cleanup camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [onError, onReady]);

  // Capture function
  const captureSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      onError('Capture impossible: éléments non prêts');
      return;
    }

    // If metadata isn't ready yet, don't hard-fail: allow user to tap again.
    if (!video.videoWidth || !video.videoHeight) {
      console.warn('[Snapshot] Video not ready yet (0x0). Tap to retry.');
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onError('Capture impossible: contexte canvas invalide');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Convert to webp blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCaptured(true);
            onCapture(blob);
          } else {
            onError('Échec de la conversion de l\'image');
          }
        },
        'image/webp',
        0.8
      );
    } catch (err) {
      console.error('Capture error:', err);
      onError('Erreur lors de la capture');
    }
  }, [onCapture, onError]);

  // Auto-capture when trigger becomes true and camera is ready
  useEffect(() => {
    if (!trigger || !isReady || captured) return;
    
    if (autoCapture) {
      // Auto-capture after delay
      console.log(`[Snapshot] Auto-capture in ${autoDelay}ms`);
      autoCaptureTimerRef.current = setTimeout(() => {
        console.log('[Snapshot] Auto-capturing now');
        captureSnapshot();
      }, autoDelay);
      
      return () => {
        if (autoCaptureTimerRef.current) {
          clearTimeout(autoCaptureTimerRef.current);
          autoCaptureTimerRef.current = null;
        }
      };
    } else {
      // Immediate capture (old behavior)
      captureSnapshot();
    }
  }, [trigger, isReady, captured, autoCapture, autoDelay, captureSnapshot]);

  if (error) {
    return (
      <div className="w-32 h-24 bg-destructive/10 rounded-lg flex flex-col items-center justify-center text-destructive">
        <AlertCircle className="w-8 h-8 mb-1" />
        <span className="text-xs text-center px-2">Caméra indisponible</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <video 
        ref={videoRef} 
        className={`w-32 h-24 object-cover rounded-lg bg-muted ${trigger && isReady && !captured ? 'cursor-pointer' : ''}`}
        autoPlay 
        playsInline 
        muted
        onClick={() => {
          // Manual fallback: tap to capture (only when action is armed)
          if (trigger && isReady && !captured) {
            captureSnapshot();
          }
        }}
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Loading state */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <Camera className="w-8 h-8 text-muted-foreground animate-pulse" />
        </div>
      )}
      
      {/* Ready indicator (green dot) */}
      {isReady && !captured && (
        <div className="absolute bottom-1 right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
      )}
      
      {/* Captured indicator */}
      {captured && (
        <div className="absolute inset-0 flex items-center justify-center bg-success/20 rounded-lg">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
      )}
      
      {/* Countdown indicator when about to capture */}
      {trigger && isReady && !captured && autoCapture && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-lg gap-1">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-[10px] text-white/80">Auto-shot… (ou touchez)</span>
        </div>
      )}
    </div>
  );
}
