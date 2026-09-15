import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config as dotenvConfig } from 'dotenv';
import { logToFile } from './config/logs'; // Importa la función para logs
import './client'; // Importa `client.ts` para que se ejecute al iniciar
import path from 'path';
import {exec} from "child_process"
logToFile("¡Inicio del servidor!");


dotenvConfig(); // Cargar variables de entorno

const app = express();
const port = process.env.PORT || 3000;
const server = createServer(app);
export const io = new Server(server);

// Middleware para parsear JSON
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

// Ruta básica para verificar que el servidor está corriendo
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Manejo de conexión de clientes a WebSockets
io.on('connection', (socket) => {
  console.log('Cliente WebSocket conectado');

  socket.on('message', (msg) => {
    console.log('Mensaje recibido:', msg);
  });

  socket.on('disconnect', () => {
    console.log('Cliente WebSocket desconectado');
  });



});

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
  if (process.env.DEVICETYPE && process.env.DEVICETYPE==='IN' ) {
    exec(`chromium-browser --kiosk http://localhost:4000`)
  }
});
