import { api } from './api';

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const messageService = {
  async getMessages(jobId: string): Promise<Message[]> {
    const res = await api.get<{ messages: Message[] }>(`/messages/jobs/${jobId}`);
    return res.data.messages;
  },

  async sendMessage(jobId: string, receiverId: string, content: string): Promise<Message> {
    const res = await api.post<Message>(`/messages/jobs/${jobId}`, { receiverId, content });
    return res.data;
  },
};
