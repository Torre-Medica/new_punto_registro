import net from "net";
import fs from "fs";
import path from "path";

const CONFIG_DIR = path.join(process.cwd(), "config_files");
const CONFIG_FILE = path.join(CONFIG_DIR, "uhfConfig.txt");

class UHFAntenna {
  private client: net.Socket;
  private isConnected: boolean = false;
  private isReading: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 60; // 5 minutos (60 intentos x 5 segundos)
  private tagReadCallback: ((tagId: string) => void) | null = null;
  private config: Record<string, string>;
  private periodicRestartInterval: NodeJS.Timeout | null = null;
  private intentionalDisconnect: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new net.Socket();
    this.config = this.loadConfiguration();
  }

  public init() {
    try {
      this.connect();
      this.startHeartbeat();
    } catch (error) {
      console.error("[UHF] Error en init:", error);
      this.handleReconnect();
    }
  }

  private connect() {
    if (this.isConnected || this.client.connecting) {
      console.log("[UHF] Intento de conexión duplicado, esperando...");
      return;
    }

    this.isReconnecting = false;
    this.client.removeAllListeners();

    console.log(
      `[UHF] Intentando conectar a la antena en ${this.config.UHF_ANTENNA_IP}:${this.config.UHF_ANTENNA_PORT}`
    );

    this.setupListeners();

    this.client.connect(
      parseInt(this.config.UHF_ANTENNA_PORT),
      this.config.UHF_ANTENNA_IP,
      () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(
          `[UHF] Conectado a la antena en ${this.config.UHF_ANTENNA_IP}:${this.config.UHF_ANTENNA_PORT}`
        );
        this.startReading();
      }
    );
  }

  private setupListeners() {
    this.client.setKeepAlive(true, 10000); // Reducido a 10 segundos
    this.client.setTimeout(15000); // Timeout de 15 segundos

    // Agregar listener de timeout
    this.client.on("timeout", () => {
      console.warn("[UHF] Socket timeout detectado");
      this.handleReconnect();
    });

    this.client.on("data", (data) => {
      try {
        if (data.length === 5) {
          this.sendCommand([0x0a, 0xff, 0x03, 0x80, 0x00, 0x74]);
        } else if (data.length === 7) {
          if (data[5] === 0x01) {
            this.sendCommand([0x0a, 0xff, 0x03, 0x41, 0x10, 0xa3]);
          } else {
            this.sendCommand([0x0a, 0xff, 0x02, 0x44, 0xb1]);
          }
        } else if (data.length === 16 || data.length === 20) {
          const tagSerial = this.toHexString(
            new Uint8Array(data.subarray(7, data.length - 1))
          ).toUpperCase();
          console.log(`[UHF] Tag leído: ${tagSerial}`);
          if (this.tagReadCallback) {
            this.tagReadCallback(tagSerial);
          }
          const delay = parseInt(this.config.TIMELAPSEBETWEENREADINGS);
          console.log(
            `[UHF] Esperando ${
              delay / 1000
            } segundos antes de siguiente lectura`
          ); // Corregido división
          setTimeout(() => {
            this.sendCommand([0x0a, 0xff, 0x02, 0x44, 0xb1]);
          }, delay);
        } else {
          this.sendCommand([0x0a, 0xff, 0x03, 0x80, 0x00, 0x74]);
        }
      } catch (error) {
        console.error("[UHF] Error procesando datos:", error);
        // No provocamos reconexión aquí para evitar ciclos
      }
    });

    this.client.on("error", (err) => {
      console.error(`[UHF] Error en conexión: ${err.message}`);
      this.isConnected = false;
      this.isReading = false;

      if (this.intentionalDisconnect) {
        console.log(
          "[UHF] Desconexión intencional, no se reconectará automáticamente."
        );
        this.intentionalDisconnect = false;
        return;
      }

      if ((err as NodeJS.ErrnoException).code === "ECONNRESET") {
        console.warn("[UHF] ECONNRESET detectado, intentando reconectar...");
      }

      this.handleReconnect();
    });

    this.client.on("close", () => {
      console.warn("[UHF] Conexión cerrada");
      this.isConnected = false;
      this.isReading = false;

      if (this.intentionalDisconnect) {
        console.log(
          "[UHF] Desconexión intencional, no se reconectará automáticamente."
        );
        this.intentionalDisconnect = false;
        return;
      }

      this.handleReconnect();
    });
  }

  private handleReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    // Detener heartbeat si existe
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "[UHF] Máximo de intentos alcanzado. Reiniciando proceso..."
      );
      this.reconnectAttempts = 0;
      this.isReconnecting = false;

      // En lugar de detener, esperamos más tiempo y reintentamos
      setTimeout(() => {
        console.log("[UHF] Reiniciando proceso de conexión...");
        this.init();
      }, 30000); // 30 segundos de espera
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[UHF] Intento de reconexión #${this.reconnectAttempts} en 5 segundos...`
    );

    if (!this.client.destroyed) {
      this.client.destroy();
    }

    setTimeout(() => {
      try {
        this.client = new net.Socket();
        this.connect();
      } catch (error) {
        console.error("[UHF] Error durante la reconexión:", error);
      } finally {
        this.isReconnecting = false;
      }
    }, 5000);
  }

  public startReading() {
    if (!this.isReading) {
      this.isReading = true;
      console.log("[UHF] Iniciando lectura de tags...");
      this.sendCommand([0x0a, 0xff, 0x02, 0x44, 0xb1]);
    }
  }

  public stopReading() {
    if (this.isReading) {
      this.intentionalDisconnect = true;
      this.client.destroy();
      this.isReading = false;
      this.isConnected = false;
      console.log("[UHF] Lectura detenida y conexión cerrada");
    }
  }

  public onTagRead(callback: (tagId: string) => void) {
    this.tagReadCallback = callback;
  }

  private sendCommand(command: number[]) {
    if (!this.client || this.client.destroyed) {
      console.warn("[UHF] Socket destruido o no inicializado");
      this.handleReconnect();
      return;
    }

    if (!this.isConnected) {
      console.warn("[UHF] No hay conexión. Intentando reconectar...");
      this.handleReconnect();
      return;
    }

    try {
      const buffer = Buffer.from(command);
      this.client.write(buffer, (error) => {
        if (error) {
          console.error("[UHF] Error al escribir en el socket:", error);
          this.handleReconnect();
        }
      });
    } catch (error) {
      console.error("[UHF] Error al enviar comando:", error);
      this.handleReconnect();
    }
  }

  private toHexString(byteArray: Uint8Array): string {
    return Array.from(byteArray, (byte) =>
      ("0" + (byte & 0xff).toString(16)).slice(-2)
    ).join("");
  }

  private loadConfiguration(): Record<string, string> {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      console.log("[UHF] Carpeta 'config_files' creada.");
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      console.log(
        "[UHF] Archivo de configuración no encontrado. Creando uno nuevo..."
      );
      const defaultConfig = {
        UHF_ANTENNA_IP: "192.168.1.112",
        UHF_ANTENNA_PORT: "100",
        TIMELAPSEBETWEENREADINGS: "5000",
      };
      this.saveConfiguration(defaultConfig);
      return defaultConfig;
    }

    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("[UHF] Error al leer configuración:", error);
      return {
        UHF_ANTENNA_IP: "192.168.1.112",
        UHF_ANTENNA_PORT: "100",
        TIMELAPSEBETWEENREADINGS: "5000",
      };
    }
  }

  private saveConfiguration(config: Record<string, string>) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log("[UHF] Configuración guardada:", config);
    } catch (error) {
      console.error("[UHF] Error al guardar configuración:", error);
    }
  }

  public updateConfiguration(newConfig: Partial<Record<string, string>>) {
    const updatedConfig = { ...this.config };

    Object.entries(newConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        updatedConfig[key] = value;
      }
    });

    if (
      updatedConfig.UHF_ANTENNA_PORT &&
      isNaN(parseInt(updatedConfig.UHF_ANTENNA_PORT))
    ) {
      console.error("[UHF] Error: El puerto debe ser un número válido.");
      return;
    }
    if (
      updatedConfig.TIMELAPSEBETWEENREADINGS &&
      isNaN(parseInt(updatedConfig.TIMELAPSEBETWEENREADINGS))
    ) {
      console.error(
        "[UHF] Error: El tiempo entre lecturas debe ser un número válido."
      );
      return;
    }

    this.config = updatedConfig;
    this.saveConfiguration(updatedConfig);
    console.log("[UHF] Configuración actualizada:", this.config);
  }

  public getConfiguration(): Record<string, string> {
    return this.config;
  }

  /**
   * Inicia el reinicio periódico que desconecta y reconecta la antena cada intervalo (por defecto 1 hora).
   */
  public startPeriodicRestart(intervalMs: number = 3600000) {
    if (this.periodicRestartInterval) {
      clearInterval(this.periodicRestartInterval);
    }
    this.periodicRestartInterval = setInterval(() => {
      console.log("[UHF] Reinicio periódico: desconectando antena...");
      this.stopReading();
      setTimeout(() => {
        console.log("[UHF] Reinicio periódico: reconectando antena...");
        this.init();
      }, 5000); // espera 5 segundos antes de reconectar
    }, intervalMs);
    console.log(
      `[UHF] Reinicio periódico iniciado: cada ${intervalMs / 60000} minutos.`
    );
  }

  /**
   * Detiene el reinicio periódico.
   */
  public stopPeriodicRestart() {
    if (this.periodicRestartInterval) {
      clearInterval(this.periodicRestartInterval);
      this.periodicRestartInterval = null;
      console.log("[UHF] Reinicio periódico detenido");
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected) {
        console.warn("[UHF] Heartbeat: Conexión perdida");
        this.handleReconnect();
        return;
      }

      try {
        this.sendCommand([0x0a, 0xff, 0x03, 0x80, 0x00, 0x74]);
      } catch (error) {
        console.error("[UHF] Error en heartbeat:", error);
        this.handleReconnect();
      }
    }, 15000); // Cada 15 segundos
  }
}

export default new UHFAntenna();
