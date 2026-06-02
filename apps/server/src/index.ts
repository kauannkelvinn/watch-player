import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import type {
  ChatMessage,
  ClientToServerEvents,
  RoomState,
  ServerToClientEvents,
  User,
} from '@watchparty/types';

dotenv.config();

interface SocketData {
  username?: string;
  roomId?: string;
}

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  },
);

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

function parseRoomState(raw: Record<string, string> | null): RoomState | null {
  if (!raw?.src) return null;

  return {
    src: raw.src,
    time: parseFloat(raw.time ?? '0'),
    playing: raw.playing === 'true',
  };
}

function formatMessageTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

async function broadcastUsers(roomId: string): Promise<void> {
  const users = await redis.hgetall<Record<string, string>>(`room:${roomId}:users`);
  if (!users) return;

  const userList: User[] = Object.entries(users).map(([id, username]) => ({
    id,
    username,
  }));

  io.to(roomId).emit('room:users', userList);
}

io.on('connection', (socket) => {
  socket.on('room:join', async ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;

    await redis.hset(`room:${roomId}:users`, { [socket.id]: username });

    const joinMessage: ChatMessage = {
      roomId,
      user: 'Watch.Party',
      text: `${username} joined the room`,
      time: formatMessageTime(),
      isSystem: true,
    };
    io.to(roomId).emit('chat:message', joinMessage);

    await broadcastUsers(roomId);

    let roomState = parseRoomState(await redis.hgetall<Record<string, string>>(`room:${roomId}`));
    if (!roomState) {
      const initialState: RoomState = {
        src: 'https://www.youtube.com/watch?v=4W9_H0mdJBo',
        time: 0,
        playing: false,
      };
      await redis.hset(`room:${roomId}`, {
        src: initialState.src,
        time: String(initialState.time),
        playing: String(initialState.playing),
      });
      roomState = initialState;
    }

    socket.emit('room:sync_initial', roomState);
  });

  socket.on('media:play', async ({ roomId, time }) => {
    await redis.hset(`room:${roomId}`, { time: time.toString(), playing: 'true' });
    socket.to(roomId).emit('media:play', { time });
  });

  socket.on('media:pause', async ({ roomId }) => {
    await redis.hset(`room:${roomId}`, { playing: 'false' });
    socket.to(roomId).emit('media:pause');
  });

  socket.on('media:change', async ({ roomId, src }) => {
    await redis.hset(`room:${roomId}`, { src, time: 0, playing: false });
    socket.to(roomId).emit('media:change', { src });
  });

  socket.on('chat:message', ({ roomId, user, text }) => {
    const message: ChatMessage = {
      roomId,
      user,
      text,
      time: formatMessageTime(),
    };
    io.to(roomId).emit('chat:message', message);
  });

  socket.on('disconnect', async () => {
    const { roomId, username } = socket.data;

    if (roomId) {
      await redis.hdel(`room:${roomId}:users`, socket.id);

      const leaveMessage: ChatMessage = {
        roomId,
        user: 'Watch.Party',
        text: `${username} left the room`,
        time: formatMessageTime(),
        isSystem: true,
      };
      io.to(roomId).emit('chat:message', leaveMessage);

      const users = await redis.hgetall<Record<string, string>>(`room:${roomId}:users`);
      if (users) {
        const userList: User[] = Object.entries(users).map(([id, name]) => ({
          id,
          username: name,
        }));
        io.to(roomId).emit('room:users', userList);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
