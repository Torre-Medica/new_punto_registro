import { io, Socket } from 'socket.io-client';
import envConfig from './env';
import moveHardware from "../services/moveHardware";
import { generarCuerpoImpresion, printer } from '../services/consumptionPrinter';
import { io as server } from "../index";

const baseNestUrl = envConfig.NEST_SERVER_URL.replace(/\/$/, '');
const deviceUuid = envConfig.DEVICE_UUID || '';
const connectUrl = deviceUuid ? `${baseNestUrl}?uuid=${encodeURIComponent(deviceUuid)}` : baseNestUrl;
console.log('Conectando a', connectUrl);

const socket: Socket = io(connectUrl, {
  transports: ['websocket'], // Usa WebSockets directamente
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  console.log('Conectado al servidor NestJS');
});

socket.on('disconnect', (reason) => {
  console.log(`Desconectado del servidor NestJS. Motivo: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error('Error al conectar con el servidor:', err.message);
});

const handleTicketedAccess = async (message: any) => {
  server.emit('status-message', {
    statusCode: message.statusInternalCode || 'ACCESS_GRANTED',
  });

  if (!message.infoForPrint) {
    moveHardware.openBarrier();
    return;
  }

  try {
    const cuerpoImpresion: any = await generarCuerpoImpresion(
      message.infoForPrint,
    );
    const resultado = await printer(cuerpoImpresion);
    console.log(resultado.message);

    if (resultado.success) {
      moveHardware.openBarrier();
    }
  } catch (error: any) {
    console.error(error?.message || error);
  }
};

socket.on('message', (data: any) => {
  console.log('Mensaje recibido:', data);
  const status = data.message.status;

  if (status) {
    handleTicketedAccess(data.message);
    return;
  }

  server.emit('status-message', {
    statusCode: data.message.statusInternalCode,
  });
});

socket.on('openbarrier', () => {
  console.log('Mensaje recibido:', 'openbarrier');

  moveHardware.openBarrier();
});

socket.on('request_entry', (data: any) => {
  console.log('Mensaje recibido:', data);
  const status = data.message.status;

  if (status) {
    handleTicketedAccess(data.message);
    return;
  }

  server.emit('status-message', {
    statusCode: data.message.statusInternalCode,
  });
});

export default socket;
