import { useState, useEffect } from 'react';
import { UserProfile, ContributionLog, Endorsement, Project } from '../types';
import { useAuth } from '../App';
import { Heatmap } from '../components/Heatmap';
import { Github, Linkedin, ExternalLink, Plus, Trash2, Phone, Camera } from 'lucide-react';
import { subDays } from 'date-fns';
import { userService, logService, endorsementService, projectService, getId, getErrorMessage } from '../services/api';
import { Avatar, Button, ErrorText, Pill, buttonStyles, cardStyles, cx, inputStyles, labelStyles, projectStatusTone } from '../components/ui';

// Downscales an uploaded image to a small square-ish JPEG so profile pictures stay lightweight
function resizeImage(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file does not look like a valid image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Image processing is not supported in this browser'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface ProfileProps {
  userId?: string;
  navigate: (page: 'home' | 'profile' | 'create' | 'admin' | 'project', id?: string) => void;
}

export function Profile({ userId, navigate }: ProfileProps) {
  const { user, updateProfileState } = useAuth();
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        const owned = allProjects.filter((p: any) => getId(p.ownerId) === userId);
        const collaborated = allProjects.filter((p: any) => 
          p.acceptedUsers?.some((c: any) => getId(c) === userId)
        );
        
        setUserProjects(owned);
        setCollaborations(collaborated);
      } catch (err) {
        console.error("Error fetching profile data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSaveError("Please select an image smaller than 10MB.");
      return;
    }

    setSaveError(null);
    resizeImage(file)
      .then(dataUrl => setEditData(prev => ({ ...prev, profileImage: dataUrl })))
      .catch(err => setSaveError(err.message));
  };

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Only send the editable fields
      const { name, bio, profileImage, githubLink, linkedinLink, resumeLink, phoneNumber, skills } = editData;
      const updated = await userService.updateProfile({ name, bio, profileImage, githubLink, linkedinLink, resumeLink, phoneNumber, skills });
      setProfile(updated);
      setEditData(updated);
      setIsEditing(false);
      if (isOwnProfile && updateProfileState) {
        updateProfileState(updated);
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError(getErrorMessage(err, 'Failed to save your profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEndorsement = async (skill: string) => {
    if (!user || !profile || user.id === profile.id) return;
    
    const existing = endorsements.find(e => e.skill === skill && getId(e.endorsedBy) === user.id);
    if (existing) return;

    try {
      const newEndorsement = await endorsementService.create({
        skill,
        endorsedUser: profile.id,
      });
      setEndorsements([...endorsements, newEndorsement]);
    } catch (err) {
      console.error("Endorsement error:", err);
      alert(getErrorMessage(err, 'Failed to endorse this skill.'));
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
      // Owners and collaborators can each set their own role on a project
      const { userRoles } = await projectService.setMyRole(projectId, tempRole.trim());
      const updateList = (list: Project[]) => list.map(p => p.id === projectId ? { ...p, userRoles } : p);
      setUserProjects(updateList);
      setCollaborations(updateList);
      setEditingRoleProjectId(null);
    } catch (err) {
      console.error("Update role error:", err);
      alert(getErrorMessage(err, 'Failed to update your role.'));
    }
  };

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-raised" />
          <div>
            <div className="h-7 w-48 bg-raised rounded" />
            <div className="h-4 w-72 bg-raised rounded mt-2" />
          </div>
        </div>
        <div className={cx(cardStyles, 'h-24 mt-6')} />
        <div className={cx(cardStyles, 'h-48 mt-3')} />
      </div>
    );
  }
  if (!profile) {
    return (
      <div>
        <h1 className="text-2xl font-medium">Profile not found</h1>
        <p className="text-muted mt-1">This account may have been deleted.</p>
      </div>
    );
  }

  // Figures for the strip, all computed from the rows on this screen
  const yearAgo = subDays(new Date(), 364);
  const lastYear = logs.filter(l => new Date(l.date || l.createdAt) >= yearAgo);
  const activeDays = new Set(lastYear.map(l => l.date || l.createdAt.slice(0, 10))).size;
  const projectCount = userProjects.length + collaborations.length;
  const stats = [
    { label: 'Contributions', value: logs.length, note: 'all time' },
    { label: 'Active days', value: activeDays, note: 'in the last year' },
    { label: 'Endorsements', value: endorsements.length, note: `across ${new Set(endorsements.map(e => e.skill)).size} skills` },
    { label: 'Projects', value: projectCount, note: `${userProjects.length} owned · ${collaborations.length} joined` },
  ];

  const skills = (isEditing ? editData.skills : profile.skills) || [];
  const firstName = profile.name.split(' ')[0];

  const projectList = (list: Project[], isOwnerList: boolean) => (
    <ul>
      {list.map(project => {
        const myRole = project.userRoles?.[userId || ''];
        const isEditingRole = editingRoleProjectId === project.id;
        return (
          <li key={project.id} className="py-3 border-t border-rule first:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <a
                href={`/project/${project.id}`}
                onClick={(e) => { e.preventDefault(); navigate('project', project.id); }}
                className="font-medium hover:underline underline-offset-2 min-w-0"
              >
                {project.title}
              </a>
              <Pill tone={projectStatusTone(project.status)}>{project.status}</Pill>
            </div>
            {isEditingRole ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleUpdateRole(project.id); }}
                className="flex items-center gap-2 mt-2"
              >
                <label className="sr-only" htmlFor={`role-${project.id}`}>Your role on {project.title}</label>
                <input
                  id={`role-${project.id}`}
                  type="text"
                  value={tempRole}
                  onChange={(e) => setTempRole(e.target.value)}
                  maxLength={50}
                  placeholder="Your role"
                  className={cx(inputStyles, 'h-8 max-w-56')}
                  autoFocus
                />
                <Button type="submit" variant="secondary" className="h-8 px-3">Save</Button>
                <Button variant="ghost" className="h-8 px-3" onClick={() => setEditingRoleProjectId(null)}>Cancel</Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-0.5 text-sm text-muted">
                <span>{isOwnProfile ? 'Your role' : 'Role'}: <span className="text-ink">{myRole || (isOwnerList ? 'Owner' : 'Not set')}</span></span>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => { setEditingRoleProjectId(project.id); setTempRole(myRole || (isOwnerList ? 'Owner' : '')); }}
                    className="text-ink underline underline-offset-2"
                  >
                    Change
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="relative flex-none group/avatar w-16 h-16">
          <Avatar name={profile.name} src={isEditing ? editData.profileImage : profile.profileImage} size={64} />
          {isEditing && (
            <label
              htmlFor="profile-pic-upload"
              className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center text-white cursor-pointer opacity-0 group-hover/avatar:opacity-100 focus-within:opacity-100 transition-opacity"
              title="Upload a photo"
            >
              <Camera className="w-5 h-5" strokeWidth={1.5} />
              <span className="sr-only">Upload a photo</span>
              <input type="file" id="profile-pic-upload" accept="image/*" onChange={handleFileChange} className="sr-only" />
            </label>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-2xl font-medium tracking-[-0.01em]">{profile.name}</h1>
            <span className="text-muted">@{profile.email.split('@')[0]}</span>
          </div>
          {!isEditing && (
            <>
              <p className={cx('mt-1 max-w-2xl', !profile.bio && 'text-muted')}>{profile.bio || 'No bio yet.'}</p>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm">
                {profile.githubLink && <li><a href={profile.githubLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"><Github className="w-4 h-4 text-muted" strokeWidth={1.5} />GitHub</a></li>}
                {profile.linkedinLink && <li><a href={profile.linkedinLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"><Linkedin className="w-4 h-4 text-muted" strokeWidth={1.5} />LinkedIn</a></li>}
                {profile.resumeLink && <li><a href={profile.resumeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"><ExternalLink className="w-4 h-4 text-muted" strokeWidth={1.5} />Portfolio</a></li>}
                {profile.phoneNumber && (
                  <li className="inline-flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-muted" strokeWidth={1.5} />
                    <span className="num">{profile.phoneNumber}</span>
                    <span className="text-muted">· visible to collaborators</span>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        {isOwnProfile && (
          <div className="flex gap-2 flex-none">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={() => { setIsEditing(false); setEditData(profile); setSaveError(null); }}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save profile'}</Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit profile</Button>
            )}
          </div>
        )}
      </div>

      {saveError && <div className="mt-4"><ErrorText>{saveError}</ErrorText></div>}

      {/* Editing the profile's fields */}
      {isEditing && (
        <section className={cx(cardStyles, 'p-5 mt-6')}>
          <h2 className="text-base font-medium">About you</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="md:col-span-2">
              <label htmlFor="pf-bio" className={labelStyles}>Bio</label>
              <textarea
                id="pf-bio"
                rows={3}
                value={editData.bio || ''}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="What you build and what you want to work on"
                className={cx(inputStyles, 'h-auto py-2 leading-5 resize-y')}
              />
            </div>
            <div>
              <label htmlFor="pf-github" className={labelStyles}>GitHub</label>
              <input id="pf-github" type="url" value={editData.githubLink || ''} onChange={(e) => setEditData({ ...editData, githubLink: e.target.value })} placeholder="https://github.com/you" className={inputStyles} />
            </div>
            <div>
              <label htmlFor="pf-linkedin" className={labelStyles}>LinkedIn</label>
              <input id="pf-linkedin" type="url" value={editData.linkedinLink || ''} onChange={(e) => setEditData({ ...editData, linkedinLink: e.target.value })} placeholder="https://linkedin.com/in/you" className={inputStyles} />
            </div>
            <div>
              <label htmlFor="pf-portfolio" className={labelStyles}>Portfolio or resume</label>
              <input id="pf-portfolio" type="url" value={editData.resumeLink || ''} onChange={(e) => setEditData({ ...editData, resumeLink: e.target.value })} placeholder="https://" className={inputStyles} />
            </div>
            <div>
              <label htmlFor="pf-phone" className={labelStyles}>Phone</label>
              <input id="pf-phone" type="tel" aria-describedby="pf-phone-note" value={editData.phoneNumber || ''} onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })} className={inputStyles} />
              <p id="pf-phone-note" className="text-xs text-muted mt-1.5">Only people on your projects can see it.</p>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="pf-photo" className={labelStyles}>Photo</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="pf-photo"
                  type="text"
                  value={editData.profileImage?.startsWith('data:') ? '' : editData.profileImage || ''}
                  onChange={(e) => setEditData({ ...editData, profileImage: e.target.value })}
                  placeholder="Paste an image link, or upload a file"
                  className={inputStyles}
                />
                <label htmlFor="profile-pic-upload-2" className={cx(buttonStyles.secondary, 'h-10 cursor-pointer')}>
                  <Camera className="w-4 h-4" strokeWidth={1.5} />
                  Upload
                  <input type="file" id="profile-pic-upload-2" accept="image/*" onChange={handleFileChange} className="sr-only" />
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Figures */}
      <section aria-label="Activity summary" className={cx(cardStyles, 'mt-6 grid grid-cols-2 lg:grid-cols-4')}>
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cx(
              'px-5 py-4',
              i % 2 === 1 && 'border-l border-line',
              i >= 2 && 'border-t border-line lg:border-t-0',
              i === 2 && 'lg:border-l'
            )}
          >
            <div className="text-sm text-muted">{stat.label}</div>
            <div className="num text-[30px] leading-9 mt-1">{stat.value.toLocaleString('en-IN')}</div>
            <div className="text-xs text-muted mt-0.5">{stat.note}</div>
          </div>
        ))}
      </section>

      {/* Activity over the year */}
      <section className={cx(cardStyles, 'p-5 mt-3')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-base font-medium">Activity</h2>
          <span className="text-sm text-muted num">{lastYear.length.toLocaleString('en-IN')} contributions in the last year</span>
        </div>
        <Heatmap logs={logs} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3 items-start">
        {/* Skills */}
        <section className={cx(cardStyles, 'p-5')}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-medium">Skills</h2>
            {!isEditing && <span className="text-sm text-muted">Endorsed by people {firstName} has worked with</span>}
          </div>

          {isEditing && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddSkill(); }} className="flex gap-2 mt-4">
              <label htmlFor="new-skill" className="sr-only">Add a skill</label>
              <input
                id="new-skill"
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                maxLength={40}
                placeholder="Add a skill"
                className={inputStyles}
              />
              <Button type="submit" className="h-10"><Plus className="w-4 h-4" strokeWidth={1.5} />Add</Button>
            </form>
          )}

          {skills.length > 0 ? (
            <ul className="mt-3">
              {skills.map(skill => {
                const skillEndorsements = endorsements.filter(e => e.skill === skill);
                const hasEndorsed = skillEndorsements.some(e => getId(e.endorsedBy) === user?.id);
                return (
                  <li key={skill} className="flex items-center gap-3 min-h-12 py-2 border-t border-rule first:border-t-0">
                    <span className="font-medium flex-1 min-w-0 truncate">{skill}</span>
                    <span className="flex -space-x-1">
                      {skillEndorsements.slice(0, 4).map(e => {
                        const endorserName = typeof e.endorsedBy === 'object' ? e.endorsedBy.name : 'Member';
                        return (
                          <span key={e.id} title={endorserName} className="rounded-full ring-2 ring-surface">
                            <Avatar name={endorserName} src={typeof e.endorsedBy === 'object' ? e.endorsedBy.profileImage : null} size={22} />
                          </span>
                        );
                      })}
                    </span>
                    <span className={cx('num text-sm w-6 text-right', skillEndorsements.length === 0 && 'text-muted')}>
                      {skillEndorsements.length}
                    </span>
                    {isEditing ? (
                      <Button variant="danger" className="h-8 px-3" onClick={() => handleRemoveSkill(skill)} aria-label={`Remove ${skill}`}>
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    ) : !isOwnProfile && user ? (
                      hasEndorsed ? (
                        <span className="w-[84px] text-sm text-muted text-right">Endorsed</span>
                      ) : (
                        <button type="button" onClick={() => handleAddEndorsement(skill)} className={cx(buttonStyles.ghost, 'h-8 px-3 w-[84px] border border-control hover:border-ink hover:bg-surface')}>
                          Endorse
                        </button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted mt-3">{isOwnProfile ? 'No skills yet. Add some so project owners can find you.' : 'No skills listed yet.'}</p>
          )}
        </section>

        {/* Projects */}
        <section className={cx(cardStyles, 'p-5')}>
          <h2 className="text-base font-medium">Projects</h2>
          <h3 className="text-xs text-muted mt-4 mb-1">Owns {userProjects.length}</h3>
          {userProjects.length > 0 ? projectList(userProjects, true) : <p className="text-muted py-2">Hasn't posted a project yet.</p>}
          <h3 className="text-xs text-muted mt-5 mb-1">Member of {collaborations.length}</h3>
          {collaborations.length > 0 ? projectList(collaborations, false) : <p className="text-muted py-2">Hasn't joined a team yet.</p>}
        </section>
      </div>
    </div>
  );
}
