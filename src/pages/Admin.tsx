import { useState, useEffect } from 'react';
import { Project, UserProfile } from '../types';
import { useAuth } from '../App';
import { format } from 'date-fns';
import { adminService, getId, getErrorMessage } from '../services/api';
import { Avatar, Pill, buttonStyles, cardStyles, cx, projectStatusTone } from '../components/ui';

export function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In MERN, the user object from useAuth will have the role
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
    if (!window.confirm('Delete this user? Their projects, requests and activity will also be removed.')) return;
    try {
      await adminService.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      // The user's own projects are removed along with them
      setProjects(projects.filter(p => getId(p.ownerId) !== userId));
    } catch (err) {
      console.error("Delete user error:", err);
      alert(getErrorMessage(err, 'Failed to delete user.'));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await adminService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error("Delete project error:", err);
      alert(getErrorMessage(err, 'Failed to delete project.'));
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div>
        <h1 className="text-2xl font-medium">Admin</h1>
        <p className="text-muted mt-1">Only administrators can open this page.</p>
      </div>
    );
  }

  const admins = users.filter(u => u.role === 'admin').length;
  const openCount = projects.filter(p => p.status === 'Open' || p.status === 'Reopened').length;
  const headCell = 'h-10 px-5 text-left text-xs font-normal text-muted';
  const rowCell = 'px-5 py-3 border-t border-rule align-middle';

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Admin</h1>
      <p className="text-muted mt-1 num">
        {loading ? '\u00a0' : `${users.length} members, ${admins} with admin access · ${projects.length} projects, ${openCount} open`}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-6 items-start">
        <section className={cx(cardStyles, 'overflow-hidden')}>
          <h2 className="text-base font-medium px-5 pt-5 pb-3">Members</h2>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className={headCell}>Name</th>
                  <th className={cx(headCell, 'hidden sm:table-cell')}>Joined</th>
                  <th className={headCell}>Access</th>
                  <th className={headCell}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className={cx(rowCell, 'text-muted')}>Loading members…</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td className={cx(rowCell, 'max-w-0 w-full')}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={u.name} src={u.profileImage} size={28} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.name}</div>
                          <div className="text-[13px] text-muted truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={cx(rowCell, 'hidden sm:table-cell num text-muted whitespace-nowrap')}>{u.createdAt ? format(new Date(u.createdAt), 'yyyy-MM-dd') : '—'}</td>
                    <td className={rowCell}><Pill>{u.role === 'admin' ? 'Admin' : 'Member'}</Pill></td>
                    <td className={cx(rowCell, 'text-right')}>
                      {u.id !== user?.id && (
                        <button type="button" onClick={() => handleDeleteUser(u.id)} className={cx(buttonStyles.ghost, 'h-8 px-3 text-muted hover:text-negative hover:bg-neg-bg')}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={cx(cardStyles, 'overflow-hidden')}>
          <h2 className="text-base font-medium px-5 pt-5 pb-3">Projects</h2>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className={headCell}>Project</th>
                  <th className={cx(headCell, 'hidden sm:table-cell')}>Posted</th>
                  <th className={headCell}>Status</th>
                  <th className={headCell}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className={cx(rowCell, 'text-muted')}>Loading projects…</td></tr>
                ) : projects.length === 0 ? (
                  <tr><td colSpan={4} className={cx(rowCell, 'text-muted')}>No projects have been posted.</td></tr>
                ) : projects.map(p => (
                  <tr key={p.id}>
                    <td className={cx(rowCell, 'max-w-0 w-full')}>
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-[13px] text-muted truncate">{p.ownerId?.name ? `by ${p.ownerId.name}` : 'Owner deleted'}</div>
                    </td>
                    <td className={cx(rowCell, 'hidden sm:table-cell num text-muted whitespace-nowrap')}>{format(new Date(p.createdAt), 'yyyy-MM-dd')}</td>
                    <td className={rowCell}><Pill tone={projectStatusTone(p.status)}>{p.status}</Pill></td>
                    <td className={cx(rowCell, 'text-right')}>
                      <button type="button" onClick={() => handleDeleteProject(p.id)} className={cx(buttonStyles.ghost, 'h-8 px-3 text-muted hover:text-negative hover:bg-neg-bg')}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
