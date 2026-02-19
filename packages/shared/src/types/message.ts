export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

export interface MessageWithSender extends Message {
  sender: {
    firstName: string;
    lastName: string;
  };
}

export interface SendMessageRequest {
  jobId: string;
  receiverId: string;
  content: string;
}
