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

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  socket.on('room:join', async ({ roomId, username }) => {
    socket.join(roomId);
    
    let roomState: any = await redis.hgetall(`room:${roomId}`);
    
    // Se a sala não existe no Redis, vamos criar um estado inicial "vivo"
    if (!roomState || !roomState.src) {
      const initialState = {
        src: 'https://www.youtube.com/watch?v=4W9_H0mdJBo',
        time: 0,
        playing: false
      };
      await redis.hset(`room:${roomId}`, initialState);
      roomState = initialState;
    }
  
    // Envia para o usuário que acabou de entrar
    socket.emit('room:sync_initial', {
      src: roomState.src,
      time: parseFloat(roomState.time || '0'),
      playing: roomState.playing === 'true' || roomState.playing === true
    });
  });

  socket.on('media:play', async ({ roomId, time }) => {
    // Salva o tempo atual e o estado de tocando
    await redis.hset(`room:${roomId}`, { 
      time: time.toString(), 
      playing: "true" 
    });
    socket.to(roomId).emit('media:play', { time });
  });

  socket.on('media:pause', async ({ roomId }) => {
    await redis.hset(`room:${roomId}`, { playing: "false" });
    socket.to(roomId).emit('media:pause');
  });

  socket.on('media:change', async ({ roomId, src }) => {
    // Reseta o tempo para 0 quando o vídeo muda
    await redis.hset(`room:${roomId}`, { src, time: 0, playing: false });
    socket.to(roomId).emit('media:change', { src });
  });

  socket.on('chat:message', ({ roomId, user, text }) => {
    // io.to envia para TODO MUNDO na sala (inclusive quem mandou)
    io.to(roomId).emit('chat:message', { user, text });
    console.log(`Mensagem em ${roomId}: [${user}]: ${text}`);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});