import path from "path";
import fs from "fs";

let gpio: any = require("onoff").Gpio;

const CONFIG_DIR = path.join(process.cwd(), "config_files");
const CONFIG_FILE = path.join(CONFIG_DIR, "dckConfig.txt");

export class DCK {
  private config!: Record<string, number>;
  private carLoopPin: typeof gpio;
  private bikeLoopPin: typeof gpio;
  private carBarrierPin: typeof gpio;
  private ledRingPin: typeof gpio;
  private visitorButtonPin: typeof gpio;

  private alreadyInitialized = false;
  private visitorButtonCallback: (() => void) | null = null;

  public init() {
    if (this.alreadyInitialized) return;

    console.log("DCK inicializando...");
    this.config = this.loadConfiguration();
    this.initializePins();

    this.alreadyInitialized = true;
  }

  public openCarBarrier() {
    console.log("Activando pin de barrera (pulso)");
    this.carBarrierPin.writeSync(1);
    this.ledRingPin.writeSync(1)
    setTimeout(() => {
      this.carBarrierPin.writeSync(0);
      this.ledRingPin.writeSync(0)
      console.log("Pulso finalizado, pin desactivado.");
    }, this.config.ACTIVATION_TIME_MS);
    //setTimeout(() => this.turnOffLedRing(), 300);
  }
  

  public turnOnLedRing() {
    this.ledRingPin.writeSync(1);
  }

  public turnOffLedRing() {
    this.ledRingPin.writeSync(0);
  }

  public isCarLoopStepped(): boolean {
    return this.carLoopPin.readSync() === 1;
  }

  public isBikeLoopStepped(): boolean {
    return this.bikeLoopPin.readSync() === 1;
  }

  public getVehicleType(): "CARRO" | "MOTO" | false {
    if (this.isCarLoopStepped()) return "CARRO";
    if (this.isBikeLoopStepped()) return "MOTO";
    return false;
  }

  public onVisitorButtonPressed(callback: () => void) {
    this.visitorButtonCallback = callback;

    this.visitorButtonPin.watch((err: Error | null, value: number) => {
      if (err) {
        console.error("Error en el botón de visitante:", err);
        return;
      }

      if (value === 1 && this.visitorButtonCallback) {
        console.log("Boton de visitante presionado.");
        this.visitorButtonCallback();
      }
    });
  }

  private initializePins() {
    console.log("Reconfigurando pines (initializePins)");
    this.cleanup();

    this.carLoopPin = new gpio(this.config.CARLOPPPIN, "in", "both");
    this.bikeLoopPin = new gpio(this.config.BIKELOOPPIN, "in", "both");

    this.carBarrierPin = new gpio(this.config.CARBARRIERPIN, "out", undefined, {
      unexportOnClose: false,
    });
    this.carBarrierPin.writeSync(0); // asegurarse de que inicia en LOW

    this.ledRingPin = new gpio(this.config.LEDRINGPIN, "out");
    this.ledRingPin.writeSync(0);

    this.visitorButtonPin = new gpio(
      this.config.VISITORBUTTONPIN,
      "in",
      "rising",
      { debounceTimeout: 200 }
    );

    console.log("Pines DCK inicializados con la configuracion actual.");
  }

  private cleanup() {
    try {
      this.carLoopPin?.unexport?.();
      this.bikeLoopPin?.unexport?.();
      this.carBarrierPin?.unexport?.();
      this.ledRingPin?.unexport?.();
      this.visitorButtonPin?.unexport?.();
    } catch (err) {
      console.warn("No se pudieron liberar todos los pines.");
    }
  }

  private loadConfiguration(): Record<string, number> {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      console.log("Carpeta 'config_files' creada.");
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      console.log("Archivo de configuración no encontrado. Creando por defecto...");
      const defaultConfig: Record<string, number> = {
        CARLOPPPIN: 25,
        BIKELOOPPIN: 11,
        CARBARRIERPIN: 22,
        LEDRINGPIN: 17,
        VISITORBUTTONPIN: 9,
        ACTIVATION_TIME_MS: 150,
      };
      this.saveConfiguration(defaultConfig);
      return defaultConfig;
    }

    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error leyendo el archivo de configuración:", error);
      return {
        CARLOPPPIN: 25,
        BIKELOOPPIN: 11,
        CARBARRIERPIN: 22,
        LEDRINGPIN: 17,
        VISITORBUTTONPIN: 9,
        ACTIVATION_TIME_MS: 150,
      };
    }
  }

  private saveConfiguration(config: Record<string, number>) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log("Configuracion DCK guardada.");
    } catch (error) {
      console.error("Error guardando configuracion:", error);
    }
  }

  public updateConfiguration(newConfig: Partial<Record<string, number>>) {
    const updatedConfig: Record<string, number> = { ...this.config };

    Object.entries(newConfig).forEach(([key, value]) => {
      if (value !== undefined && typeof value === "number" && !isNaN(value)) {
        updatedConfig[key] = value;
      } else {
        console.warn(`Valor invalido para '${key}':`, value);
      }
    });

    this.config = updatedConfig;
    this.saveConfiguration(updatedConfig);
    this.initializePins(); // Reinicializa con los nuevos valores
    console.log("Configuracion DCK actualizada:", this.config);
  }

}

export const dck = new DCK();
