import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminProvider } from "@/contexts/AdminContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SwUpdateNotifier } from "@/components/SwUpdateNotifier";
import ScanScreen from "./pages/ScanScreen";
import AdminConsole from "./pages/AdminConsole";
import AdminCategories from "./pages/AdminCategories";
import AdminWorkers from "./pages/AdminWorkers";
import AdminEvents from "./pages/AdminEvents";
import AdminDevices from "./pages/AdminDevices";
import AdminCalculations from "./pages/AdminCalculations";
import AdminDiagnostic from "./pages/AdminDiagnostic";
import AdminSessionDiagnostic from "./pages/AdminSessionDiagnostic";
import AdminAnomalies from "./pages/AdminAnomalies";
import AdminExports from "./pages/AdminExports";
import AdminSecurity from "./pages/AdminSecurity";
import AdminSecuritySetup from "./pages/AdminSecuritySetup";
import AdminSchedules from "./pages/AdminSchedules";
import AdminRotation from "./pages/AdminRotation";
import AdminValidation from "./pages/AdminValidation";
import AdminPolicies from "./pages/AdminPolicies";
import AdminAudit from "./pages/AdminAudit";
import AdminDemo from "./pages/AdminDemo";
import VerifyDocument from "./pages/VerifyDocument";

const queryClient = new QueryClient();

const SW_VERSION = 'v2';

// Register service worker with update detection
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[IKOMA] SW registered:', registration.scope);
          
          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  console.log('[IKOMA] New SW version available');
                  dispatchEvent(new CustomEvent('swUpdate', { detail: { version: SW_VERSION } }));
                }
              });
            }
          });
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
            <SwUpdateNotifier />
            <BrowserRouter>
              <Routes>
                {/* Main kiosk screen - always accessible */}
                <Route path="/" element={<ScanScreen />} />
                
                {/* Admin console - protected by AdminContext + AuthContext */}
                <Route path="/admin" element={<AdminConsole />} />
                <Route path="/admin/events" element={<AdminEvents />} />
                <Route path="/admin/calculations" element={<AdminCalculations />} />
                <Route path="/admin/anomalies" element={<AdminAnomalies />} />
                <Route path="/admin/exports" element={<AdminExports />} />
                <Route path="/admin/devices" element={<AdminDevices />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/schedules" element={<AdminSchedules />} />
                <Route path="/admin/rotation" element={<AdminRotation />} />
                <Route path="/admin/policies" element={<AdminPolicies />} />
                <Route path="/admin/validation" element={<AdminValidation />} />
                <Route path="/admin/audit" element={<AdminAudit />} />
                <Route path="/admin/demo" element={<AdminDemo />} />
                <Route path="/admin/workers" element={<AdminWorkers />} />
                <Route path="/admin/diagnostic" element={<AdminDiagnostic />} />
                <Route path="/admin/security" element={<AdminSecurity />} />
                {/* Security setup - accessible without PIN (only email login required) */}
                <Route path="/admin/security/setup" element={<AdminSecuritySetup />} />
                {/* Session diagnostics (PIN only, no login required) */}
                <Route path="/admin/session" element={<AdminSessionDiagnostic />} />
                
                {/* Public document verification - no auth required */}
                <Route path="/verify/:documentCode" element={<VerifyDocument />} />
                <Route path="/verify" element={<VerifyDocument />} />
                
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
