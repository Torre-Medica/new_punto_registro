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

// Envia a la pantalla el codigo, el texto original del servidor (detalle para
// el operador) y el tipo de punto (IN/OUT), para que muestre un mensaje claro.
const notifyScreen = (statusCode: string, detail?: string, extra: Record<string, any> = {}) => {
  server.emit('status-message', {
    statusCode,
    message: typeof detail === 'string' ? detail : '',
    deviceType: envConfig.DEVICETYPE,
    ...extra,
  });
};

let serverDown = false;

// socket.io entrega los motivos de desconexion en ingles
const MOTIVOS_DESCONEXION: Record<string, string> = {
  'transport close': 'se cerró la conexión',
  'transport error': 'error en la conexión',
  'ping timeout': 'el servidor dejó de responder',
  'io server disconnect': 'el servidor cerró la conexión',
  'io client disconnect': 'el punto cerró la conexión',
  'parse error': 'respuesta inválida del servidor',
  'websocket error': 'no se pudo conectar al servidor',
  'xhr poll error': 'no se pudo conectar al servidor',
  'timeout': 'el servidor no respondió a tiempo',
};
const motivoEnEspanol = (motivo: string) => MOTIVOS_DESCONEXION[motivo] || motivo;

socket.on('connect', () => {
  console.log('Conectado al servidor NestJS');
  if (serverDown) notifyScreen('SERVER_RESTORED');
  serverDown = false;
});

socket.on('disconnect', (reason) => {
  console.log(`Desconectado del servidor NestJS. Motivo: ${reason}`);
  serverDown = true;
  notifyScreen('SERVER_ERROR', `Sin conexión con el servidor: ${motivoEnEspanol(reason)}`);
});

socket.on('connect_error', (err) => {
  console.error('Error al conectar con el servidor:', err.message);
  if (!serverDown) {
    serverDown = true;
    notifyScreen('SERVER_ERROR', `Sin conexión con el servidor: ${motivoEnEspanol(err.message)}`);
  }
});

// Con status=true el acceso se concede aunque el texto no tenga un codigo
// conocido: la pantalla no debe decir "problema" mientras la talanquera abre.
const grantedCode = (message: any) =>
  !message.statusInternalCode || message.statusInternalCode === 'ERROR'
    ? 'ACCESS_GRANTED'
    : message.statusInternalCode;

const handleTicketedAccess = async (message: any) => {
  if (!message.infoForPrint) {
    notifyScreen(grantedCode(message), message.message);
    moveHardware.openBarrier();
    return;
  }

  notifyScreen('PRINTING', message.message);
  try {
    const cuerpoImpresion: any = await generarCuerpoImpresion(
      message.infoForPrint,
    );
    const resultado = await printer(cuerpoImpresion);
    console.log(resultado.message);

    if (resultado.success) {
      notifyScreen(grantedCode(message), message.message, { ticketPrinted: true });
      moveHardware.openBarrier();
    } else {
      notifyScreen('PRINTER_ERROR', resultado.message);
    }
  } catch (error: any) {
    console.error(error?.message || error);
    notifyScreen('PRINTER_ERROR', error?.message || 'Error generando el tiquete');
  }
};

const handleServerResponse = (data: any) => {
  console.log('Mensaje recibido:', data);
  const message = data?.message ?? {};

  if (message.status) {
    handleTicketedAccess(message);
    return;
  }

  notifyScreen(message.statusInternalCode || 'ERROR', message.message);
};

socket.on('message', handleServerResponse);

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
    notifyScreen(payload.statusCode, payload.reason === 'LPR' ? 'Salida por placa' : '');
  }
  if (typeof ack === 'function') ack({ opened });
});

socket.on('request_entry', handleServerResponse);

export { notifyScreen };

export default socket;
