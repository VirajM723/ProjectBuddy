import { useAuth } from '../App';
import { Layout, PlusCircle, User, LogIn, LogOut, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
  currentPage: string;
}

export function Navbar({ navigate, currentPage }: NavbarProps) {
  const { user, profile, signIn, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('home')}
              className="flex items-center gap-2 text-indigo-600 font-bold text-xl hover:opacity-80 transition-opacity"
            >
              <Layout className="w-8 h-8" />
              <span>Project Buddy</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => navigate('admin')}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button
                  onClick={() => navigate('create')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === 'create' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  Post Project
                </button>
                <button
                  onClick={() => navigate('profile')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === 'profile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
                <img 
                  src={profile?.profileImage || `https://picsum.photos/seed/${user.id}/40/40`} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <button
                onClick={signIn}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
