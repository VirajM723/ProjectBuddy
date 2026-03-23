import { Project } from '../types';
import { Calendar, Users, Tag, ArrowRight, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
            {project.title}
          </h3>
          <p className="text-slate-500 text-sm line-clamp-2 mt-1">
            {project.summary}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
          project.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : 
          project.status === 'Ongoing' ? 'bg-blue-50 text-blue-700' : 
          'bg-slate-100 text-slate-600'
        }`}>
          {project.status}
        </span>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {project.techStack.slice(0, 3).map(tech => (
            <span key={tech} className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-1 rounded text-xs border border-slate-100">
              <Tag className="w-3 h-3" />
              {tech}
            </span>
          ))}
          {project.techStack.length > 3 && (
            <span className="text-slate-400 text-xs py-1">+{project.techStack.length - 3} more</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {project.requiredRoles.slice(0, 3).map(role => (
            <span key={role} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs border border-indigo-100">
              <Briefcase className="w-3 h-3" />
              {role}
            </span>
          ))}
          {project.requiredRoles.length > 3 && (
            <span className="text-indigo-400 text-xs py-1">+{project.requiredRoles.length - 3} more</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-4 text-slate-500 text-xs">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDistanceToNow(new Date(project.createdAt))} ago
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {project.acceptedUsers.length} collaborators
          </div>
        </div>
        <div className="text-indigo-600 font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          View Details
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
