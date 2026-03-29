import { io } from 'socket.io-client';

// Quando fizermos o deploy do server no Render, ele vai te dar uma URL (ex: https://rave-server.onrender.com)
// Substitua 'SUA_URL_DO_RENDER_AQUI' por ela após o deploy.
const URL = process.env.NODE_ENV === 'production' 
  ? 'https://watch-party-server-fvl1.onrender.com' 
  : 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: false,
});