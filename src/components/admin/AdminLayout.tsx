import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminAuthGuard } from './AdminAuthGuard';
import { Button } from '@/components/ui/button';
import { 
  Lock, 
  Users, 
  Tags, 
  LayoutDashboard,
  ChevronLeft,
  LogOut,
  User
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

const navItems = [
  { path: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/admin/categories', label: 'Catégories', icon: Tags },
  { path: '/admin/workers', label: 'Travailleurs', icon: Users },
];

export function AdminLayout({ children, title, showBack = false }: AdminLayoutProps) {
  const { lock, remainingTime } = useAdmin();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                <p className="text-sm text-muted-foreground">IKOMA POSTE - Administration</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
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
          </div>
        </header>

        <div className="flex flex-1">
          {/* Sidebar */}
          <aside className="w-64 bg-card border-r border-border p-4">
            <nav className="space-y-2">
              {navItems.map(item => (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3 text-left"
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
