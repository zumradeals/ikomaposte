import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminProvider } from "@/contexts/AdminContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ScanScreen from "./pages/ScanScreen";
import AdminConsole from "./pages/AdminConsole";
import AdminCategories from "./pages/AdminCategories";
import AdminWorkers from "./pages/AdminWorkers";
import AdminEvents from "./pages/AdminEvents";

const queryClient = new QueryClient();

// Register service worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[IKOMA] SW registered:', registration.scope);
        })
        .catch((error) => {
          console.log('[IKOMA] SW registration failed:', error);
        });
    });
  }
}

const App = () => {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AdminProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Main kiosk screen - always accessible */}
                <Route path="/" element={<ScanScreen />} />
                
                {/* Admin console - protected by AdminContext + AuthContext */}
                <Route path="/admin" element={<AdminConsole />} />
                <Route path="/admin/events" element={<AdminEvents />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/workers" element={<AdminWorkers />} />
                
                {/* All other routes redirect to scan screen (kiosk mode) */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AdminProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
