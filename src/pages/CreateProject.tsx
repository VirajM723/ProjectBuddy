import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { isSameDay } from 'date-fns';
import { projectService, getId, getErrorMessage } from '../services/api';
import { Button, ErrorText, Notice, cardStyles, cx, inputStyles, labelStyles } from '../components/ui';

interface CreateProjectProps {
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
  projectId?: string; // When set, the form edits this existing project
}

export function CreateProject({ navigate, projectId }: CreateProjectProps) {
  const isEditing = !!projectId;
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    description: '',
    techStack: '',
    requiredRoles: '',
    commitmentLevel: 'Low (1-5 hrs/week)',
    projectType: 'Side Project'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitReached, setRateLimitReached] = useState(false);

  // Opt-in Location States
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(isEditing);

  // Load the existing project when editing
  useEffect(() => {
    if (!projectId) return;
    const loadProject = async () => {
      setLoadingProject(true);
      try {
        const p = await projectService.getById(projectId);
        if (getId(p.ownerId) !== user?.id) {
          setError('Only the project owner can edit this project.');
          return;
        }
        setFormData({
          title: p.title || '',
          summary: p.summary || '',
          description: p.description || '',
          techStack: (p.techStack || []).join(', '),
          requiredRoles: (p.requiredRoles || []).join(', '),
          commitmentLevel: p.commitmentLevel || 'Low (1-5 hrs/week)',
          projectType: p.projectType || 'Side Project',
        });
        if (p.locationName || p.locationCoords?.lat != null) {
          setIncludeLocation(true);
          setLocationName(p.locationName || '');
          setLocationCoords(p.locationCoords?.lat != null ? p.locationCoords : null);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load project.'));
      } finally {
        setLoadingProject(false);
      }
    };
    loadProject();
  }, [projectId, user?.id]);

  useEffect(() => {
    const checkRateLimit = async () => {
      if (!user || isEditing) return;
      try {
        // Fetch all projects and filter for user's projects created today
        // In a real app, this should be a backend check
        const projects = await projectService.getAll();
        const myProjects = projects.filter((p: any) => getId(p.ownerId) === user.id);
        const todayProjects = myProjects.filter((p: any) => isSameDay(new Date(p.createdAt), new Date()));
        
        if (todayProjects.length >= 5) {
          setRateLimitReached(true);
        }
      } catch (err) {
        console.error("Rate limit check failed:", err);
      }
    };
    checkRateLimit();
  }, [user, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (rateLimitReached && !isEditing)) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const projectData = {
        title: formData.title,
        summary: formData.summary,
        description: formData.description,
        techStack: formData.techStack.split(',').map(s => s.trim()).filter(Boolean),
        requiredRoles: formData.requiredRoles.split(',').map(s => s.trim()).filter(Boolean),
        commitmentLevel: formData.commitmentLevel,
        projectType: formData.projectType,
        locationName: includeLocation ? locationName : '',
        // null clears any saved location when editing
        locationCoords: includeLocation && locationCoords ? locationCoords : null,
      };

      // The server records the owner's "Joined" contribution when a project is created
      const saved = isEditing
        ? await projectService.update(projectId!, projectData)
        : await projectService.create(projectData);

      navigate('project', saved.id);
    } catch (err: any) {
      console.error("Project save failed:", err);
      setError(getErrorMessage(err, `Failed to ${isEditing ? 'update' : 'create'} project. Please try again.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationToggle = (checked: boolean) => {
    setIncludeLocation(checked);
    if (checked && !navigator.geolocation) {
      setLocationCoords(null);
    } else if (checked) {
      setLocLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coarseLat = Math.round(position.coords.latitude * 10) / 10;
          const coarseLng = Math.round(position.coords.longitude * 10) / 10;
          setLocationCoords({
            lat: coarseLat,
            lng: coarseLng
          });
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coarseLat}&lon=${coarseLng}&zoom=10`, {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'Project-Buddy-Developer'
              }
            });
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.county || '';
            if (city) {
              setLocationName(city);
            }
          } catch (gerr) {
            console.error('Nominatim reverse geocode failed:', gerr);
          }
          setLocLoading(false);
        },
        (err) => {
          console.error('GPS auto-fill failed:', err);
          setLocLoading(false);
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    } else {
      setLocationName('');
      setLocationCoords(null);
    }
  };

  if (!user) return <p className="text-muted">Sign in to post a project.</p>;
  if (loadingProject) {
    return (
      <div aria-busy="true">
        <div className="h-7 w-56 bg-raised rounded" />
        <div className={cx(cardStyles, 'h-96 mt-8')} />
      </div>
    );
  }

  const blocked = rateLimitReached && !isEditing;
  const cancel = () => (isEditing ? navigate('project', projectId) : navigate('home'));

  return (
    <div className="max-w-[1152px]">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">{isEditing ? 'Edit project' : 'Post a project'}</h1>
      <p className="text-muted mt-1">
        {isEditing ? 'Changes show on the project page as soon as you save.' : 'Describe the idea and the people you need. It goes live in the project list straight away.'}
      </p>

      {blocked && (
        <div className="mt-6">
          <Notice>You've posted 5 projects today, the daily limit. You can post again tomorrow.</Notice>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        <FormSection title="The idea" description="The title and summary are what people see in the project list. The description supports Markdown.">
          <div>
            <label htmlFor="cp-title" className={labelStyles}>Title</label>
            <input
              id="cp-title"
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={120}
              placeholder="Campus ride-share board"
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="cp-summary" className={labelStyles}>Summary</label>
            <input
              id="cp-summary"
              required
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              maxLength={300}
              placeholder="One sentence on what it does and who it is for"
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="cp-description" className={labelStyles}>Description</label>
            <textarea
              id="cp-description"
              required
              rows={8}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={'## The problem\n\n## What exists so far\n\n## What you need help with'}
              className={cx(inputStyles, 'h-auto py-2 leading-5 resize-y min-h-48')}
            />
          </div>
        </FormSection>

        <FormSection title="Team and stack" description="Each role you list shows as an open seat until someone with that role joins the team.">
          <div>
            <label htmlFor="cp-roles" className={labelStyles}>Roles you need</label>
            <input
              id="cp-roles"
              required
              type="text"
              aria-describedby="cp-roles-note"
              value={formData.requiredRoles}
              onChange={(e) => setFormData({ ...formData, requiredRoles: e.target.value })}
              placeholder="Backend developer, UI designer"
              className={inputStyles}
            />
            <p id="cp-roles-note" className="text-xs text-muted mt-1.5">Separate roles with commas.</p>
          </div>
          <div>
            <label htmlFor="cp-stack" className={labelStyles}>Stack</label>
            <input
              id="cp-stack"
              required
              type="text"
              aria-describedby="cp-stack-note"
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              placeholder="React, Node.js, MongoDB"
              className={inputStyles}
            />
            <p id="cp-stack-note" className="text-xs text-muted mt-1.5">Separate tools with commas.</p>
          </div>
        </FormSection>

        <FormSection title="Time and type" description="Helps people judge whether they can commit before they ask to join.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cp-commitment" className={labelStyles}>Time each week</label>
              <select
                id="cp-commitment"
                value={formData.commitmentLevel}
                onChange={(e) => setFormData({ ...formData, commitmentLevel: e.target.value })}
                className={inputStyles}
              >
                <option>Low (1-5 hrs/week)</option>
                <option>Medium (5-15 hrs/week)</option>
                <option>High (15+ hrs/week)</option>
                <option>Full-time</option>
              </select>
            </div>
            <div>
              <label htmlFor="cp-type" className={labelStyles}>Kind of project</label>
              <select
                id="cp-type"
                value={formData.projectType}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                className={inputStyles}
              >
                <option>Side Project</option>
                <option>Startup</option>
                <option>Open Source</option>
                <option>Non-Profit</option>
              </select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Location" description="Optional. People nearby find the project with Near me. Only the city and a point rounded to about 10 km are saved.">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Show the project to people nearby</span>
              <span className="block text-sm text-muted mt-0.5">Your browser will ask for your location once.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={includeLocation}
              onChange={(e) => handleLocationToggle(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative mt-0.5 w-8 h-[18px] flex-none rounded-full bg-control transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-3.5"
            />
          </label>

          {includeLocation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cp-city" className={labelStyles}>City or area</label>
                <input
                  id="cp-city"
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Pune"
                  className={inputStyles}
                />
              </div>
              <div>
                <span className={labelStyles}>Saved point</span>
                <p className="h-10 flex items-center text-sm" aria-live="polite">
                  {locLoading ? (
                    <span className="text-muted">Finding your location…</span>
                  ) : locationCoords ? (
                    <span className="num">{locationCoords.lat.toFixed(1)}, {locationCoords.lng.toFixed(1)} <span className="text-muted">(rounded)</span></span>
                  ) : (
                    <span className="text-muted">No location access. People can still find it by city.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </FormSection>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-6 border-t border-line">
          {error && <div className="sm:mr-auto"><ErrorText>{error}</ErrorText></div>}
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || blocked}>
            {isSubmitting ? (isEditing ? 'Saving…' : 'Posting…') : (isEditing ? 'Save changes' : 'Post project')}
          </Button>
        </div>
      </form>
    </div>
  );
}

// A settings row: what the section is for on the left, its fields in a panel on the right
function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 lg:gap-12 py-8 border-t border-line first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted mt-1">{description}</p>
      </div>
      <div className={cx(cardStyles, 'p-5 space-y-4')}>{children}</div>
    </section>
  );
}
