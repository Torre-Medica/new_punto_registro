import { getDevicesConfig } from "../config/devices";
import { dck } from "../config/dck";

const config = getDevicesConfig();

async function openBarrier(): Promise<boolean> {
  console.log("🟢 Se llamó a openBarrier()");

  if (config.I2C_RELAY) {
    const { I2CService } = require("../config/i2c") as typeof import("../config/i2c");
    console.log("🔌 Comunicación I2C habilitada, activando talanquera...");
    const i2CService = new I2CService();
    i2CService.init();
    i2CService.activatePin("OUT1", 1000); // Activa pin 1 (PA0) por 1 segundo
    console.log("✅ Pin OUT1 activado por 1 segundo (I2C)");
    return true;
  } else if (config.DCK_RELAY) {
    console.log("🔌 Comunicación DCK habilitada, abriendo barrera...");
    dck.openCarBarrier();
    console.log("✅ Barrera DCK activada");
    return true;
  }

  console.log("⚠️ Ningún método de relé configurado (ni I2C ni DCK)");
  return false;
}

export default {
  openBarrier,
};
