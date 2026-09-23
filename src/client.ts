import socket from "./config/socket";
import { getDevicesConfig } from "./config/devices";
import UHFAntenna from "./config/uhf";
import qrScanner from "./config/qrScanner";
import { I2CService } from "./config/i2c"; // Importación clara del módulo corregido
const config = getDevicesConfig();
import envConfig from "./config/env";
import vehicleType from "./services/vehicleType";
import { dck } from "./config/dck";
import { LPRService } from "./config/lpr";

const lpr = new LPRService();
const buttonRequestTtlMs = Math.min(
  Math.max(envConfig.BUTTON_REQUEST_TTL_MS, 120000),
  300000,
);

const safeEmitButtonRequest = (payload: Record<string, any>) => {
  if (!socket.connected) {
    console.log('[boton] Socket no conectado; se descarta el evento para evitar cola.');
    return;
  }

  // Los eventos de boton no deben quedar en el buffer de Socket.IO durante una desconexion.
  socket.volatile.emit('request_entry', payload);
  console.log(`[boton] Evento enviado; TTL configurado: ${buttonRequestTtlMs}ms.`);
};

// 🚀 Iniciar listener directo en puerto 17005 (ejemplo)

if (config.PASSTHROUGHLPR) {
  lpr.startListening(17005);
}

const lprTracker = {
  lastPlate: "",
  lastTime: 0,
};

const qrTracker = {
  lastQR: "",
  lastTime: 0,
};

const tagTracke = {
  lasTag: "",
  lastTime: 0,
};

const deviceType = envConfig.DEVICETYPE;

socket.on("connect", () => {
  console.log("Conectado al servidor principal");
});

socket.on("disconnect", () => {
  console.log("Desconectado del servidor principal");
});

if (config.UHF_ANTENNA) {
  console.log("Cliente UHF inicializado, esperando lecturas...");
  UHFAntenna.init();
  const dataConfig = UHFAntenna.getConfiguration();

  UHFAntenna.onTagRead(async (tagId: string) => {
    let vehicleKind: any = false;
    let plate: string = "";
    let url: string = "";

    vehicleKind = await vehicleType.vehicleKind();
    const now = Date.now();
    if (
      tagId === tagTracke.lasTag &&
      now - tagTracke.lastTime < envConfig.TIMELAPSEBETWEENREADINGS * 2
    ) {
      console.log("Tag leido demasiado rapido, ignorando...");
      return;
    }

    tagTracke.lasTag = tagId;
    tagTracke.lastTime = now;

      const plateInfo = await infoPlate();
      plate = plateInfo.plate;
      url = plateInfo.url;
    

    console.log(`Tag leido: ${tagId}`);
    socket.emit("reading_uhf", {
      info: tagId,
      devicesType: deviceType,
      ipUhf: dataConfig.UHF_ANTENNA_IP,
      vehicleKind: vehicleKind,
      url: url,
      plate: plate,
    });
  });
} else {
  console.log("UHF no inicializada.");
}

if (config.QR_SCANNER) {
  // 📡 Comunicación QR

  qrScanner.init();

  let plate: string = "";
  let url: string = "";

  qrScanner.onQRCode(async (qrData: string) => {
    const now = Date.now();
    let vehicleKind: any = false;
    vehicleKind = await vehicleType.vehicleKind();

    if (
      qrData === qrTracker.lastQR &&
      now - qrTracker.lastTime < envConfig.TIMELAPSEBETWEENREADINGS
    )
      return;

    qrTracker.lastQR = qrData;
    qrTracker.lastTime = now;
      const plateInfo = await infoPlate();
      plate = plateInfo.plate;
      url = plateInfo.url;

    socket.emit("reading_lector", {
      info: qrData,
      devicesType: deviceType,
      vehicleKind: vehicleKind,
      url: url,
      plate: plate,
    });
  });
} else {
  console.log("QR no inicializado.");
}

if (config.I2C_RELAY) {
  const i2CService = new I2CService();
  console.log("Comunicación I2C habilitada.");
  i2CService.init();

  setInterval(async () => {
    const activeInputs = await i2CService.checkInputs();
    let vehicleKind: any = false;
    let plate: string = "";
    let url: string = "";

    activeInputs.forEach(async (input) => {
      if (input === "IN1") {
          const plateInfo = await infoPlate();
          plate = plateInfo.plate;
          url = plateInfo.url;
        

        if (envConfig.DEVICETYPE.includes("IN")) {
          vehicleKind = await vehicleType.vehicleKind();
          console.log("Boton activado.");
          safeEmitButtonRequest({
            devicesType: deviceType,
            url: "",
            plate: "",
            vehicleKind: vehicleKind,
          });
        } else if (envConfig.DEVICETYPE.includes("OUT")) {
          console.log("No hay acciones por botón");
        }}
      });
  }, 500);
} else {
  console.log(" Comunicación I2C deshabilitada.");
}

if (config.DCK_RELAY) {
  dck.init();
  let vehicleKind: any = false;
  let plate: string = "";
  let url: string = "";

  dck.onVisitorButtonPressed(async () => {
    vehicleKind = await vehicleType.vehicleKind();
      const plateInfo = await infoPlate();
      plate = plateInfo.plate;
      url = plateInfo.url;
    
    console.log("Boton activado.");
    if (envConfig.DEVICETYPE.includes("IN")) {
      safeEmitButtonRequest({
        devicesType: deviceType,
        url: url,
        plate: plate,
        vehicleKind: vehicleKind,
      });
    } else if (envConfig.DEVICETYPE.includes("OUT")) {
      console.log("No hay acciones por botón");}
    });
} else {
  console.log("Comunicación DCK deshabilitada.");
}

if (config.PASSTHROUGHLPR) {
  lpr.on("plate", async ({ plate, url, timestamp }) => {
    const now = Date.now();

    // Evitar repeticiones muy rápidas
    if (
      plate === lprTracker.lastPlate &&
      now - lprTracker.lastTime < envConfig.TIMELAPSEBETWEENREADINGS
    ) {
      console.log("📛 Placa repetida demasiado rápido, ignorada.");
      return;
    }

    // Actualizar último evento
    lprTracker.lastPlate = plate;
    lprTracker.lastTime = now;

    console.log(`📨 Nueva placa valida: ${plate}`);

    // 🔔 Aquí disparas tu lógica (por ahora un evento al servidor principal)
    socket.emit("reading_lpr", {
      deviceType,
      plate,
      url,
      devicesType: envConfig.DEVICETYPE,
    });
  });
}

async function infoPlate(): Promise<{ plate: string; url: string }> {
  // Si hay una lectura reciente (ej: últimos 3 segundos), úsala directamente
  const now = Date.now();

  if (envConfig.DETECTEDPLATE === 'true') {
    if (lpr.lastDetectedPlate && now - lpr.lastDetectedTime < 3000) {
    console.log(
      ` ------------ Retornando placa ${lpr.lastDetectedPlate}------------`
    );
    return { plate: lpr.lastDetectedPlate, url: lpr.urlDetected ?? "" };
  } else {
    console.log("------------Tiempo de espera agotado para placa------------");
    return { plate: "", url: "" };
  }
  }else {
    console.log("------------infoplate desactivado------------");
    return { plate: "", url: "" };
    }
  
}
