import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config();

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

// Função auxiliar para buscar e enviar lista de usuários da sala
async function broadcastUsers(roomId: string) {
  // Buscamos todos os campos do "hash" de usuários daquela sala
  const users: any = await redis.hgetall(`room:${roomId}:users`);
  if (!users) return;

  // Transformamos o objeto do Redis em uma lista [{id, username}]
  const userList = Object.entries(users).map(([id, username]) => ({
    id,
    username
  }));

  io.to(roomId).emit('room:users', userList);
}

io.on('connection', (socket) => {
  // Estendendo o objeto socket para guardar info temporária
  const s = socket as any;

  socket.on('room:join', async ({ roomId, username }) => {
    socket.join(roomId);
    s.roomId = roomId; // Salva no socket para usar no disconnect
    s.username = username;

    // 1. Salva o usuário no Redis (expira em 24h para não poluir)
    await redis.hset(`room:${roomId}:users`, { [socket.id]: username });
    
    // 2. Avisa no chat que alguém entrou
    io.to(roomId).emit('chat:message', { 
      user: 'Watch.Party', 
      text: `${username} entrou na sala`, 
      isSystem: true 
    });

    // 3. Atualiza lista de membros para todos
    await broadcastUsers(roomId);
    
    // --- Lógica de Sync de Vídeo ---
    let roomState: any = await redis.hgetall(`room:${roomId}`);
    if (!roomState || !roomState.src) {
      const initialState = {
        src: 'https://www.youtube.com/watch?v=4W9_H0mdJBo',
        time: 0,
        playing: false
      };
      await redis.hset(`room:${roomId}`, initialState);
      roomState = initialState;
    }
  
    socket.emit('room:sync_initial', {
      src: roomState.src,
      time: parseFloat(roomState.time || '0'),
      playing: roomState.playing === 'true' || roomState.playing === true
    });
  });

  socket.on('media:play', async ({ roomId, time }) => {
    await redis.hset(`room:${roomId}`, { time: time.toString(), playing: "true" });
    socket.to(roomId).emit('media:play', { time });
  });

  socket.on('media:pause', async ({ roomId }) => {
    await redis.hset(`room:${roomId}`, { playing: "false" });
    socket.to(roomId).emit('media:pause');
  });

  socket.on('media:change', async ({ roomId, src }) => {
    await redis.hset(`room:${roomId}`, { src, time: 0, playing: false });
    socket.to(roomId).emit('media:change', { src });
  });

  socket.on('chat:message', ({ roomId, user, text }) => {
    io.to(roomId).emit('chat:message', { user, text });
  });

  socket.on('disconnect', async () => {
    const { roomId, username } = s;

    if (roomId) {
      // 1. Remove o usuário do Redis
      await redis.hdel(`room:${roomId}:users`, socket.id);

      // 2. Avisa no chat que saiu
      io.to(roomId).emit('chat:message', { 
        user: 'Watch.Party', 
        text: `${username} saiu da sala`, 
        isSystem: true 
      });

      // 3. Atualiza a lista para quem sobrou
      await broadcastUsers(roomId);
    }
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});