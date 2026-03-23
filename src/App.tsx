import { useState, useEffect, createContext, useContext } from 'react';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { CreateProject } from './pages/CreateProject';
import { Admin } from './pages/Admin';
import { ProjectDetails } from './pages/ProjectDetails';
import { Login } from './pages/Login';
import { motion, AnimatePresence } from 'motion/react';
import { authService, userService } from './services/api';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signIn: (credentials: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'profile' | 'create' | 'admin' | 'project'>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        try {
          const profileData = await userService.getProfile(parsedUser.id);
          setProfile(profileData);
        } catch (error) {
          console.error('Failed to fetch profile', error);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
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
  };

  const navigate = (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => {
    if (page === 'profile') {
      const targetId = id || user?.id;
      if (targetId && targetId !== 'undefined' && targetId !== 'null') {
        setProfileId(targetId);
      } else {
        setProfileId(null);
      }
    }
    if (page === 'project' && id) {
      setSelectedProjectId(id);
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, register, logout }}>
        <Login />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, register, logout }}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navbar navigate={navigate} currentPage={currentPage} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage + (selectedProjectId || '') + (profileId || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentPage === 'home' && <Home navigate={navigate} />}
              {currentPage === 'profile' && <Profile userId={profileId || user.id} navigate={navigate} />}
              {currentPage === 'create' && <CreateProject navigate={navigate} />}
              {currentPage === 'admin' && <Admin />}
              {currentPage === 'project' && selectedProjectId && (
                <ProjectDetails projectId={selectedProjectId} navigate={navigate} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
