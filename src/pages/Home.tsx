import { useState, useEffect } from 'react';
import { Project } from '../types';
import { ProjectRow, projectGrid } from '../components/ProjectRow';
import { Search, MapPin, Plus } from 'lucide-react';
import { projectService } from '../services/api';
import { Button, Notice, cardStyles, cx, isRecruiting, openRoles } from '../components/ui';

interface HomeProps {
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

type StatusFilter = 'All' | 'Open' | 'Ongoing' | 'Completed';
const STATUS_FILTERS: StatusFilter[] = ['All', 'Open', 'Ongoing', 'Completed'];
const isOpen = (p: Project) => p.status === 'Open' || p.status === 'Reopened';
const matchesStatus = (p: Project, status: StatusFilter) =>
  status === 'All' || (status === 'Open' ? isOpen(p) : p.status === status);

export function Home({ navigate }: HomeProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');

  // Geolocation and H3 filtering states
  const [geoFilter, setGeoFilter] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const toggleGeoFilter = () => {
    if (!geoFilter) {
      setGeoLoading(true);
      setGeoError(null);

      if (!navigator.geolocation) {
        setGeoError('Geolocation is not supported by your browser.');
        setGeoLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoords(userCoords);
          setGeoFilter(true);
          setGeoLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errMsg = 'Location access denied or unavailable.';
          if (error.code === error.PERMISSION_DENIED) {
            errMsg = 'Allow location permissions to filter projects near you.';
          }
          setGeoError(errMsg);
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoFilter(false);
      setCoords(null);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await projectService.getAll(coords || undefined);
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [coords, reloadKey]);

  const term = searchTerm.trim().toLowerCase();
  const searched = projects.filter(p =>
    !term ||
    p.title.toLowerCase().includes(term) ||
    p.summary.toLowerCase().includes(term) ||
    p.techStack.some(t => t.toLowerCase().includes(term)) ||
    p.requiredRoles.some(r => r.toLowerCase().includes(term))
  );
  const filteredProjects = searched.filter(p => matchesStatus(p, filterStatus));

  // The finding under the title: how many projects still need people, and for how many roles
  const openProjects = projects.filter(isRecruiting);
  const rolesOpen = openProjects.reduce((sum, p) => sum + openRoles(p).length, 0);
  const summary = projects.length === 0
    ? geoFilter ? 'No projects posted near you yet.' : 'No projects posted yet.'
    : `${openProjects.length} of ${projects.length} projects looking for people · ${rolesOpen} ${rolesOpen === 1 ? 'role' : 'roles'} open${geoFilter ? ' near you' : ''}`;

  return (
    <div>
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.01em]">Projects</h1>
          <p className="text-muted mt-1 num">{loading ? ' ' : summary}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('create')}>
          <Plus className="w-4 h-4" strokeWidth={2} />
          Post a project
        </Button>
      </div>

      {/* Filters: search and status on the left, location on the right; on a phone search and location share a row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative block flex-1 min-w-0 lg:flex-none lg:w-80">
          <span className="sr-only">Search projects</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" strokeWidth={1.5} />
          <input
            type="search"
            placeholder="Search by name, stack or role"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-surface border border-control rounded-md text-sm outline-none focus:border-ink"
          />
        </label>

        <button
          type="button"
          onClick={toggleGeoFilter}
          disabled={geoLoading}
          aria-pressed={geoFilter}
          className={cx(
            'order-2 lg:order-3 lg:ml-auto flex flex-none items-center gap-1.5 h-9 px-3 rounded-md text-sm border bg-surface text-ink transition-colors',
            geoFilter ? 'border-ink font-medium' : 'border-control hover:border-ink'
          )}
        >
          <MapPin className="w-4 h-4" strokeWidth={1.5} />
          {geoLoading ? 'Finding you…' : geoFilter ? 'Near me · on' : 'Near me'}
        </button>

        <div className="order-3 lg:order-2 w-full lg:w-auto overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div role="group" aria-label="Filter by status" className="inline-flex items-center h-9 p-0.5 bg-raised rounded-md">
            {STATUS_FILTERS.map((status) => {
              const count = searched.filter(p => matchesStatus(p, status)).length;
              const active = filterStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilterStatus(status)}
                  className={cx(
                    'h-8 px-3 rounded-[5px] text-sm whitespace-nowrap transition-colors',
                    active ? 'bg-surface text-ink font-medium' : 'text-muted hover:text-ink'
                  )}
                >
                  {status} <span className={cx('num', active ? 'text-muted' : '')}>{loading ? '' : count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {geoError && (
        <div className="mt-3">
          <Notice onDismiss={() => setGeoError(null)}>{geoError}</Notice>
        </div>
      )}

      {/* Project list */}
      <section aria-label="Projects" className={cx(cardStyles, 'mt-4 overflow-hidden')}>
        <div className={cx('hidden lg:grid px-5 h-10 items-center text-xs text-muted border-b border-line', projectGrid)}>
          <span>Project</span>
          <span>Team</span>
          <span>Stack and time</span>
          <span>Status</span>
          <span className="text-right">Posted</span>
        </div>

        {loading ? (
          <ul aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className={cx('px-4 lg:px-5 py-3.5 border-t border-rule first:border-t-0', projectGrid)}>
                <div>
                  <div className="h-4 w-56 max-w-full bg-raised rounded" />
                  <div className="h-4 w-80 max-w-full bg-raised rounded mt-1" />
                </div>
                <div className="hidden lg:block h-4 w-32 bg-raised rounded" />
                <div className="hidden lg:block h-4 w-36 bg-raised rounded" />
                <div className="hidden lg:block h-5 w-14 bg-raised rounded" />
                <div className="hidden lg:block h-4 w-20 bg-raised rounded ml-auto" />
              </li>
            ))}
          </ul>
        ) : loadError ? (
          <div className="px-5 py-4 text-sm">
            Couldn't load projects.{' '}
            <button type="button" className="font-medium underline underline-offset-2" onClick={() => setReloadKey(k => k + 1)}>
              Retry
            </button>
          </div>
        ) : filteredProjects.length > 0 ? (
          <ul>
            {filteredProjects.map(project => (
              <ProjectRow key={project.id} project={project} onOpen={() => navigate('project', project.id)} />
            ))}
          </ul>
        ) : (
          <div className="px-5 py-4 text-sm text-muted">
            {projects.length === 0 ? (
              <>Nobody has posted a project{geoFilter ? ' near you' : ''} yet. <button type="button" className="text-ink font-medium underline underline-offset-2" onClick={() => navigate('create')}>Post the first one</button></>
            ) : (
              <>No {filterStatus === 'All' ? '' : `${filterStatus.toLowerCase()} `}projects match{term ? ` “${searchTerm.trim()}”` : ''}.{' '}
                <button type="button" className="text-ink font-medium underline underline-offset-2" onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
