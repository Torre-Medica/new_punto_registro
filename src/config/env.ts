import dotenv from 'dotenv';

dotenv.config();

const envConfig = {
  PORT: process.env.PORT || 4000,
  NEST_SERVER_URL: process.env.NEST_SERVER_URL || 'http://localhost:3000',
  I2C_ADDRESS: parseInt(process.env.I2C_ADDRESS || '0x20', 16),
  I2C_REGISTER:parseInt(process.env.I2C_REGISTER || '0x00'),
  TIMELAPSEBETWEENREADINGS:parseInt(process.env.TIMELAPSEBETWEENREADINGS || '1000'),
  BUTTON_REQUEST_TTL_MS: parseInt(process.env.BUTTON_REQUEST_TTL_MS || '300000', 10),
  JAVA_SERVER_URL: process.env.JAVA_SERVER_URL || `http://localhost:8080/imprimir`,
  DEVICETYPE: process.env.DEVICETYPE || "OUT",
  DETECTEDPLATE: process.env.DETECTEDPLATE || false,
  DEVICE_UUID: process.env.DEVICE_UUID || '',
};

export default envConfig;
