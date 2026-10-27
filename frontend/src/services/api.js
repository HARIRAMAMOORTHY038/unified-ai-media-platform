
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for long AI transcription tasks
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Media API
export const mediaApi = {
  uploadVideo: (formData, onProgress) =>
    api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );

          onProgress(percent);
        }
      },
    }),

  listVideos: (params) => api.get('/media/list', { params }),

  // NEW: Multilingual semantic search
  semanticSearch: (query, limit = 20) =>
    api.get('/media/semantic-search', {
      params: { query, limit },
    }),

  getVideo: (id) => api.get(`/media/${id}`),

  deleteVideo: (id) => api.delete(`/media/${id}`),

  getStreamUrl: (id) => {
    const token = localStorage.getItem('token');

    return `/api/media/${id}/stream?token=${encodeURIComponent(token || '')}`;
  },
};

// Caption API
export const captionApi = {
  transcribe: (videoId, sourceLanguage) =>
    api.post(`/captions/${videoId}/transcribe`, {
      source_language:
        sourceLanguage && sourceLanguage !== 'auto'
          ? sourceLanguage
          : null,
    }),

  getTracks: (videoId) => api.get(`/captions/${videoId}/tracks`),

  getTrack: (trackId) => api.get(`/captions/tracks/${trackId}`),

  updateTrack: (trackId, cues) =>
    api.put(`/captions/tracks/${trackId}`, { cues }),

  deleteTrack: (trackId) =>
    api.delete(`/captions/tracks/${trackId}`),

  getSrtExportUrl: (trackId) =>
    `/api/captions/tracks/${trackId}/export/srt`,

  getVttExportUrl: (trackId) =>
    `/api/captions/tracks/${trackId}/export/vtt?download=true`,
};

// Translation API
export const translationApi = {
  getLanguages: () => api.get('/translation/languages'),

  translate: (videoId, sourceTrackId, targetLanguages) =>
    api.post(`/translation/${videoId}/translate`, {
      source_track_id: sourceTrackId,
      target_languages: targetLanguages,
    }),
};

// Dubbing API
export const dubbingApi = {
  generateDub: (videoId, targetLanguage, sourceTrackId) =>
    api.post(`/dubbing/${videoId}/generate`, {
      target_language: targetLanguage,
      source_track_id: sourceTrackId || null,
    }),

  getTracks: (videoId) => api.get(`/dubbing/${videoId}/tracks`),

  getTrack: (trackId) => api.get(`/dubbing/tracks/${trackId}`),

  getAudioStreamUrl: (trackId) => {
    const token = localStorage.getItem('token');

    return `/api/dubbing/tracks/${trackId}/audio?token=${encodeURIComponent(
      token || ''
    )}`;
  },

  getAudioDownloadUrl: (trackId) =>
    `/api/dubbing/tracks/${trackId}/download`,

  exportVideo: (trackId) =>
    api.post(`/dubbing/tracks/${trackId}/export-video`),

  getVideoDownloadUrl: (trackId) =>
    `/api/dubbing/tracks/${trackId}/download-video`,

  deleteTrack: (trackId) =>
    api.delete(`/dubbing/tracks/${trackId}`),
};

export default api;
