import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials).then(res => res.data),
  register: (userData: any) => api.post('/auth/register', userData).then(res => res.data),
};

export const projectService = {
  getAll: () => api.get('/projects').then(res => res.data),
  getById: (id: string) => api.get(`/projects/${id}`).then(res => res.data),
  create: (data: any) => api.post('/projects', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data).then(res => res.data),
};

export const userService = {
  getProfile: (id: string) => api.get(`/users/${id}`).then(res => res.data),
  updateProfile: (data: any) => api.put('/users/profile', data).then(res => res.data),
};

export const collaborationService = {
  create: (data: any) => api.post('/collaborations', data).then(res => res.data),
  getByProject: (projectId: string) => api.get(`/collaborations/project/${projectId}`).then(res => res.data),
  getMyRequest: (projectId: string) => api.get(`/collaborations/my-request/${projectId}`).then(res => res.data),
  updateStatus: (id: string, status: string) => api.put(`/collaborations/${id}`, { status }).then(res => res.data),
};

export const endorsementService = {
  create: (data: any) => api.post('/endorsements', data).then(res => res.data),
  getByUser: (userId: string) => api.get(`/endorsements/user/${userId}`).then(res => res.data),
};

export const logService = {
  create: (data: any) => api.post('/logs', data).then(res => res.data),
  getByUser: (userId: string) => api.get(`/logs/user/${userId}`).then(res => res.data),
};

export const adminService = {
  getAllUsers: () => api.get('/admin/users').then(res => res.data),
  getAllProjects: () => api.get('/admin/projects').then(res => res.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(res => res.data),
  deleteProject: (id: string) => api.delete(`/admin/projects/${id}`).then(res => res.data),
};

export default api;
