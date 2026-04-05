export enum NotificationType {
  NEW_JOB = 'new_job',
  JOB_ACCEPTED = 'job_accepted',
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  MESSAGE = 'message',
  RATING = 'rating',
  PAYMENT_RECEIVED = 'payment_received',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedJobId?: string;
  isRead: boolean;
  createdAt: Date;
}
