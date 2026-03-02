import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@tradeapp/shared';

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let _io: IO | null = null;

export function initIO(io: IO): void {
  _io = io;
}

export function getIO(): IO {
  if (!_io) throw new Error('Socket.IO not initialized');
  return _io;
}
