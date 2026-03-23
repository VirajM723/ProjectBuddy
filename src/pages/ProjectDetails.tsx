import { useState, useEffect } from 'react';
import { Project, UserProfile, CollaborationRequest } from '../types';
import { useAuth } from '../App';
import { Calendar, Users, Tag, Briefcase, Clock, Send, CheckCircle, XCircle, Github, Linkedin } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { projectService, userService, collaborationService, logService } from '../services/api';

interface ProjectDetailsProps {
  projectId: string;
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

export function ProjectDetails({ projectId, navigate }: ProjectDetailsProps) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<CollaborationRequest | null>(null);
  const [requests, setRequests] = useState<CollaborationRequest[]>([]);
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const projectData = await projectService.getById(projectId);
        setProject(projectData);

        // Fetch owner
        const ownerId = typeof projectData.ownerId === 'string' ? projectData.ownerId : projectData.ownerId?.id || projectData.ownerId?._id;
        if (ownerId) {
          const ownerData = await userService.getProfile(ownerId);
          setOwner(ownerData);
        }

        // If owner, fetch all requests
        if (user && (projectData.ownerId === user.id || projectData.ownerId?.id === user.id || projectData.ownerId?._id === user.id)) {
          const allReqs = await collaborationService.getByProject(projectId);
          setRequests(allReqs);

          // Fetch profiles for requesters
          const profiles: Record<string, UserProfile> = {};
          for (const req of allReqs) {
            const reqUserId = typeof req.userId === 'string' ? req.userId : req.userId?.id || req.userId?._id;
            if (reqUserId && !profiles[reqUserId]) {
              const uData = await userService.getProfile(reqUserId);
              profiles[reqUserId] = uData;
            }
          }
          setRequesterProfiles(profiles);
        }

