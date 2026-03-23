import { useState, useEffect } from 'react';
import { UserProfile, ContributionLog, Endorsement, Project } from '../types';
import { useAuth } from '../App';
import { Heatmap } from '../components/Heatmap';
import { Github, Linkedin, ExternalLink, Award, Plus, Trash2, Edit3, Save, X, Phone, Rocket, CheckCircle, XCircle } from 'lucide-react';
import { userService, logService, endorsementService, projectService } from '../services/api';

interface ProfileProps {
  userId?: string;
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

export function Profile({ userId, navigate }: ProfileProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ContributionLog[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [collaborations, setCollaborations] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRoleProjectId, setEditingRoleProjectId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState('');
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [newSkill, setNewSkill] = useState('');
  const [isCollaborator, setIsCollaborator] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (!userId || !user) return;
    if (userId === 'undefined' || userId === 'null') {
      console.warn("Profile: Invalid userId provided:", userId);
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log("Profile: Fetching data for userId:", userId);
        const [profileData, logsData, endorsementsData, allProjects] = await Promise.all([
          userService.getProfile(userId),
          logService.getByUser(userId),
          endorsementService.getByUser(userId),
          projectService.getAll()
        ]);

        setProfile(profileData);
        setEditData(profileData);
        setLogs(logsData);
        setEndorsements(endorsementsData);

        // Filter projects
        const owned = allProjects.filter((p: any) => (p.ownerId === userId || p.ownerId?.id === userId || p.ownerId?._id === userId));
        const collaborated = allProjects.filter((p: any) => 
          p.acceptedUsers?.some((c: any) => (c === userId || c?.id === userId || c?._id === userId))
        );
        
        setUserProjects(owned);
        setCollaborations(collaborated);

        // Check if collaborator
        if (isOwnProfile) {
          setIsCollaborator(true);
        } else {
          const areCollaborators = allProjects.some((p: any) => 
            (p.ownerId === user.id || p.ownerId?.id === user.id || p.ownerId?._id === user.id) && 
            p.acceptedUsers?.some((c: any) => (c === userId || c?.id === userId || c?._id === userId))
          ) || allProjects.some((p: any) => 
            (p.ownerId === userId || p.ownerId?.id === userId || p.ownerId?._id === userId) && 
            p.acceptedUsers?.some((c: any) => (c === user.id || c?.id === user.id || c?._id === user.id))
          );
          setIsCollaborator(areCollaborators);
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, user, isOwnProfile]);

  const handleSave = async () => {
    if (!userId) return;
    try {
      await userService.updateProfile(editData);
      setProfile({ ...profile!, ...editData });
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleAddEndorsement = async (skill: string) => {
    if (!user || !profile || user.id === profile.id) return;
    
    const existing = endorsements.find(e => e.skill === skill && e.endorsedBy === user.id);
    if (existing) return;

    try {
      const newEndorsement = await endorsementService.create({
        skill,
        endorsedUser: profile.id,
      });
      setEndorsements([...endorsements, newEndorsement]);
    } catch (err) {
      console.error("Endorsement error:", err);
    }
  };

  const handleAddSkill = () => {
    if (!newSkill.trim() || editData.skills?.includes(newSkill.trim())) return;
    setEditData({ ...editData, skills: [...(editData.skills || []), newSkill.trim()] });
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setEditData({ ...editData, skills: editData.skills?.filter(s => s !== skill) });
  };

  const handleUpdateRole = async (projectId: string) => {
    if (!user) return;
    try {
      // In MERN version, we'll need a specific endpoint or update the project
      // For now, let's assume we can update the project's userRoles map
      const project = userProjects.find(p => p.id === projectId) || collaborations.find(p => p.id === projectId);
      if (project) {
        const updatedRoles = { ...(project.userRoles || {}), [user.id]: tempRole };
        await projectService.update(projectId, { userRoles: updatedRoles });
        
        // Update local state
        const updateList = (list: Project[]) => list.map(p => p.id === projectId ? { ...p, userRoles: updatedRoles } : p);
        setUserProjects(updateList(userProjects));
        setCollaborations(updateList(collaborations));
      }
      setEditingRoleProjectId(null);
    } catch (err) {
      console.error("Update role error:", err);
    }
  };

  if (loading) return <div className="animate-pulse space-y-8"><div className="h-64 bg-slate-200 rounded-3xl"></div></div>;
  if (!profile) return <div className="text-center py-20">Profile not found.</div>;

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-indigo-600/5"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6">
          <img 
            src={profile.profileImage || `https://picsum.photos/seed/${profile.id}/120/120`} 
            alt={profile.name} 
            className="w-32 h-32 rounded-3xl border-4 border-white shadow-lg object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-extrabold text-slate-900">{profile.name}</h1>
              <span className="text-slate-400 text-sm font-medium">@{profile.email.split('@')[0]}</span>
            </div>
            {isEditing ? (
              <textarea 
                value={editData.bio || ''}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Write a short bio..."
              />
            ) : (
              <p className="text-slate-600 max-w-2xl">{profile.bio || "No bio yet."}</p>
            )}
          </div>
          <div className="flex gap-2">
            {isOwnProfile && (
              isEditing ? (
                <>
                  <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm">
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              )
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
          {isEditing ? (
            <div className="flex flex-col gap-4 w-full max-w-md">
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <Github className="w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={editData.githubLink || ''} 
                  onChange={(e) => setEditData({ ...editData, githubLink: e.target.value })}
                  placeholder="GitHub URL"
                  className="bg-transparent outline-none text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <Linkedin className="w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={editData.linkedinLink || ''} 
                  onChange={(e) => setEditData({ ...editData, linkedinLink: e.target.value })}
                  placeholder="LinkedIn URL"
                  className="bg-transparent outline-none text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <ExternalLink className="w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={editData.resumeLink || ''} 
                  onChange={(e) => setEditData({ ...editData, resumeLink: e.target.value })}
                  placeholder="Resume/Portfolio URL"
                  className="bg-transparent outline-none text-sm flex-1"
                />
              </div>
              {isOwnProfile && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={editData.phoneNumber || ''} 
                    onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                    placeholder="Contact Number (Visible to collaborators)"
                    className="bg-transparent outline-none text-sm flex-1"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {profile.githubLink && <a href={profile.githubLink} target="_blank" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium text-sm"><Github className="w-5 h-5" /> GitHub</a>}
              {profile.linkedinLink && <a href={profile.linkedinLink} target="_blank" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium text-sm"><Linkedin className="w-5 h-5" /> LinkedIn</a>}
              {profile.resumeLink && <a href={profile.resumeLink} target="_blank" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium text-sm"><ExternalLink className="w-5 h-5" /> Portfolio</a>}
              {profile.phoneNumber && (
                <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
                  <Phone className="w-5 h-5 text-indigo-600" /> 
                  {profile.phoneNumber}
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase font-bold">Collaborator Only</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contribution Heatmap */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900 px-2">Contribution Activity</h3>
        <Heatmap logs={logs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Skills & Endorsements */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            Skills & Endorsements
          </h3>
          
          {isEditing && (
            <div className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleAddSkill} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="space-y-6">
            {(isEditing ? editData.skills : profile.skills)?.map(skill => {
              const skillEndorsements = endorsements.filter(e => e.skill === skill);
              const hasEndorsed = skillEndorsements.some(e => e.endorsedBy === user?.id);

              return (
                <div key={skill} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-bold text-slate-700">
                      {skill}
                    </div>
                    <div className="flex -space-x-2">
                      {skillEndorsements.slice(0, 5).map(e => (
                        <div key={e.id} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                          {e.endorsedBy.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {skillEndorsements.length > 5 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          +{skillEndorsements.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <button onClick={() => handleRemoveSkill(skill)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      !isOwnProfile && user && (
                        <button 
                          onClick={() => handleAddEndorsement(skill)}
                          disabled={hasEndorsed}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            hasEndorsed 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          {hasEndorsed ? 'Endorsed' : 'Endorse'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
            {(!isEditing && profile.skills.length === 0) && (
              <p className="text-slate-400 text-center py-8 italic">No skills listed yet.</p>
            )}
          </div>
        </div>

        {/* Projects & Collaborations */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Rocket className="w-6 h-6 text-indigo-600" />
              Projects & Collaborations
            </h3>

            <div className="space-y-8">
              {/* Created Projects */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Created Projects</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userProjects.map(project => {
                    const myRole = project.userRoles?.[userId || ''];
                    const isEditingRole = editingRoleProjectId === project.id;

                    return (
                      <div key={project.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{project.title}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            project.status === 'Open' ? 'bg-emerald-50 text-emerald-600' :
                            project.status === 'Completed' ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{project.summary}</p>
                        
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2">
                            {isEditingRole ? (
                              <div className="flex items-center gap-1">
                                <input 
                                  type="text"
                                  value={tempRole}
                                  onChange={(e) => setTempRole(e.target.value)}
                                  className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                                  placeholder="Your role..."
                                  autoFocus
                                />
                                <button onClick={() => handleUpdateRole(project.id)} className="text-emerald-600 hover:text-emerald-700"><CheckCircle className="w-3 h-3" /></button>
                                <button onClick={() => setEditingRoleProjectId(null)} className="text-red-600 hover:text-red-700"><XCircle className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-medium">Role:</span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                  {myRole || 'Owner'}
                                </span>
                                {isOwnProfile && (
                                  <button 
                                    onClick={() => {
                                      setEditingRoleProjectId(project.id);
                                      setTempRole(myRole || 'Owner');
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => navigate('project', project.id)}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {userProjects.length === 0 && <p className="text-slate-400 text-sm italic col-span-full">No projects created yet.</p>}
                </div>
              </div>

              {/* Collaborations */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Collaborations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {collaborations.map(project => {
                    const myRole = project.userRoles?.[userId || ''];
                    const isEditingRole = editingRoleProjectId === project.id;

                    return (
                      <div key={project.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{project.title}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            project.status === 'Open' ? 'bg-emerald-50 text-emerald-600' :
                            project.status === 'Completed' ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{project.summary}</p>
                        
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2">
                            {isEditingRole ? (
                              <div className="flex items-center gap-1">
                                <input 
                                  type="text"
                                  value={tempRole}
                                  onChange={(e) => setTempRole(e.target.value)}
                                  className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                                  placeholder="Your role..."
                                  autoFocus
                                />
                                <button onClick={() => handleUpdateRole(project.id)} className="text-emerald-600 hover:text-emerald-700"><CheckCircle className="w-3 h-3" /></button>
                                <button onClick={() => setEditingRoleProjectId(null)} className="text-red-600 hover:text-red-700"><XCircle className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-medium">Role:</span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                  {myRole || 'Not set'}
                                </span>
                                {isOwnProfile && (
                                  <button 
                                    onClick={() => {
                                      setEditingRoleProjectId(project.id);
                                      setTempRole(myRole || '');
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => navigate('project', project.id)}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {collaborations.length === 0 && <p className="text-slate-400 text-sm italic col-span-full">No collaborations yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Reputation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <div className="text-2xl font-black text-indigo-600">{logs.length}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">Contributions</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <div className="text-2xl font-black text-emerald-600">{endorsements.length}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">Endorsements</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
