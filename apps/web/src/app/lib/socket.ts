import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@watchparty/types';

const URL = process.env.NODE_ENV === 'production'
  ? 'https://watch-party-server-fvl1.onrender.com'
  : typeof window !== 'undefined' 
    ? `http://${window.location.hostname}:3001` 
    : 'http://localhost:3001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
});
