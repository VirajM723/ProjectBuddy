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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 429) {
      const serverMsg = error.response.data?.message;
      const userWarning = serverMsg || "You have made too many requests. Please wait a moment and try again.";
      error.message = userWarning;
      if (error.response.data) {
        error.response.data.message = userWarning;
      }
    }
    // Session expired or token invalid: clear it and return to the login screen
    const url: string = error.config?.url || '';
    if (error.response?.status === 401 && localStorage.getItem('token') && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials).then(res => res.data),
  register: (userData: any) => api.post('/auth/register', userData).then(res => res.data),
  me: () => api.get('/auth/me').then(res => res.data),
};

export const projectService = {
  getAll: (coords?: { lat: number; lng: number }) => {
    const params = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
    return api.get(`/projects${params}`).then(res => res.data);
  },
  getById: (id: string) => api.get(`/projects/${id}`).then(res => res.data),
  create: (data: any) => api.post('/projects', data).then(res => res.data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data).then(res => res.data),
  setMyRole: (id: string, role: string) => api.put(`/projects/${id}/role`, { role }).then(res => res.data),
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
  getByProject: (projectId: string) => api.get(`/logs/project/${projectId}`).then(res => res.data),
};

export const chatService = {
  getMessages: (projectId: string) => api.get(`/projects/${projectId}/messages`).then(res => res.data),
  sendMessage: (projectId: string, text: string) => api.post(`/projects/${projectId}/messages`, { text }).then(res => res.data),
};

export const adminService = {
  getAllUsers: () => api.get('/admin/users').then(res => res.data),
  getAllProjects: () => api.get('/admin/projects').then(res => res.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(res => res.data),
  deleteProject: (id: string) => api.delete(`/admin/projects/${id}`).then(res => res.data),
};

// Server responses use `id`, but tolerate raw `_id` or a bare id string
export const getId = (ref: any): string | undefined =>
  ref == null ? undefined : typeof ref === 'string' ? ref : ref.id || ref._id;

export const getErrorMessage = (err: any, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || fallback;

export default api;
