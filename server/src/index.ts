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
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  socket.on('room:join', async ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} entrou na sala ${roomId}`);
    socket.to(roomId).emit('room:user_joined', { username, id: socket.id });
  });

  socket.on('media:play', ({ roomId, time }) => {
    socket.to(roomId).emit('media:play', { time });
  });

  socket.on('media:pause', ({ roomId }) => {
    socket.to(roomId).emit('media:pause');
  });

  socket.on('media:change', ({ roomId, src }) => {
    // Repassa a nova fonte para os outros na sala
    socket.to(roomId).emit('media:change', { src });
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});