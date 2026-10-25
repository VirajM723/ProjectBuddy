import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuth } from '../App';
import { Project } from '../types';
import { projectService } from '../services/api';
import { Button, ErrorText, Mark, SeatStrip, cardStyles, cx, inputStyles, labelStyles, openRoles, teamSize } from '../components/ui';

export function Login() {
  const { signIn, register, signingIn } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [recruiting, setRecruiting] = useState<Project[]>([]);

  // The project list is public, so the sign-in screen can show who is looking for people right now
  useEffect(() => {
    projectService.getAll()
      .then((all: Project[]) => setRecruiting(all.filter(p => openRoles(p).length > 0).slice(0, 4)))
      .catch(() => setRecruiting([]));
  }, []);

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
    <div className="min-h-screen bg-ground flex flex-col px-4">
      <div className={cx('flex items-center gap-2 h-14 w-full mx-auto font-medium', recruiting.length ? 'max-w-[400px] lg:max-w-[960px]' : 'max-w-[400px]')}>
        <Mark size={24} />
        Project Buddy
      </div>

      <main className="flex-1 flex flex-col lg:flex-row items-center lg:items-center justify-center gap-12 lg:gap-20 py-8">
        <div className="w-full max-w-[400px] self-center">
          <h1 className="text-2xl font-medium tracking-[-0.01em]">{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="text-muted mt-1">Post a side project, find people to build it with, and keep the team's chat and progress in one place.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="auth-name" className={labelStyles}>Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  className={inputStyles}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className={labelStyles}>Email</label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                className={inputStyles}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="auth-password" className={labelStyles}>Password</label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={inputStyles}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <Button type="submit" variant="primary" className="w-full h-10" disabled={signingIn}>
              {signingIn ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {isRegister ? 'Already have an account?' : 'New to Project Buddy?'}{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-ink font-medium underline underline-offset-2"
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>

        {recruiting.length > 0 && (
          <section aria-labelledby="recruiting-title" className="w-full max-w-[400px] lg:max-w-[480px]">
            <h2 id="recruiting-title" className="text-base font-medium">Looking for people now</h2>
            <ul className={cx(cardStyles, 'mt-3')}>
              {recruiting.map(project => {
                const open = openRoles(project);
                return (
                  <li key={project.id} className="px-4 py-3 border-t border-rule first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium truncate">{project.title}</span>
                      <span className="text-xs text-muted whitespace-nowrap num">{formatDistanceToNowStrict(new Date(project.createdAt))} ago</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-sm min-w-0">
                      <SeatStrip filled={teamSize(project)} open={open.length} />
                      <span className="truncate"><span className="text-data font-medium">{open.length} open</span><span className="text-muted"> · {open.join(', ')}</span></span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted mt-3">Sign in to read the details and ask to join.</p>
          </section>
        )}
      </main>
    </div>
  );
}
