import { useState } from 'react';
import { Layout, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../App';

export function Login() {
  const { signIn, register, signingIn } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(formData);
      } else {
        await signIn({ email: formData.email, password: formData.password });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-indigo-100">
            <Layout className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Project Buddy</h1>
            <p className="text-slate-500 mt-2 font-medium">Build something amazing together.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {signingIn ? (
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
            ) : isRegister ? (
              <UserPlus className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            ) : (
              <LogIn className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            )}
            {signingIn ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>

        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          Secure authentication via MERN Backend
        </p>
      </div>
      
      <div className="mt-8 text-slate-400 text-sm font-medium">
        © 2026 Project Buddy • Built for Creators
      </div>
    </div>
  );
}
