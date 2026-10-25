import { useState, useEffect, createContext, useContext } from 'react';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { CreateProject } from './pages/CreateProject';
import { Admin } from './pages/Admin';
import { ProjectDetails } from './pages/ProjectDetails';
import { Login } from './pages/Login';
import { authService, userService } from './services/api';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signIn: (credentials: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileState: (updatedProfile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

type Page = 'home' | 'profile' | 'create' | 'admin' | 'project';

const isObjectId = (id?: string) => !!id && /^[a-f\d]{24}$/i.test(id);

// Keeps the current page in the URL so refresh, sharing links, and the back button work
function pathFor(page: Page, id?: string) {
  switch (page) {
    case 'project': return id ? `/project/${id}` : '/';
    case 'profile': return id ? `/profile/${id}` : '/profile';
    case 'create': return id ? `/project/${id}/edit` : '/create';
    case 'admin': return '/admin';
    default: return '/';
  }
}

function parsePath(pathname: string): { page: Page; id?: string } {
  const [first, id, action] = pathname.split('/').filter(Boolean);
  if (first === 'project' && isObjectId(id)) return action === 'edit' ? { page: 'create', id } : { page: 'project', id };
  if (first === 'profile') return { page: 'profile', id: isObjectId(id) ? id : undefined };
  if (first === 'create') return { page: 'create' };
  if (first === 'admin') return { page: 'admin' };
  return { page: 'home' };
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        try {
          // Validates the token and picks up any role/name changes since last login
          const profileData = await authService.me();
          const freshUser = { id: profileData.id, name: profileData.name, email: profileData.email, role: profileData.role };
          localStorage.setItem('user', JSON.stringify(freshUser));
          setUser(freshUser);
          setProfile(profileData);
        } catch (error) {
          console.error('Failed to restore session', error);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();

    const initial = parsePath(window.location.pathname);
    applyRoute(initial.page, initial.id);
    const onPopState = () => {
      const route = parsePath(window.location.pathname);
      applyRoute(route.page, route.id);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const signIn = async (credentials: any) => {
    setSigningIn(true);
    try {
      const data = await authService.login(credentials);
      const { token, user } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      const profileData = await userService.getProfile(user.id);
      setProfile(profileData);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const register = async (userData: any) => {
    setSigningIn(true);
    try {
      const data = await authService.register(userData);
      const { token, user } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      const profileData = await userService.getProfile(user.id);
      setProfile(profileData);
    } catch (error) {
      console.error('Registration failed', error);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setProfile(null);
    setCurrentPage('home');
    window.history.replaceState(null, '', '/');
  };

  const updateProfileState = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    if (user && user.id === updatedProfile.id) {
      const u = { ...user, profileImage: updatedProfile.profileImage, name: updatedProfile.name };
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
    }
  };

  const applyRoute = (page: Page, id?: string) => {
    if (page === 'profile') {
      // No id means "my profile", resolved against the signed-in user at render time
      setProfileId(isObjectId(id) ? id! : null);
    }
    if (page === 'project') {
      if (!id) page = 'home';
      else setSelectedProjectId(id);
    }
    if (page === 'create') {
      setEditProjectId(id || null);
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const navigate = (page: Page, id?: string) => {
    if (page === 'profile' && !isObjectId(id)) id = user?.id;
    applyRoute(page, id);
    const path = pathFor(page, id);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground text-sm text-muted" role="status">
        Loading Project Buddy…
      </div>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, register, logout, updateProfileState }}>
        <Login />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, register, logout, updateProfileState }}>
      <div className="min-h-screen bg-ground text-ink">
        <Navbar navigate={navigate} currentPage={currentPage} />
        <main className="md:pl-14">
          {/* One centred canvas: 1200px wide at most, 32px gutters on desktop, 16px on a phone */}
          <div className="max-w-[1264px] mx-auto px-4 md:px-8 pt-5 md:pt-9 pb-24 md:pb-16">
            {currentPage === 'home' && <Home navigate={navigate} />}
            {currentPage === 'profile' && <Profile key={profileId || user.id} userId={profileId || user.id} navigate={navigate} />}
            {currentPage === 'create' && <CreateProject key={editProjectId || 'new'} navigate={navigate} projectId={editProjectId || undefined} />}
            {currentPage === 'admin' && <Admin />}
            {currentPage === 'project' && selectedProjectId && (
              <ProjectDetails key={selectedProjectId} projectId={selectedProjectId} navigate={navigate} />
            )}
          </div>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
