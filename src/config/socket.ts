import { io, Socket } from 'socket.io-client';
import envConfig from './env';
import moveHardware from "../services/moveHardware";
import { getDevicesConfig } from "./devices";
import { generarCuerpoImpresion, printer } from '../services/consumptionPrinter';
import { io as server } from "../index";

const baseNestUrl = envConfig.NEST_SERVER_URL.replace(/\/$/, '');
const deviceUuid = envConfig.DEVICE_UUID || '';
const connectUrl = deviceUuid ? `${baseNestUrl}?uuid=${encodeURIComponent(deviceUuid)}` : baseNestUrl;
console.log('Conectando a', connectUrl);

// El backend decide la salida por placa solo si el punto OUT la declara al conectar.
const lprAutoExit = getDevicesConfig().LPR_AUTO_EXIT === true;
console.log(`LPR_AUTO_EXIT: ${lprAutoExit} (DEVICETYPE=${envConfig.DEVICETYPE})`);

const socket: Socket = io(connectUrl, {
  auth: { lprAutoExit, deviceType: envConfig.DEVICETYPE },
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

// El backend (salida por placa) envia un ack y solo cierra el proceso si abrio.
socket.on('openbarrier', async (payload?: any, ack?: (response: { opened: boolean }) => void) => {
  console.log('Mensaje recibido:', 'openbarrier', payload ?? '');

  let opened = false;
  try {
    opened = await moveHardware.openBarrier();
  } catch (error: any) {
    console.error('Error abriendo talanquera:', error?.message || error);
  }

  if (opened && payload?.statusCode) {
    server.emit('status-message', { statusCode: payload.statusCode });
  }
  if (typeof ack === 'function') ack({ opened });
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
