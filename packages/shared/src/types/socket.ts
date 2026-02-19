import { JobStatus, JobUrgency } from './job';
import { NotificationType } from './notification';

// Client → Server events
export interface ClientToServerEvents {
  authenticate: (token: string) => void;
  join_job_room: (jobId: string) => void;
  leave_job_room: (jobId: string) => void;
  send_message: (data: SendMessageSocketData) => void;
}

// Server → Client events
export interface ServerToClientEvents {
  new_job_match: (data: NewJobMatchData) => void;
  job_accepted: (data: JobAcceptedData) => void;
  job_status_updated: (data: JobStatusUpdatedData) => void;
  new_message: (data: NewMessageData) => void;
  new_notification: (data: NewNotificationData) => void;
  authenticated: (data: { success: boolean; userId?: string }) => void;
  error: (data: { message: string }) => void;
}

// Socket event data types
export interface NewJobMatchData {
  jobId: string;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  distance: number; // in km
  urgency: JobUrgency;
  category: {
    id: number;
    name: string;
  };
  customer: {
    firstName: string;
    lastName: string;
  };
  estimatedBudget?: number;
  scheduledDate?: string;
}

export interface JobAcceptedData {
  jobId: string;
  professionalId: string;
  professionalName: string;
  professionalPhone?: string;
  acceptedAt: string;
}

export interface JobStatusUpdatedData {
  jobId: string;
  status: JobStatus;
  updatedBy: string;
  updatedAt: string;
}

export interface NewMessageData {
  messageId: string;
  jobId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface NewNotificationData {
  notificationId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedJobId?: string;
  createdAt: string;
}

export interface SendMessageSocketData {
  jobId: string;
  receiverId: string;
  content: string;
}
