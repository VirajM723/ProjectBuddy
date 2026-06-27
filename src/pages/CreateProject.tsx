import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Rocket, Tag, Users, Clock, Briefcase, AlertCircle, CheckCircle, Compass } from 'lucide-react';
import { isSameDay } from 'date-fns';
import { projectService, logService } from '../services/api';

interface CreateProjectProps {
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

export function CreateProject({ navigate }: CreateProjectProps) {
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

  useEffect(() => {
    const checkRateLimit = async () => {
      if (!user) return;
      try {
        // Fetch all projects and filter for user's projects created today
        // In a real app, this should be a backend check
        const projects = await projectService.getAll();
        const myProjects = projects.filter((p: any) => p.ownerId === user.id || p.ownerId?.id === user.id || p.ownerId?._id === user.id);
        const todayProjects = myProjects.filter((p: any) => isSameDay(new Date(p.createdAt), new Date()));
        
        if (todayProjects.length >= 5) {
          setRateLimitReached(true);
        }
      } catch (err) {
        console.error("Rate limit check failed:", err);
      }
    };
    checkRateLimit();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rateLimitReached) return;
    
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
        status: 'Open' as const,
        locationName: includeLocation ? locationName : undefined,
        locationCoords: includeLocation && locationCoords ? locationCoords : undefined,
      };

      const newProject = await projectService.create(projectData);

      // Add contribution log for owner
      await logService.create({
        projectId: newProject.id,
        contributionType: 'Joined',
      });

      navigate('project', newProject.id);
    } catch (err: any) {
      console.error("Project creation failed:", err);
      setError(err.response?.data?.message || 'Failed to create project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className="text-center py-20">Please sign in to post a project.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white">
            <Rocket className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Post a Project</h1>
            <p className="text-slate-500">Share your idea and find collaborators.</p>
          </div>
        </div>

        {rateLimitReached && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 mb-8">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-800">Daily limit reached</h4>
              <p className="text-amber-700 text-sm">You've reached the limit of 5 projects per day. Please try again tomorrow.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Project Title</label>
            <input 
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. AI-Powered Task Manager"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Short Summary</label>
            <input 
              required
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="A brief one-liner about your project"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Full Description (Markdown supported)</label>
            <textarea 
              required
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the problem, the solution, and what you're looking for..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[200px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Tech Stack (comma separated)
              </label>
              <input 
                required
                type="text"
                value={formData.techStack}
                onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
                placeholder="React, Firebase, Tailwind..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Required Roles (comma separated)
              </label>
              <input 
                required
                type="text"
                value={formData.requiredRoles}
                onChange={(e) => setFormData({ ...formData, requiredRoles: e.target.value })}
                placeholder="Frontend Dev, UI Designer..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Commitment Level
              </label>
              <select 
                value={formData.commitmentLevel}
                onChange={(e) => setFormData({ ...formData, commitmentLevel: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option>Low (1-5 hrs/week)</option>
                <option>Medium (5-15 hrs/week)</option>
                <option>High (15+ hrs/week)</option>
                <option>Full-time</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Project Type
              </label>
              <select 
                value={formData.projectType}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option>Side Project</option>
                <option>Startup</option>
                <option>Open Source</option>
                <option>Non-Profit</option>
              </select>
            </div>
          </div>

          {/* Opt-in Location */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={includeLocation}
                onChange={(e) => {
                  setIncludeLocation(e.target.checked);
                  if (e.target.checked) {
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
                }}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
              />
              <span className="text-sm font-bold text-slate-800">Attach general location to this project (Opt-in)</span>
            </label>
            
            {includeLocation && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Location Name / Area</label>
                  <input 
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g. Mumbai, Tiruchirappalli, Delhi"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <span className="text-xs font-bold text-slate-600">GPS Location Cell Target</span>
                  <div className="text-sm text-slate-500 py-3 px-4 bg-white border border-slate-200 rounded-xl flex items-center gap-2 min-h-[46px]">
                    {locLoading ? (
                      <span className="text-indigo-600 animate-pulse font-medium flex items-center gap-1.5">
                        <Compass className="w-4 h-4 animate-spin" /> Detecting location...
                      </span>
                    ) : locationCoords ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Proximity Lock: {locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium text-xs">
                        GPS disabled/blocked. Filterable using manual city name only.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button 
            type="submit"
            disabled={isSubmitting || rateLimitReached}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8"
          >
            {isSubmitting ? 'Posting...' : 'Launch Project'}
            <CheckCircle className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
