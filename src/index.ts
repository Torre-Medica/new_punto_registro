import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config as dotenvConfig } from 'dotenv';
import { logToFile } from './config/logs'; // Importa la función para logs
import './client'; // Importa `client.ts` para que se ejecute al iniciar
import path from 'path';
import envConfig from './config/env';
import { exec } from "child_process";
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

// Solo para pruebas de la pantalla: con PRUEBAS_PANTALLA=true permite enviar un
// mensaje como si viniera del servidor. Apagado por defecto (en produccion no existe).
if (process.env.PRUEBAS_PANTALLA === 'true') {
  console.log('[pruebas] Ruta POST /pruebas/pantalla habilitada');
  app.post('/pruebas/pantalla', (req, res) => {
    io.emit('status-message', { deviceType: envConfig.DEVICETYPE, ...req.body });
    res.json({ enviado: true });
  });

  // Simula oprimir el boton de visitante: pide el ingreso al servidor real.
  console.log('[pruebas] Ruta POST /pruebas/boton habilitada');
  app.post('/pruebas/boton', (req, res) => {
    const nestSocket = require('./config/socket').default;
    nestSocket.emit('request_entry', {
      devicesType: envConfig.DEVICETYPE,
      url: '',
      plate: req.body?.plate || '',
      vehicleKind: req.body?.vehicleKind || 'CARRO',
    });
    res.json({ enviado: true, conectado: nestSocket.connected });
  });
}

// Manejo de conexión de clientes a WebSockets
io.on('connection', (socket) => {
  console.log('Cliente WebSocket conectado');
  // La pantalla ajusta su mensaje de espera segun sea punto de entrada o salida
  socket.emit('screen-config', { deviceType: envConfig.DEVICETYPE });

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
  if (process.env.KIOSK_MODE === 'true') {
    const kioskUrl = process.env.KIOSK_URL || `http://localhost:${port}`;
    exec(`command -v chromium-browser || command -v chromium`, (error, stdout) => {
      const browser = stdout.trim();

      if (error || !browser) {
        console.error('No se encontro chromium-browser ni chromium para el modo kiosk.');
        return;
      }

      exec(`${browser} --kiosk --incognito --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state --password-store=basic ${kioskUrl}`);
    });
  }
});
