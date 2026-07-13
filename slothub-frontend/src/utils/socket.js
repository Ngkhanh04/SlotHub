import { io } from 'socket.io-client';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || (isLocalhost ? 'http://localhost:5000' : 'https://slothub-toivoa.onrender.com');

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
  }
  return socket;
};

export const connectUserSocket = (userId) => {
  const s = getSocket();
  if (!s.connected) s.connect();
  if (userId) s.emit('join_user', userId);
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};