        // Check for existing request from current user
        if (user) {
          const myReq = await collaborationService.getMyRequest(projectId);
          if (myReq) {
            setExistingRequest(myReq);
          }
        }
      } catch (err) {
        console.error("Error fetching project details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, user]);

  const handleApply = async () => {
    if (!user || !project) return;
    setIsSubmitting(true);
    try {
      const newRequest = await collaborationService.create({
        projectId,
        message: requestMessage,
      });
      setExistingRequest(newRequest);
      setRequestMessage('');
      
      // Update project locally to show user as applicant
      setProject({
        ...project,
        applicants: [...(project.applicants || []), user.id]
      });
    } catch (err) {
      console.error("Application error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAction = async (requestId: string, requesterId: string, action: 'Accepted' | 'Rejected') => {
    try {
      await collaborationService.updateStatus(requestId, action);
      
      // Update local state
      setRequests(requests.map(r => r.id === requestId ? { ...r, status: action } : r));
      
      if (action === 'Accepted') {
        const updatedProject = {
          ...project!,
          acceptedUsers: [...(project!.acceptedUsers || []), requesterProfiles[requesterId] || requesterId]
        };
        setProject(updatedProject);

        // Log contribution for the accepted user
        // In a real app, the backend should handle this, but we'll do it here for consistency with original logic
        await logService.create({
          projectId,
          contributionType: 'Joined',
        });
      }
    } catch (err) {
      console.error("Request action error:", err);
    }
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    try {
      await projectService.update(projectId, { status: newStatus });
      setProject({ ...project!, status: newStatus });
    } catch (err) {
      console.error("Status change error:", err);
    }
  };

  if (loading) return <div className="animate-pulse space-y-8"><div className="h-64 bg-slate-200 rounded-3xl"></div></div>;
  if (!project) return <div className="text-center py-20">Project not found.</div>;

  const projectOwnerId = typeof project.ownerId === 'string' ? project.ownerId : (project.ownerId as any)?.id || (project.ownerId as any)?._id;
  const isOwner = user?.id === projectOwnerId;
  const isAccepted = project.acceptedUsers?.some((c: any) => {
    const cid = typeof c === 'string' ? c : c?.id || c?._id;
    return cid === user?.id;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900">{project.title}</h1>
            <div className="flex items-center gap-4">
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <select 
                    value={project.status}
                    onChange={(e) => handleStatusChange(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Open', 'Ongoing', 'Completed', 'Closed', 'Reopened'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  project.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {project.status}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-slate-500 text-sm mb-8">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <span>Posted {format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              <span>{project.projectType}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              <span>{project.commitmentLevel} commitment</span>
            </div>
          </div>

          <div className="prose prose-indigo max-w-none">
            <h3 className="text-xl font-bold mb-4">Description</h3>
            <div className="text-slate-600 leading-relaxed">
              <Markdown>{project.description}</Markdown>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <h3 className="text-xl font-bold mb-4">Tech Stack</h3>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map(tech => (
                <span key={tech} className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <h3 className="text-xl font-bold mb-4">Required Roles</h3>
            <div className="flex flex-wrap gap-2">
              {project.requiredRoles.map(role => (
                <span key={role} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100 text-sm font-medium">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Requests Section for Owner */}
        {isOwner && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Collaboration Requests
            </h3>
            <div className="space-y-4">
              {requests.length > 0 ? (
                requests.map(req => (
                  <div key={req.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const reqUserId = typeof req.userId === 'string' ? req.userId : req.userId?.id || req.userId?._id;
                          const profile = typeof req.userId === 'string' ? requesterProfiles[reqUserId] : req.userId;
                          return (
                            <button 
                              onClick={() => navigate('profile', reqUserId)}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                              <img 
                                src={profile?.profileImage || `https://picsum.photos/seed/${reqUserId}/32/32`} 
                                className="w-8 h-8 rounded-full border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                              <span className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                                {profile?.name || 'Loading...'}
                              </span>
                            </button>
                          );
                        })()}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          req.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                          req.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      {(() => {
                        const profile = typeof req.userId === 'string' ? requesterProfiles[req.userId] : req.userId;
                        if (!profile) return null;
                        return (
                          <div className="space-y-1">
                            {profile.bio && <p className="text-xs text-slate-500 line-clamp-1">{profile.bio}</p>}
                            {profile.skills && profile.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {profile.skills.slice(0, 3).map((s: string) => (
                                  <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                                    {s}
                                  </span>
                                ))}
                                {profile.skills.length > 3 && <span className="text-[10px] text-slate-400">+{profile.skills.length - 3} more</span>}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <p className="text-slate-600 text-sm italic">"{req.message}"</p>
                    </div>
                    {req.status === 'Pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            const reqUserId = typeof req.userId === 'string' ? req.userId : req.userId?.id || req.userId?._id;
                            handleRequestAction(req.id, reqUserId, 'Accepted');
                          }}
                          className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Accept
                        </button>
                        <button 
                          onClick={() => {
                            const reqUserId = typeof req.userId === 'string' ? req.userId : req.userId?.id || req.userId?._id;
                            handleRequestAction(req.id, reqUserId, 'Rejected');
                          }}
                          className="flex items-center gap-1 bg-white text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-4">No requests yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-8">
        {/* Owner Info */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Project Owner</h3>
          <button 
            onClick={() => owner && navigate('profile', owner.id)}
            className="group block w-full text-center"
          >
            <img 
              src={owner?.profileImage || `https://picsum.photos/seed/${owner?.id}/80/80`} 
              alt={owner?.name} 
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-100 group-hover:border-indigo-600 transition-all"
              referrerPolicy="no-referrer"
            />
            <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{owner?.name || 'Loading...'}</h4>
          </button>
          {project.userRoles?.[project.ownerId] && (
            <div className="mb-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">
                {project.userRoles[project.ownerId]}
              </span>
            </div>
          )}
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">{owner?.bio}</p>
          <div className="flex justify-center gap-3">
            {owner?.githubLink && <a href={owner.githubLink} target="_blank" className="p-2 bg-slate-50 rounded-full text-slate-600 hover:text-indigo-600 transition-colors"><Github className="w-5 h-5" /></a>}
            {owner?.linkedinLink && <a href={owner.linkedinLink} target="_blank" className="p-2 bg-slate-50 rounded-full text-slate-600 hover:text-indigo-600 transition-colors"><Linkedin className="w-5 h-5" /></a>}
          </div>
        </div>

        {/* Project Team */}
        {project.acceptedUsers && project.acceptedUsers.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Project Team</h3>
            <div className="space-y-4">
              {project.acceptedUsers.map((u: any) => {
                const uid = typeof u === 'string' ? u : u?.id || u?._id;
                const name = typeof u === 'string' ? 'User' : u?.name || 'User';
                const profileImage = typeof u === 'string' ? null : u?.profileImage;

                return (
                  <div key={uid} className="flex items-center justify-between">
                    <button 
                      onClick={() => navigate('profile', uid)}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left group"
                    >
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          className="w-10 h-10 rounded-full border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {name[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{name}</p>
                        <p className="text-xs text-slate-500">Collaborator</p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Card */}
        <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100">
          {!user ? (
            <div className="text-center space-y-4">
              <p className="font-medium">Sign in to collaborate on this project.</p>
              <button onClick={() => navigate('home')} className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors">
                Sign In
              </button>
            </div>
          ) : isOwner ? (
            <div className="text-center space-y-4">
              <p className="font-medium">You are the owner of this project.</p>
              <button onClick={() => navigate('create')} className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-400 transition-colors">
                Edit Project
              </button>
            </div>
          ) : isAccepted ? (
            <div className="text-center space-y-4">
              <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="font-bold text-xl">You're in!</p>
              <p className="text-indigo-100 text-sm">You are an accepted collaborator for this project.</p>
            </div>
          ) : existingRequest ? (
            <div className="text-center space-y-4">
              <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <p className="font-bold">Request {existingRequest.status}</p>
              <p className="text-indigo-100 text-sm">Your application is currently being reviewed by the owner.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Interested in joining?</h3>
              <textarea 
                placeholder="Tell the owner why you're a good fit..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="w-full bg-indigo-700/50 border border-indigo-400/30 rounded-xl p-3 text-sm placeholder:text-indigo-300 outline-none focus:ring-2 focus:ring-white/50 min-h-[100px]"
              />
              <button 
                onClick={handleApply}
                disabled={isSubmitting || !requestMessage.trim()}
                className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Request to Collaborate'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
