export interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  profileImage: string;
  resumeLink?: string;
  githubLink?: string;
  linkedinLink?: string;
  phoneNumber?: string;
  skills: string[];
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  description: string;
  techStack: string[];
  requiredRoles: string[];
  commitmentLevel: string;
  projectType: string;
  ownerId: any; // Can be string or populated object
  status: 'Open' | 'Closed' | 'Ongoing' | 'Completed' | 'Reopened';
  userRoles?: Record<string, string>; // userId -> roleName
  applicants: any[];
  acceptedUsers: any[];
  createdAt: string;
}

export interface CollaborationRequest {
  id: string;
  projectId: string;
  userId: any;
  message: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  createdAt: string;
}

export interface Endorsement {
  id: string;
  skill: string;
  endorsedBy: string;
  endorsedUser: string;
  createdAt: string;
}

export interface ContributionLog {
  id: string;
  userId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  contributionType: 'Joined' | 'Completed';
  createdAt: string;
}
