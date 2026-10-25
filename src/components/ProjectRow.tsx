import { Project } from '../types';
import { MapPin } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Pill, SeatStrip, isRecruiting, openRoles, projectStatusTone, teamSize } from './ui';

interface ProjectRowProps {
  project: Project;
  onOpen: () => void;
}

// Desktop columns: project, team, stack, status, posted. Must match the header in Home.
export const projectGrid = 'lg:grid lg:grid-cols-[minmax(0,1fr)_232px_200px_92px_112px] lg:gap-6';

function shortCommitment(level: string) {
  const match = level.match(/\(([^)]+)\)/);
  return match ? match[1] : level;
}

export function ProjectRow({ project, onOpen }: ProjectRowProps) {
  const open = openRoles(project);
  const filled = teamSize(project);
  const posted = `${formatDistanceToNowStrict(new Date(project.createdAt))} ago`;

  const roleLine = !isRecruiting(project)
    ? <span className="text-muted">Not taking requests</span>
    : open.length === 0
    ? <span className="text-muted">Every role filled</span>
    : (
      <span className="truncate">
        <span className="text-data font-medium">{open.length} open</span>
        <span className="text-muted"> · {open.join(', ')}</span>
      </span>
    );

  return (
    <li className="border-t border-rule first:border-t-0">
      <a
        href={`/project/${project.id}`}
        onClick={(e) => { e.preventDefault(); onOpen(); }}
        className={`group block px-4 lg:px-5 py-3.5 lg:items-center ${projectGrid}`}
      >
        {/* Project */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium text-ink group-hover:underline underline-offset-2">{project.title}</span>
            <span className="lg:hidden"><Pill tone={projectStatusTone(project.status)}>{project.status}</Pill></span>
          </div>
          <p className="text-muted line-clamp-2 lg:line-clamp-1 mt-0.5">{project.summary}</p>
        </div>

        {/* Team */}
        <div className="mt-2.5 lg:mt-0 min-w-0 flex items-center gap-2 lg:block">
          <SeatStrip filled={filled} open={open.length} />
          <div className="flex min-w-0 lg:mt-1.5 text-sm">{roleLine}</div>
        </div>

        {/* Stack and time */}
        <div className="hidden lg:block min-w-0">
          <div className="truncate">{project.techStack.join(', ')}</div>
          <div className="text-muted truncate mt-0.5">{shortCommitment(project.commitmentLevel)}</div>
        </div>

        <div className="hidden lg:block">
          <Pill tone={projectStatusTone(project.status)}>{project.status}</Pill>
        </div>

        {/* Posted */}
        <div className="hidden lg:block text-right">
          <div className="num whitespace-nowrap">{posted}</div>
          {project.locationName && (
            <div className="text-muted mt-0.5 inline-flex items-center gap-1 justify-end">
              <MapPin className="w-3 h-3" strokeWidth={1.5} />
              {project.locationName}
            </div>
          )}
        </div>

        {/* Phone: the fields from the hidden columns, on one grey line */}
        <p className="lg:hidden mt-1.5 text-muted truncate">
          {[project.techStack.slice(0, 3).join(', '), posted, project.locationName].filter(Boolean).join(' · ')}
        </p>
      </a>
    </li>
  );
}
