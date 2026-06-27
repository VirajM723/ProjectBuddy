import { useState, useEffect } from 'react';
import { Project } from '../types';
import { ProjectCard } from '../components/ProjectCard';
import { Search, Filter, Rocket, Clock, MapPin, Compass, AlertCircle } from 'lucide-react';
import { projectService } from '../services/api';

interface HomeProps {
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

export function Home({ navigate }: HomeProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Ongoing' | 'Completed'>('All');
  
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
      try {
        const data = await projectService.getAll(coords || undefined);
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [coords]);

  const filteredProjects = projects.filter(p => {
    const marchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.techStack.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          p.requiredRoles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return marchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-indigo-600 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Find your next <span className="text-indigo-200">collaboration</span> partner.
          </h1>
          <p className="text-indigo-100 text-lg mb-8 opacity-90">
            Project Buddy is the marketplace for developers, designers, and creators to build together.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => navigate('create')}
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Post a Project
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <Rocket className="w-full h-full transform translate-x-1/4 -translate-y-1/4 rotate-12" />
        </div>
      </section>

      {/* Search and Filter */}
      <div className="space-y-4">
        {geoError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3 text-sm animate-fade-in shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Location Access Issue: </span>
              {geoError}
            </div>
            <button 
              onClick={() => setGeoError(null)} 
              className="text-amber-500 hover:text-amber-700 text-xs font-bold leading-none"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search projects, tech, or roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Geo Filter Button */}
            <button
              onClick={toggleGeoFilter}
              disabled={geoLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                geoFilter 
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-700 font-semibold shadow-sm' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {geoLoading ? (
                <Compass className="w-4 h-4 text-emerald-500 animate-spin" />
              ) : (
                <MapPin className={`w-4 h-4 ${geoFilter ? 'text-emerald-600' : 'text-slate-400'}`} />
              )}
              {geoLoading ? 'Locating...' : geoFilter ? 'Proximity: Near Me' : 'Filter Near Me'}
            </button>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-5 h-5 text-slate-400 mr-1 shrink-0" />
              {['All', 'Open', 'Ongoing', 'Completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    filterStatus === status 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse h-64"></div>
          ))
        ) : filteredProjects.length > 0 ? (
          filteredProjects.map(project => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onClick={() => navigate('project', project.id)} 
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No projects found</h3>
            <p className="text-slate-500">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}
      </div>
    </div>
  );
}
