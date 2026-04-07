import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tradeapp/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export const socketService = {
  connect(token: string) {
    if (socket?.connected) return;

    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      socket!.emit('authenticate', token);
    });

    socket.on('authenticated', (data) => {
      if (!data.success) {
        socket!.disconnect();
      }
    });
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ) {
    socket?.on(event as string, handler as any);
  },

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ) {
    socket?.off(event as string, handler as any);
  },

  joinJobRoom(jobId: string) {
    socket?.emit('join_job_room', jobId);
  },

  leaveJobRoom(jobId: string) {
    socket?.emit('leave_job_room', jobId);
  },
};
