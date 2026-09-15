import fs from 'fs';
import path from 'path';

// Función para asegurarse de que la carpeta de logs exista
function ensureLogDirExists() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
}

// Función para obtener el nombre del archivo de log basado en la fecha actual
function getLogFileName() {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  return path.join(process.cwd(), 'logs', `${dateString}.txt`);
}

// Función para escribir en el log
function logToFile(message: string) {
  ensureLogDirExists();

  const logFileName = getLogFileName();
  const timeStampedMessage = `[${new Date().toISOString()}] ${message}\n`;

  fs.appendFile(logFileName, timeStampedMessage, (err) => {
    if (err) {
      console.error('Error al escribir en el log:', err);
    }
  });
}

// Redefinir `console.log()` para que también escriba en el archivo
const originalLog = console.log;
console.log = (...args: any[]) => {
  originalLog(...args); // Mantener el comportamiento estándar
  logToFile(args.join(' ')); // Escribir en el archivo de log
};

export { logToFile };
