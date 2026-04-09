import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Helper to get or create a participant ID for a room
const getParticipantId = (roomId: string): string => {
  if (typeof window === 'undefined') return '';
  const key = `ap_participant_${roomId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
};

export interface Room {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCreator?: boolean;
}

export interface Submission {
  yamlFiles: string[];
  apworldFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AllFilesResponse {
  yamlFiles: string[];
  apworldFiles: string[];
}

export interface RoomStats {
  totalSubmissions: number;
  totalYamlFiles: number;
  totalApworldFiles: number;
  roomCreatedAt: string;
  roomExpiresAt: string;
}

export const apiClient = {
  // Room operations
  createRoom: async (): Promise<{ roomId: string; expiresAt: string }> => {
    const response = await api.post('/rooms');
    return response.data;
  },

  getRoom: async (roomId: string): Promise<Room> => {
    const response = await api.get(`/rooms/${roomId}`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data.room;
  },

  getRoomStats: async (roomId: string): Promise<RoomStats> => {
    const response = await api.get(`/rooms/${roomId}/stats`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data.stats;
  },

  // Submission operations
  getSubmission: async (roomId: string): Promise<{ hasSubmission: boolean; submission: Submission | null }> => {
    const response = await api.get(`/rooms/${roomId}/submission`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data;
  },

  uploadFiles: async (
    roomId: string,
    yamlFiles: File[],
    apworldFiles: File[]
  ): Promise<{ yamlFiles: string[]; apworldFiles: string[] }> => {
    const formData = new FormData();
    
    yamlFiles.forEach(file => {
      formData.append('yamlFiles', file);
    });
    
    apworldFiles.forEach(file => {
      formData.append('apworldFiles', file);
    });

    const response = await api.post(`/rooms/${roomId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Participant-ID': getParticipantId(roomId)
      },
    });
    
    return response.data;
  },

  downloadFiles: async (roomId: string, fileType: 'yaml' | 'apworld'): Promise<void> => {
    const response = await api.get(`/rooms/${roomId}/download/${fileType}`, {
      responseType: 'blob',
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${roomId}_${fileType}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  removeFiles: async (roomId: string, fileNames: string[]): Promise<{ yamlFiles: string[]; apworldFiles: string[] }> => {
    const response = await api.delete(`/rooms/${roomId}/submission/files`, {
      data: { fileNames },
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data;
  },

  cancelSubmission: async (roomId: string): Promise<void> => {
    const response = await api.delete(`/rooms/${roomId}/submission`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data;
  },

  // Creator endpoints
  getAllFiles: async (roomId: string): Promise<AllFilesResponse> => {
    const response = await api.get(`/rooms/${roomId}/files`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data;
  },

  getFileContent: async (roomId: string, fileName: string): Promise<string> => {
    const response = await api.get(`/rooms/${roomId}/file/${encodeURIComponent(fileName)}`, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) },
      responseType: 'text',
    });
    return response.data;
  },
  
  updateFileContent: async (roomId: string, fileName: string, content: string): Promise<void> => {
    const response = await api.put(`/rooms/${roomId}/file/${encodeURIComponent(fileName)}`, { content }, {
      headers: { 'X-Participant-ID': getParticipantId(roomId) }
    });
    return response.data;
  },
  
  downloadIndividualFile: async (roomId: string, fileName: string): Promise<void> => {
    const response = await api.get(`/rooms/${roomId}/file/${encodeURIComponent(fileName)}`, {
      params: { download: 'true' },
      headers: { 'X-Participant-ID': getParticipantId(roomId) },
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

export default apiClient;
