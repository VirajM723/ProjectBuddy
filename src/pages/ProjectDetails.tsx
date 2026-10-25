import { useState, useEffect, useRef } from 'react';
import { Project, UserProfile, CollaborationRequest } from '../types';
import { useAuth } from '../App';
import { Send, Github, Linkedin, ChevronLeft } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Markdown from 'react-markdown';
import { projectService, userService, collaborationService, logService, chatService, getId, getErrorMessage } from '../services/api';
import { io, Socket } from 'socket.io-client';
import { Avatar, Button, ErrorText, Pill, SeatStrip, buttonStyles, cardStyles, cx, inputStyles, isRecruiting, labelStyles, openRoles, projectStatusTone, requestStatusTone, seatSummary, teamSize } from '../components/ui';


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
  const [actionError, setActionError] = useState<string | null>(null);

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
  const [logError, setLogError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const projectOwnerId = project ? getId(project.ownerId) : null;
  const isOwner = !!user?.id && user.id === projectOwnerId;
  const isAccepted = project?.acceptedUsers?.some((c: any) => getId(c) === user?.id) || false;

  // Appends a message unless it is already shown (it can arrive via both REST and the socket)
  const appendMessage = (msg: any) => {
    setMessages((prev) => (prev.some(m => getId(m) === getId(msg)) ? prev : [...prev, msg]));
  };

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

    newSocket.on('new_message', appendMessage);

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

  // Keep the newest message in view without scrolling the whole page
  useEffect(() => {
    const list = messagesEndRef.current;
    if (activeTab === 'chat' && list) list.scrollTop = list.scrollHeight;
  }, [messages, activeTab]);

  const handleSendMessage = async () => {
    const textToSend = newMessageText.trim();
    if (!textToSend || !projectId) return;
    setNewMessageText('');
    setChatError(null);

    try {
      // Post via REST (reliable); the server also broadcasts it to teammates over the socket
      const sentMessage = await chatService.sendMessage(projectId, textToSend);
      appendMessage(sentMessage);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore the draft so the user doesn't lose it
      setNewMessageText(textToSend);
      setChatError(getErrorMessage(err, 'Message failed to send.'));
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim() || !projectId) return;
    setLogError(null);

    try {
      await logService.create({
        projectId,
        contributionType: logType,
        title: logTitle.trim(),
        details: logDetails.trim(),
      });
      setLogTitle('');
      setLogDetails('');
      fetchProjectLogs();
    } catch (err) {
      console.error('Failed to post project milestone:', err);
      setLogError(getErrorMessage(err, 'Failed to save progress.'));
    }
  };

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const projectData = await projectService.getById(projectId);
        setProject(projectData);

        const ownerId = getId(projectData.ownerId);
        const viewerIsOwner = !!user && ownerId === user.id;

        // Owner profile, the owner's request inbox (requesters come pre-populated), and our own request
        const [ownerData, allReqs, myReq] = await Promise.all([
          ownerId ? userService.getProfile(ownerId) : Promise.resolve(null),
          viewerIsOwner ? collaborationService.getByProject(projectId) : Promise.resolve([]),
          user && !viewerIsOwner ? collaborationService.getMyRequest(projectId) : Promise.resolve(null),
        ]);
        setOwner(ownerData);
        setRequests(allReqs);
        setExistingRequest(myReq || null);
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
    setActionError(null);
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
      setActionError(getErrorMessage(err, 'Failed to send your request.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAction = async (request: CollaborationRequest, action: 'Accepted' | 'Rejected') => {
    setActionError(null);
    try {
      // The server adds the member and credits their "Joined" contribution
      await collaborationService.updateStatus(request.id, action);
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: action } : r));
      
      if (action === 'Accepted') {
        setProject(prev => prev && ({
          ...prev,
          acceptedUsers: [...(prev.acceptedUsers || []), request.userId]
        }));
      }
    } catch (err) {
      console.error("Request action error:", err);
      setActionError(getErrorMessage(err, 'Failed to update the request.'));
    }
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    setActionError(null);
    try {
      await projectService.update(projectId, { status: newStatus });
      setProject(prev => prev && { ...prev, status: newStatus });
    } catch (err) {
      console.error("Status change error:", err);
      setActionError(getErrorMessage(err, 'Failed to change status.'));
    }
  };

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="h-4 w-20 bg-raised rounded" />
        <div className="h-7 w-80 max-w-full bg-raised rounded mt-4" />
        <div className="h-4 w-96 max-w-full bg-raised rounded mt-2" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 mt-6">
          <div className={cx(cardStyles, 'h-80')} />
          <div className={cx(cardStyles, 'h-56')} />
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div>
        <h1 className="text-2xl font-medium">Project not found</h1>
        <p className="text-muted mt-1">It may have been deleted by its owner. <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }} className="text-ink underline underline-offset-2">Back to projects</a></p>
      </div>
    );
  }

  const open = openRoles(project);
  const members: any[] = (project.acceptedUsers || []).filter((m: any) => getId(m) !== projectOwnerId);
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const ownerFirstName = owner?.name?.split(' ')[0] || 'the owner';
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'details', label: 'Overview' },
    ...(isOwner || isAccepted ? [
      { id: 'chat' as const, label: 'Team chat' },
      { id: 'milestones' as const, label: 'Progress' },
    ] : []),
  ];
  const details: [string, string | undefined][] = [
    ['Time each week', project.commitmentLevel],
    ['Kind of project', project.projectType],
    ['Stack', project.techStack.join(', ')],
    ['Location', project.locationName],
  ];

  return (
    <div>
      <a
        href="/"
        onClick={(e) => { e.preventDefault(); navigate('home'); }}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        Projects
      </a>

      {/* Title row */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-medium tracking-[-0.01em] break-words">{project.title}</h1>
          <p className="text-muted mt-1">{project.summary}</p>
          <p className="text-muted mt-2 text-sm">
            Posted by{' '}
            <a
              href={owner ? `/profile/${owner.id}` : '#'}
              onClick={(e) => { e.preventDefault(); owner && navigate('profile', owner.id); }}
              className="text-ink hover:underline underline-offset-2"
            >
              {owner?.name || 'a deleted user'}
            </a>
            {' · '}{format(new Date(project.createdAt), 'd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <>
              <label className="flex items-center gap-2 text-sm text-muted">
                Status
                <select
                  value={project.status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="h-9 pl-3 pr-8 bg-surface border border-control rounded-md text-sm text-ink outline-none focus:border-ink"
                >
                  {['Open', 'Ongoing', 'Completed', 'Closed', 'Reopened'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <Button onClick={() => navigate('create', projectId)}>Edit project</Button>
            </>
          ) : (
            <Pill tone={projectStatusTone(project.status)}>{project.status}</Pill>
          )}
        </div>
      </div>

      {actionError && <div className="mt-4"><ErrorText>{actionError}</ErrorText></div>}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 items-start">
        {/* Main column; waiting requests move above the long description */}
        <div className="flex flex-col gap-3 min-w-0">
          <section className={cardStyles}>
            <div role="tablist" aria-label="Project sections" className="flex gap-6 px-5 border-b border-line overflow-x-auto">
              {tabs.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={cx(
                      'relative h-11 flex items-center gap-2 text-sm whitespace-nowrap transition-colors',
                      active ? 'text-ink font-medium' : 'text-muted hover:text-ink'
                    )}
                  >
                    {tab.label}
                    {tab.id === 'chat' && (
                      <span
                        title={socketStatus === 'connected' ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Offline, refreshing every few seconds'}
                        className={cx('w-1.5 h-1.5 rounded-full', socketStatus === 'connected' ? 'bg-positive' : socketStatus === 'connecting' ? 'bg-warn-ink' : 'bg-control')}
                      />
                    )}
                    {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink" />}
                  </button>
                );
              })}
            </div>

            {activeTab === 'details' && (
              <div role="tabpanel" className="p-5 lg:p-6">
                <div className="md">
                  <Markdown>{project.description}</Markdown>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-8 border-b border-rule">
                  {details.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 border-t border-rule">
                      <dt className="text-muted flex-none">{label}</dt>
                      <dd className={cx('text-right min-w-0', !value && 'text-muted')}>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {activeTab === 'chat' && (
              <div role="tabpanel">
                <div ref={messagesEndRef} className="max-h-[440px] min-h-32 overflow-y-auto px-5 py-4">
                  {messages.length > 0 ? (
                    <ul className="space-y-4">
                      {messages.map((msg, index) => {
                        const isMe = getId(msg.senderId) === user?.id;
                        const senderName = msg.senderId?.name || (isMe ? user?.name : 'Teammate');
                        return (
                          <li key={getId(msg) || index} className="flex items-start gap-3">
                            <Avatar name={senderName} src={msg.senderId?.profileImage} size={28} />
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="font-medium">{isMe ? 'You' : senderName}</span>
                                <span className="text-xs text-muted">
                                  {msg.createdAt ? `${formatDistanceToNow(new Date(msg.createdAt))} ago` : ''}
                                </span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted">No messages yet. Say hello to the team.</p>
                  )}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex gap-2 p-3 border-t border-line"
                >
                  <label className="sr-only" htmlFor="chat-input">Message the team</label>
                  <input
                    id="chat-input"
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    maxLength={2000}
                    placeholder="Message the team"
                    className={inputStyles}
                    autoComplete="off"
                  />
                  <Button type="submit" variant="primary" className="h-10" disabled={!newMessageText.trim()}>
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                    Send
                  </Button>
                </form>
                {chatError && <div className="px-5 pb-3"><ErrorText>{chatError}</ErrorText></div>}
              </div>
            )}

            {activeTab === 'milestones' && (
              <div role="tabpanel" className="p-5 lg:p-6">
                {(isOwner || isAccepted) && (
                  <form onSubmit={handleCreateLog} className="pb-6 mb-2 border-b border-line">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-medium">Log progress</h2>
                      <div role="group" aria-label="Entry type" className="inline-flex h-8 p-0.5 bg-raised rounded-md">
                        {(['Milestone', 'Task'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={logType === type}
                            onClick={() => setLogType(type)}
                            className={cx(
                              'h-7 px-3 rounded-[5px] text-sm transition-colors',
                              logType === type ? 'bg-surface text-ink font-medium' : 'text-muted hover:text-ink'
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label htmlFor="log-title" className={labelStyles}>What was done</label>
                        <input
                          id="log-title"
                          required
                          type="text"
                          value={logTitle}
                          onChange={(e) => setLogTitle(e.target.value)}
                          placeholder="Matching API returns ride groups"
                          className={inputStyles}
                        />
                      </div>
                      <div>
                        <label htmlFor="log-details" className={labelStyles}>Details <span className="text-muted font-normal">(optional)</span></label>
                        <input
                          id="log-details"
                          type="text"
                          value={logDetails}
                          onChange={(e) => setLogDetails(e.target.value)}
                          maxLength={2000}
                          className={inputStyles}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 mt-4">
                      {logError && <ErrorText>{logError}</ErrorText>}
                      <Button type="submit" variant="primary">Save {logType.toLowerCase()}</Button>
                    </div>
                  </form>
                )}

                <h2 className="text-base font-medium mt-4">History</h2>
                {logsLoading ? (
                  <div className="mt-3 space-y-3" aria-busy="true">
                    {[0, 1, 2].map(i => <div key={i} className="h-10 bg-raised rounded" />)}
                  </div>
                ) : projectLogs.length > 0 ? (
                  <ul className="mt-2">
                    {projectLogs.map((log, index) => {
                      const logName = log.userId?.name || 'Teammate';
                      return (
                        <li key={getId(log) || index} className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 py-3 border-t border-rule first:border-t-0">
                          <span className="num text-muted text-sm pt-px">{format(new Date(log.createdAt), 'd MMM')}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{log.title || `${logName} joined the project`}</span>
                              <Pill>{log.contributionType}</Pill>
                            </div>
                            {log.details && <p className="text-muted mt-1 whitespace-pre-wrap">{log.details}</p>}
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted">
                              <Avatar name={logName} src={log.userId?.profileImage} size={20} />
                              {logName}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted mt-2">Nothing logged yet. Milestones and finished tasks show up here.</p>
                )}
              </div>
            )}
          </section>

          {/* Requests to join, for the owner */}
          {isOwner && (
            <section id="requests" className={cx(cardStyles, pendingCount > 0 && 'order-first')}>
              <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
                <h2 className="text-base font-medium">Requests to join</h2>
                <span className="text-sm text-muted num">{pendingCount === 0 ? 'None waiting' : `${pendingCount} waiting`}</span>
              </div>
              {requests.length > 0 ? (
                <ul className="mt-3">
                  {requests.map(req => {
                    const reqUserId = getId(req.userId);
                    const person = typeof req.userId === 'string' ? null : req.userId;
                    return (
                      <li key={req.id} className="grid grid-cols-[32px_minmax(0,1fr)] sm:grid-cols-[32px_minmax(0,1fr)_168px] gap-x-3 px-5 py-4 border-t border-rule">
                        <Avatar name={person?.name} src={person?.profileImage} size={32} />
                        <div className="flex-1 min-w-0">
                          <a
                            href={`/profile/${reqUserId}`}
                            onClick={(e) => { e.preventDefault(); navigate('profile', reqUserId); }}
                            className="font-medium hover:underline underline-offset-2"
                          >
                            {person?.name || 'Deleted user'}
                          </a>
                          {person?.skills?.length > 0 && (
                            <p className="text-sm text-muted truncate">{person.skills.slice(0, 4).join(', ')}</p>
                          )}
                          {req.message && <p className="mt-1.5 whitespace-pre-wrap break-words">{req.message}</p>}
                          <p className="text-xs text-muted mt-1.5">{formatDistanceToNow(new Date(req.createdAt))} ago</p>
                        </div>
                        <div className="col-start-2 sm:col-start-3 sm:row-start-1 flex items-center gap-2 mt-3 sm:mt-0 sm:justify-end">
                          {req.status === 'Pending' ? (
                            <>
                              <button type="button" onClick={() => handleRequestAction(req, 'Rejected')} className={buttonStyles.ghost}>Decline</button>
                              <button type="button" onClick={() => handleRequestAction(req, 'Accepted')} className={cx(buttonStyles.ghost, 'border border-control hover:border-ink hover:bg-surface')}>Accept</button>
                            </>
                          ) : (
                            <Pill tone={requestStatusTone(req.status)}>{req.status === 'Rejected' ? 'Declined' : req.status}</Pill>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 pt-2 pb-5 text-muted">No requests yet. They show up here when someone asks to join.</p>
              )}
            </section>
          )}
        </div>

        {/* Right rail */}
        {/* On a phone the team and the join form come before the long description, except for the owner, whose requests lead */}
        <aside className={cx('space-y-3 min-w-0', !isOwner && 'order-first lg:order-none')}>
          {/* The team sheet: who is on it, which roles are still open */}
          <section className={cx(cardStyles, 'p-5')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium">Team</h2>
              <SeatStrip filled={teamSize(project)} open={open.length} />
            </div>
            <p className="text-sm text-muted mt-1">{seatSummary(teamSize(project), open.length)}</p>

            <ul className="mt-4 space-y-3">
              {owner && (
                <li className="flex items-start gap-3">
                  <a href={`/profile/${owner.id}`} onClick={(e) => { e.preventDefault(); navigate('profile', owner.id); }} className="flex items-start gap-3 min-w-0 flex-1 group">
                    <Avatar name={owner.name} src={owner.profileImage} size={32} />
                    <span className="min-w-0">
                      <span className="block font-medium group-hover:underline underline-offset-2">{owner.name}</span>
                      <span className="block text-sm text-muted">Owner{project.userRoles?.[owner.id] ? ` · ${project.userRoles[owner.id]}` : ''}</span>
                    </span>
                  </a>
                  <span className="flex items-center gap-1 pt-1">
                    {owner.githubLink && <a href={owner.githubLink} target="_blank" rel="noopener noreferrer" aria-label={`${owner.name} on GitHub`} className="p-1 text-muted hover:text-ink"><Github className="w-4 h-4" strokeWidth={1.5} /></a>}
                    {owner.linkedinLink && <a href={owner.linkedinLink} target="_blank" rel="noopener noreferrer" aria-label={`${owner.name} on LinkedIn`} className="p-1 text-muted hover:text-ink"><Linkedin className="w-4 h-4" strokeWidth={1.5} /></a>}
                  </span>
                </li>
              )}
              {members.map((u: any) => {
                const uid = getId(u);
                const name = typeof u === 'string' ? 'Member' : u?.name || 'Member';
                return (
                  <li key={uid}>
                    <a href={`/profile/${uid}`} onClick={(e) => { e.preventDefault(); navigate('profile', uid); }} className="flex items-start gap-3 group">
                      <Avatar name={name} src={typeof u === 'string' ? null : u?.profileImage} size={32} />
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:underline underline-offset-2">{name}</span>
                        <span className="block text-sm text-muted">{(uid && project.userRoles?.[uid]) || 'Role not set'}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
              {open.map(role => (
                <li key={role} className="flex items-start gap-3">
                  <span aria-hidden="true" className="w-8 h-8 flex-none rounded-full border-[1.5px] border-dashed border-data" />
                  <span className="min-w-0">
                    <span className="block font-medium">{role}</span>
                    <span className="block text-sm text-data">Open</span>
                  </span>
                </li>
              ))}
            </ul>
            {owner?.bio && <p className="text-sm text-muted mt-4 pt-4 border-t border-rule">{owner.bio}</p>}
          </section>

          {/* Joining */}
          {!isOwner && (
            <section className={cx(cardStyles, 'p-5')}>
              {!user ? (
                <>
                  <h2 className="text-base font-medium">Join this team</h2>
                  <p className="text-muted mt-1">Sign in to ask {ownerFirstName} for a place.</p>
                </>
              ) : isAccepted ? (
                <>
                  <h2 className="text-base font-medium">You're on this team</h2>
                  <p className="text-muted mt-1">Your role: {project.userRoles?.[user.id] || 'not set yet. Set it from your profile.'}</p>
                  <Button className="mt-4" onClick={() => setActiveTab('chat')}>Open team chat</Button>
                </>
              ) : existingRequest && existingRequest.status !== 'Rejected' ? (
                <>
                  <h2 className="text-base font-medium">Request sent</h2>
                  <p className="text-muted mt-1">
                    You asked to join {existingRequest.createdAt ? formatDistanceToNow(new Date(existingRequest.createdAt)) + ' ago' : 'recently'}. {ownerFirstName} hasn't answered yet.
                  </p>
                </>
              ) : !isRecruiting(project) ? (
                <>
                  <h2 className="text-base font-medium">Not taking requests</h2>
                  <p className="text-muted mt-1">This project is {project.status.toLowerCase()}.</p>
                </>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleApply(); }}>
                  <h2 className="text-base font-medium">Ask to join</h2>
                  {existingRequest?.status === 'Rejected' && (
                    <p className="text-sm text-muted mt-1">Your last request was declined. You can send a new one.</p>
                  )}
                  <label htmlFor="join-message" className={cx(labelStyles, 'mt-4')}>Message to {ownerFirstName}</label>
                  <textarea
                    id="join-message"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder={open.length ? `Which role you'd take (${open[0]}?) and what you've built before` : 'What you would work on and what you have built before'}
                    className={cx(inputStyles, 'h-auto py-2 leading-5 resize-y')}
                  />
                  <Button type="submit" variant="primary" className="w-full mt-3" disabled={isSubmitting || !requestMessage.trim()}>
                    {isSubmitting ? 'Sending…' : 'Send request'}
                  </Button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
