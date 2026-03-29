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
    origin: "*", // Em produção, vamos mudar para a URL do seu front
    methods: ["GET", "POST"]
  }
});

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  // Evento para entrar na sala
  socket.on('room:join', async ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} entrou na sala ${roomId}`);
    
    // Aqui depois buscaremos o estado da sala no Redis
    socket.to(roomId).emit('room:user_joined', { username, id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});