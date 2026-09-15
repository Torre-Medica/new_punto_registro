import { getDevicesConfig } from "../config/devices";
import { I2CService } from "../config/i2c";
import { dck } from "../config/dck"; // Importación explícita de la instancia

const config = getDevicesConfig();

async function vehicleKind(): Promise<'CARRO' | 'MOTO' | false> {
  if (config.I2C_RELAY) {
    const i2CService = new I2CService();
    console.log("Comunicación I2C habilitada.");
    const responseLoopCarro = await i2CService.isPinActive("IN2");
    const responseLoopMoto = await i2CService.isPinActive("IN3");

    if (responseLoopCarro) return "CARRO";
    if (responseLoopMoto) return "MOTO";
    return false;

  } else if (config.DCK_RELAY) {
    
    return dck.getVehicleType(); // ya devuelve 'CARRO' | 'MOTO' | false
  }

  return false;
}

export default {
  vehicleKind
};
