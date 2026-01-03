import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminAuthGuard } from './AdminAuthGuard';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { 
  Lock, 
  Users, 
  Tags, 
  LayoutDashboard,
  ChevronLeft,
  LogOut,
  User,
  Menu,
  Activity,
  Calculator,
  Tablet,
  Stethoscope
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

const navItems = [
  { path: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/admin/events', label: 'Flux du jour', icon: Activity },
  { path: '/admin/calculations', label: 'Calculs', icon: Calculator },
  { path: '/admin/devices', label: 'Appareils', icon: Tablet },
  { path: '/admin/categories', label: 'Catégories', icon: Tags },
  { path: '/admin/workers', label: 'Travailleurs', icon: Users },
  { path: '/admin/diagnostic', label: 'Diagnostic', icon: Stethoscope },
];

export function AdminLayout({ children, title, showBack = false }: AdminLayoutProps) {
  const { lock, remainingTime } = useAdmin();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLockAndSignOut = async () => {
    await signOut();
    lock();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const NavContent = () => (
    <nav className="space-y-2">
      {navItems.map(item => (
        <Button
          key={item.path}
          variant={location.pathname === item.path ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-3 text-left"
          onClick={() => handleNavigation(item.path)}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Button>
      ))}
    </nav>
  );

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile menu button */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-4">
                  <SheetTitle className="text-lg font-semibold mb-4">Navigation</SheetTitle>
                  <NavContent />
                  
                  {/* Mobile user actions */}
                  <div className="mt-6 pt-4 border-t border-border space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs truncate">{user?.email}</span>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Session expire dans</p>
                      <p className={`text-lg font-mono font-bold ${remainingTime < 30 ? 'text-destructive' : 'text-primary'}`}>
                        {formatTime(remainingTime)}
                      </p>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => { signOut(); setSidebarOpen(false); }}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      onClick={() => { handleLockAndSignOut(); setSidebarOpen(false); }}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <Lock className="h-4 w-4" />
                      Verrouiller
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              
              {showBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-foreground">{title}</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">IKOMA POSTE - Administration</p>
              </div>
            </div>
            
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-4">
              {/* User info */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Session expire dans</p>
                <p className={`text-lg font-mono font-bold ${remainingTime < 30 ? 'text-destructive' : 'text-primary'}`}>
                  {formatTime(remainingTime)}
                </p>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => signOut()}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={handleLockAndSignOut}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                Verrouiller
              </Button>
            </div>
            
            {/* Mobile timer */}
            <div className="md:hidden text-right">
              <p className={`text-sm font-mono font-bold ${remainingTime < 30 ? 'text-destructive' : 'text-primary'}`}>
                {formatTime(remainingTime)}
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 bg-card border-r border-border p-4">
            <NavContent />
          </aside>

          {/* Main content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
