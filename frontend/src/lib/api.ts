import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export interface Room {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface Submission {
  yamlFiles: string[];
  apworldFiles: string[];
  createdAt: string;
  updatedAt: string;
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
    const response = await api.get(`/rooms/${roomId}`);
    return response.data.room;
  },

  getRoomStats: async (roomId: string): Promise<RoomStats> => {
    const response = await api.get(`/rooms/${roomId}/stats`);
    return response.data.stats;
  },

  // Submission operations
  getSubmission: async (roomId: string): Promise<{ hasSubmission: boolean; submission: Submission | null }> => {
    const response = await api.get(`/rooms/${roomId}/submission`);
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
      },
    });
    
    return response.data;
  },

  downloadFiles: async (roomId: string, fileType: 'yaml' | 'apworld'): Promise<void> => {
    const response = await api.get(`/rooms/${roomId}/download/${fileType}`, {
      responseType: 'blob',
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

  cancelSubmission: async (roomId: string): Promise<void> => {
    const response = await api.delete(`/rooms/${roomId}/submission`);
    return response.data;
  },
};

export default apiClient;
