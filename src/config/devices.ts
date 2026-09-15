import fs from 'fs';
import path from 'path';
const CONFIG_DIR = path.join(process.cwd(), "config_files");
const CONFIG_FILE = path.join(CONFIG_DIR, 'devicesConfig.txt');

// Función para leer la configuración desde el archivo
function loadDevicesConfig(): Record<string, boolean> {
  
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    console.log("Carpeta 'config_files' creada en la raíz del proyecto.");
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    console.log('Archivo de configuración no encontrado. Creando uno nuevo con valores por defecto...');
    const defaultConfig: Record<string, boolean> = { 
      UHF_ANTENNA: false, QR_SCANNER: false, I2C_RELAY: false, HASPRINTER: false, DCK_RELAY: false, PASSTHROUGHLPR: false,

    };
    saveDevicesConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer el archivo de configuración:', error);
    return { 
      UHF_ANTENNA: false,
      QR_SCANNER: false, 
      I2C_RELAY: false,
      HASPRINTER: false,
      DCK_RELAY: false,
      PASSTHROUGHLPR: false,
    }; // Valores por defecto en caso de error
  }
}

// Función para escribir la configuración en el archivo
function saveDevicesConfig(config: Record<string, boolean>) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('Configuración de dispositivos guardada:', config);
  } catch (error) {
    console.error('Error al guardar el archivo de configuración:', error);
  }
}

// Configuración inicial
let devicesConfig: Record<string, boolean> = loadDevicesConfig();

// Método para obtener la configuración
export function getDevicesConfig(): Record<string, boolean> {
  return devicesConfig;
}

// Método para actualizar la configuración
export function updateDevicesConfig(newConfig: Partial<Record<string, boolean>>) {
  // Filtrar valores `undefined` y forzar que sean `boolean`
  const updatedConfig: Record<string, boolean> = { ...devicesConfig };
  
  Object.entries(newConfig).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      updatedConfig[key] = value;
    }
  });

  devicesConfig = updatedConfig;
  saveDevicesConfig(devicesConfig);
  console.log('Configuración de dispositivos actualizada:', devicesConfig);
}
