import { useState, useEffect, useRef } from 'react';
import { Project, UserProfile, CollaborationRequest } from '../types';
import { useAuth } from '../App';
import { Calendar, Users, Tag, Briefcase, Clock, Send, CheckCircle, XCircle, Github, Linkedin, MessageSquare, Plus, Activity, Star } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Markdown from 'react-markdown';
import { projectService, userService, collaborationService, logService, chatService } from '../services/api';
import { io, Socket } from 'socket.io-client';

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="%23DBDBDB"/><circle cx="12" cy="8.5" r="4" fill="%23FFFFFF"/><path d="M12 13.5c-4.4 0-8 2.2-8 5v.5h16v-.5c0-2.8-3.6-5-8-5z" fill="%23FFFFFF"/></svg>';

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

  // Real-time Chat and Milestones states
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'milestones'>('details');
  const [messages, setMessages] = useState<any[]>([]);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fetchMessagesRef = useRef<(() => Promise<void>) | null>(null);
  
  // Progress tracker states (enhanced logging)
  const [projectLogs, setProjectLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logTitle, setLogTitle] = useState('');
  const [logDetails, setLogDetails] = useState('');
  const [logType, setLogType] = useState<'Milestone' | 'Task'>('Milestone');

  const projectOwnerId = project ? (typeof project.ownerId === 'string' ? project.ownerId : (project.ownerId as any)?.id || (project.ownerId as any)?._id) : null;
  const isOwner = user?.id === projectOwnerId;
  const isAccepted = project?.acceptedUsers?.some((c: any) => {
    const cid = typeof c === 'string' ? c : c?.id || c?._id;
    return cid === user?.id;
  }) || false;

  // Socket communication connection setup
  useEffect(() => {
    if (!user || !projectId || !project) return;
    const isTeammate = isOwner || isAccepted;
    if (!isTeammate) return;

    setSocketStatus('connecting');
    const token = localStorage.getItem('token');
    
    // Create socket connection safely pointing to root
    const newSocket = io('/', {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setSocketStatus('connected');
      newSocket.emit('join_project_room', { projectId });
    });

    newSocket.on('room_joined', ({ roomId, messages: pastMsgs }) => {
      setChatRoomId(roomId);
      setMessages(pastMsgs);
    });

    newSocket.on('new_message', (msg) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id || m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    newSocket.on('error_message', (err) => {
      console.error('Socket error received:', err);
    });

    newSocket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [projectId, user?.id, isOwner, isAccepted]);

  // Load milestone timeline
  const fetchProjectLogs = async () => {
    if (!projectId) return;
    setLogsLoading(true);
    try {
      const data = await logService.getByProject(projectId);
      setProjectLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!projectId) return;
    try {
      const data = await chatService.getMessages(projectId);
      setChatRoomId(data.chatRoomId);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  });

  useEffect(() => {
    if (activeTab === 'milestones') {
      fetchProjectLogs();
    } else if (activeTab === 'chat') {
      fetchMessages();

      // Set up a backup poll interval if the websocket is not connected
      const interval = setInterval(() => {
        if (socketStatus !== 'connected' && fetchMessagesRef.current) {
          fetchMessagesRef.current();
        }
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [activeTab, projectId, socketStatus]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async () => {
    const textToSend = newMessageText.trim();
    if (!textToSend || !projectId) return;
    setNewMessageText('');

    try {
      // 1. Post to database via REST (instant, highly reliable)
      const sentMessage = await chatService.sendMessage(projectId, textToSend);

      // 2. Instantly append to local messages array for 0ms visual latency
      setMessages((prev) => {
        if (prev.some(m => m.id === sentMessage.id || m._id === sentMessage._id)) return prev;
        return [...prev, sentMessage];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim() || !projectId) return;

    try {
      await logService.create({
        projectId,
        contributionType: logType,
        title: logTitle.trim(),
        details: logDetails.trim(),
        points: 0
      });
      setLogTitle('');
      setLogDetails('');
      fetchProjectLogs();
    } catch (err) {
      console.error('Failed to post project milestone:', err);
    }
  };

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

        const requesterName = requesterProfiles[requesterId]?.name || 'A teammate';
        // Log contribution for the accepted user
        await logService.create({
          projectId,
          contributionType: 'Joined',
          title: `${requesterName} joined the project`
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

          {/* Tab Header */}
          <div className="flex border-b border-slate-100 mb-6 font-medium gap-6 mt-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-3 px-1 border-b-2 text-sm transition-all ${
                activeTab === 'details' 
                  ? 'border-indigo-600 text-indigo-600 font-bold' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Overview
            </button>
            
            {(isOwner || isAccepted) && (
              <>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`pb-3 px-1 border-b-2 text-sm transition-all flex items-center gap-1.5 ${
                    activeTab === 'chat' 
                      ? 'border-indigo-600 text-indigo-600 font-bold' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Live Workspace Chat
                  <span className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : socketStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
                </button>
                <button
                  onClick={() => setActiveTab('milestones')}
                  className={`pb-3 px-1 border-b-2 text-sm transition-all ${
                    activeTab === 'milestones' 
                      ? 'border-indigo-600 text-indigo-600 font-bold' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Milestones & Progress
                </button>
              </>
            )}
          </div>

          {activeTab === 'details' && (
            <>
              <div className="prose prose-indigo max-w-none">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Description</h3>
                <div className="text-slate-600 leading-relaxed">
                  <Markdown>{project.description}</Markdown>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map(tech => (
                    <span key={tech} className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-medium">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Required Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {project.requiredRoles.map(role => (
                    <span key={role} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100 text-sm font-medium">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 flex flex-col h-[400px] overflow-y-auto space-y-4">
                {messages.length > 0 ? (
                  <>
                    {messages.map((msg, index) => {
                      const isMe = msg.senderId?._id === user?.id || msg.senderId === user?.id || msg.senderId?.id === user?.id;
                      const senderName = msg.senderId?.name || (isMe ? user?.name : 'Partner');
                      const imgUrl = msg.senderId?.profileImage || DEFAULT_AVATAR;

                      return (
                        <div key={msg._id || index} className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <img 
                            src={imgUrl} 
                            alt={senderName} 
                            className="w-8 h-8 rounded-full border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                          <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs font-bold text-slate-700">{senderName}</span>
                              <span className="text-[10px] text-slate-400">
                                {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt)) + ' ago' : ''}
                              </span>
                            </div>
                            <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200/60 rounded-tl-none shadow-sm'}`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="m-auto text-center space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-slate-400 text-sm">No messages yet. Send a note to say hi!</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessageText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-6 pt-2">
              {/* Creator Box: Project Owner can log a Milestone / Task progress */}
              {(isOwner || isAccepted) && (
                <form onSubmit={handleCreateLog} className="bg-slate-50 border border-slate-200/65 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-2.5">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      Add Milestone / Track Task
                    </h4>
                    <div className="flex gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                      {['Milestone', 'Task'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setLogType(type as any)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            logType === type 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-xs font-bold text-slate-600">Progress Title</span>
                      <input 
                        required
                        type="text"
                        value={logTitle}
                        onChange={(e) => setLogTitle(e.target.value)}
                        placeholder="e.g. Completed Database Migrations"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Save
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-600">Additional Details (Optional)</span>
                    <input 
                      type="text"
                      value={logDetails}
                      onChange={(e) => setLogDetails(e.target.value)}
                      placeholder="e.g. Configured mongoose rules, generated cluster hooks..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </form>
              )}

              {/* Progress Timeline Feed */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Star className="w-4 h-4 text-emerald-500" />
                  Project Activity & Milestones Timeline
                </h4>

                {logsLoading ? (
                  <div className="space-y-3 h-24 animate-pulse bg-slate-50 rounded-xl"></div>
                ) : projectLogs.length > 0 ? (
                  <div className="relative border-l border-indigo-100 ml-4 space-y-6 py-2">
                    {projectLogs.map((log, index) => {
                      const logUser = log.userId;
                      const logName = logUser?.name || 'Teammate';
                      const logImg = logUser?.profileImage || DEFAULT_AVATAR;

                      return (
                        <div key={log._id || index} className="relative pl-6">
                          {/* Dot marker */}
                          <span className={`absolute -left-[6.5px] top-1.5 w-3 h-3 rounded-full border bg-white ${
                            log.contributionType === 'Milestone' ? 'border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-100' :
                            log.contributionType === 'Task' ? 'border-emerald-400 bg-emerald-50' : 'border-indigo-400 bg-indigo-50'
                          }`}></span>

                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ${
                                log.contributionType === 'Milestone' ? 'bg-amber-100 text-amber-800' :
                                log.contributionType === 'Task' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {log.contributionType}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {formatDistanceToNow(new Date(log.createdAt))} ago
                              </span>
                            </div>

                            <h5 className="font-bold text-slate-800 text-sm sm:text-base">
                              {log.title || `${logName} joined the project`}
                            </h5>

                            {log.details && (
                              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed bg-white border border-slate-100 rounded-lg p-2">
                                {log.details}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-200/50">
                              <img 
                                src={logImg} 
                                className="w-5 h-5 rounded-full border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-xs font-semibold text-slate-600">{logName}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No milestone or contribution logs tracked yet.
                  </div>
                )}
              </div>
            </div>
          )}
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
                                src={profile?.profileImage || DEFAULT_AVATAR} 
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
              src={owner?.profileImage || DEFAULT_AVATAR} 
              alt={owner?.name} 
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-100 group-hover:border-indigo-600 transition-all bg-white"
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
                      <img 
                        src={profileImage || DEFAULT_AVATAR} 
                        className="w-10 h-10 rounded-full border border-slate-200 bg-white"
                        referrerPolicy="no-referrer"
                      />
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
