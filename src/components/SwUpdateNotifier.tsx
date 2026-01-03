/**
 * Service Worker Update Notifier - Phase 4.5
 * Shows a notification when a new app version is available
 */

import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SwUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleSwUpdate = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('swUpdate', handleSwUpdate);
    
    return () => {
      window.removeEventListener('swUpdate', handleSwUpdate);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-primary text-primary-foreground rounded-xl p-4 shadow-lg z-50 animate-fade-in">
      <div className="flex items-start gap-3">
        <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Mise à jour disponible</p>
          <p className="text-sm opacity-90 mb-3">
            Une nouvelle version de l'app est disponible.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRefresh}
              className="flex-1"
            >
              Rafraîchir maintenant
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
