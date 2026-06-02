export interface User {
    id: string;
    username: string;
  }
  
  export interface ChatMessage {
    roomId: string;
    user: string;
    text: string;
    time: string;
    isSystem?: boolean;
  }
  
  export interface RoomState {
    src: string;
    time: number;
    playing: boolean;
  }
  
  export interface ServerToClientEvents {
    'room:sync_initial': (state: RoomState) => void;
    'media:play': (payload: { time: number }) => void;
    'media:pause': () => void;
    'media:change': (payload: { src: string }) => void;
    'chat:message': (message: ChatMessage) => void;
    'room:users': (users: User[]) => void;
  }
  
  export interface ClientToServerEvents {
    'room:join': (payload: { roomId: string; username: string }) => void;
    'media:play': (payload: { roomId: string; time: number }) => void;
    'media:pause': (payload: { roomId: string }) => void;
    'media:change': (payload: { roomId: string; src: string }) => void;
    'chat:message': (payload: { roomId: string; user: string; text: string }) => void;
  }