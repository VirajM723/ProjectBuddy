import { useState, useEffect } from 'react';
import { Project, UserProfile } from '../types';
import { useAuth } from '../App';
import { ShieldAlert, Trash2, User as UserIcon, Layout } from 'lucide-react';
import { adminService } from '../services/api';

export function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersData, projectsData] = await Promise.all([
          adminService.getAllUsers(),
          adminService.getAllProjects()
        ]);
        setUsers(usersData);
        setProjects(projectsData);
      } catch (err) {
        console.error("Error fetching admin data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminService.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      console.error("Delete user error:", err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await adminService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error("Delete project error:", err);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-20 space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-slate-500">You must be an administrator to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-red-600 p-3 rounded-2xl text-white">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Admin Control Panel</h1>
          <p className="text-slate-500">Manage users, projects, and platform health.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Users Management */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-indigo-600" />
            Users ({users.length})
          </h3>
          <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <img src={u.profileImage || `https://picsum.photos/seed/${u.id}/40/40`} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
                    {u.role}
                  </span>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects Management */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Layout className="w-6 h-6 text-indigo-600" />
            Projects ({projects.length})
          </h3>
          <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
            {projects.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <div className="font-bold text-slate-900">{p.title}</div>
                  <div className="text-xs text-slate-500">Status: {p.status}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDeleteProject(p.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
