import net from "net";
import fs from "fs";
import path from "path";

/** === Config persistente === */
const CONFIG_DIR = path.join(process.cwd(), "config_files");
const CONFIG_FILE = path.join(CONFIG_DIR, "uhfConfig.txt");

type UHFConfig = {
  UHF_ANTENNA_IP: string;
  UHF_ANTENNA_PORT: number;
  TIMELAPSEBETWEENREADINGS: number; // ms
  AUTO_PERIODIC_RESTART?: boolean;
  PERIODIC_RESTART_MS?: number;
};

class UHFAntenna {
  private client: net.Socket;
  private isConnected = false;
  private isReading = false;

  /** Locks/estado de conexión */
  private connecting = false;       // hay un connect() en curso
  private isReconnecting = false;   // hay un ciclo de reconexión en curso
  private reconnectAttempts = 0;

  /** Backoff (sin límite de intentos) */
  private readonly baseDelay = 1000;  // 1s
  private readonly maxDelay = 30000; // 30s

  /** Token para invalidar timeouts/listeners viejos */
  private opGen = 0;

  /** Callbacks */
  private tagReadCallback: ((tagId: string) => void) | null = null;

  /** Config */
  private config: UHFConfig;

  /** Timers */
  private periodicRestartInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /** Control explícito de parada */
  private intentionalDisconnect = false;

  /** Anti-rebote de tags */
  private seenTags = new Map<string, number>();
  private tagSuppressMs = 1000;

  constructor() {
    this.client = new net.Socket();
    this.config = this.loadConfiguration();
  }

  /** Arranca el flujo (conecta y queda en loop de reconexión infinito si cae) */
public init() {
  try {
    this.intentionalDisconnect = false;
    this.connect();
    if (this.config.AUTO_PERIODIC_RESTART && !this.periodicRestartInterval) {
      const ms = this.config.PERIODIC_RESTART_MS ?? 3600000;
      this.startPeriodicRestart(ms);
    }
  } catch (error) {
    console.error("[UHF] Error en init:", error);
    this.safeReconnect();
  }
}

  /** ==== Conexión idempotente ====
   * - No entra si ya está conectando o conectado
   * - Crea socket nuevo y listeners con 'gen' local
   * - Al conectar: reinicia heartbeat, resetea backoff, empieza lectura
   */
  private connect() {
    if (this.isConnected || this.connecting) {
      console.log("[UHF] Conexión en curso o ya conectada; omito connect().");
      return;
    }

    this.connecting = true;
    this.isReconnecting = true;
    const gen = ++this.opGen; // token para esta operación

    try { this.client.destroy(); } catch { }
    this.client = new net.Socket();
    this.client.removeAllListeners();
    this.setupListeners(gen);

    console.log(
      `[UHF] Intentando conectar a ${this.config.UHF_ANTENNA_IP}:${this.config.UHF_ANTENNA_PORT}`
    );

    this.client.connect(
      this.config.UHF_ANTENNA_PORT,
      this.config.UHF_ANTENNA_IP,
      () => {
        if (gen !== this.opGen) {
          console.warn("[UHF] Conexión obsoleta (gen mismatch), cierro socket.");
          this.client.destroy();
          return;
        }
        this.isConnected = true;
        this.connecting = false;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;

        console.log("[UHF] Conectado correctamente.");
        this.startHeartbeat(); // reinicia SIEMPRE al reconectar
        this.startReading();
      }
    );
  }

  /** Listeners protegidos por 'gen' para ignorar sockets viejos */
  private setupListeners(gen: number) {
    this.client.setKeepAlive(true, 10000);
    this.client.setTimeout(30000); // dejar > heartbeat

    this.client.on("timeout", () => {
      if (gen !== this.opGen) return;
      console.warn("[UHF] Socket timeout");
      this.isConnected = false;
      this.connecting = false;
      this.isReconnecting = false;          // liberar para permitir safeReconnect
      if (!this.intentionalDisconnect) {
        this.safeReconnect();
      }
    });

    this.client.on("error", (err: any) => {
      if (gen !== this.opGen) return;
      console.error("[UHF] Error socket:", err?.code || err?.message);
      this.isConnected = false;
      this.connecting = false;
      this.isReconnecting = false;          // liberar para permitir safeReconnect
      this.isReading = false;
      if (!this.intentionalDisconnect) this.safeReconnect();
      else this.intentionalDisconnect = false;
    });

    this.client.on("close", () => {
      if (gen !== this.opGen) return;
      console.warn("[UHF] Conexión cerrada");
      this.isConnected = false;
      this.connecting = false;
      this.isReconnecting = false;          // liberar para permitir safeReconnect
      this.isReading = false;
      if (!this.intentionalDisconnect) this.safeReconnect();
      else this.intentionalDisconnect = false;
    });

    this.client.on("data", (data) => {
      if (gen !== this.opGen) return;
      try {
        // Nota: este parser es básico; idealmente parsear por frames.
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
          if (this.tagReadCallback && this.shouldEmit(tagSerial)) {
            this.tagReadCallback(tagSerial);
          }
          const delay = this.config.TIMELAPSEBETWEENREADINGS;
          console.log(`[UHF] Esperando ${delay / 1000} s antes de siguiente lectura`);
          setTimeout(() => {
            this.sendCommand([0x0a, 0xff, 0x02, 0x44, 0xb1]);
          }, delay);
        } else {
          this.sendCommand([0x0a, 0xff, 0x03, 0x80, 0x00, 0x74]);
        }
      } catch (error) {
        console.error("[UHF] Error procesando datos:", error);
      }
    });
  }

  /** === Reconexión infinita, single-flight, con backoff y jitter === */
  private nextDelay() {
    const exp = Math.min(this.reconnectAttempts, 5); // 1,2,4,8,16,32
    const d = Math.min(this.baseDelay * (1 << exp), this.maxDelay);
    const jitter = Math.floor(d * 0.2 * Math.random());
    return d + jitter;
  }

  private safeReconnect() {
    if (this.intentionalDisconnect) return; // tú la paraste => no reintentar
    if (this.connecting || this.isReconnecting) {
      console.log("[UHF] Ya hay un intento de conexión/reconexión en curso.");
      return;
    }

    this.isConnected = false;
    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = this.nextDelay();
    console.log(
      `[UHF] Intento de reconexión #${this.reconnectAttempts} en ${Math.round(
        delay / 1000
      )}s...`
    );

    try { if (!this.client.destroyed) this.client.destroy(); } catch { }

    // invalida operaciones anteriores
    const gen = ++this.opGen;

    setTimeout(() => {
      if (this.intentionalDisconnect) {
        this.isReconnecting = false;
        return;
      }
      // si otro flujo arrancó, aborta este timeout
      if (gen !== this.opGen) return;
      this.connect(); // apaga isReconnecting en connect() al lograr conectar
    }, delay);
  }

  /** Inicia la lectura (si y solo si hay conexión estable) */
  public startReading() {
    if (!this.isReading && this.isConnected && !this.isReconnecting) {
      this.isReading = true;
      console.log("[UHF] Iniciando lectura de tags...");
      this.sendCommand([0x0a, 0xff, 0x02, 0x44, 0xb1]);
    }
  }

  /** Detiene todo y rompe el loop de reconexión (uso manual) */
  public stopReading() {
    this.intentionalDisconnect = true; // parada total: no reintentar
    this.isReading = false;
    this.isConnected = false;
    this.connecting = false;
    this.isReconnecting = false;
    this.clearIntervals(); // limpia heartbeat + reinicio periódico
    try { this.client.destroy(); } catch { }
    console.log("[UHF] Lectura detenida y conexión cerrada");
  }

  /** Callback para tags */
  public onTagRead(callback: (tagId: string) => void) {
    this.tagReadCallback = callback;
  }

  /** Envío de comandos seguro (no dispara reconexiones paralelas) */
  private sendCommand(command: number[]) {
    if (this.isReconnecting || this.connecting) {
      console.warn("[UHF] En reconexión/conexión; comando descartado.");
      return;
    }
    if (!this.client || this.client.destroyed || !this.isConnected) {
      console.warn("[UHF] Socket no disponible; se intentará reconectar.");
      this.safeReconnect();
      return;
    }
    try {
      const buffer = Buffer.from(command);
      this.client.write(buffer, (error) => {
        if (error) {
          const code = (error as any)?.code;
          if (code === "ERR_SOCKET_CLOSED" || code === "EPIPE") {
            console.error("[UHF] Escritura en socket cerrado:", error);
            this.isConnected = false;
            this.safeReconnect();
          } else {
            console.error("[UHF] Error al escribir en el socket:", error);
          }
        }
      });
    } catch (error: any) {
      const code = error?.code;
      if (code === "ERR_SOCKET_CLOSED" || code === "EPIPE") {
        console.error("[UHF] Envío falló (socket cerrado):", error);
        this.isConnected = false;
        this.safeReconnect();
      } else {
        console.error("[UHF] Error al enviar comando:", error);
      }
    }
  }

  /** Heartbeat: ping periódico; NO crea reconexiones en paralelo */
  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.intentionalDisconnect) return;
      if (!this.isConnected) {
        if (!this.connecting && !this.isReconnecting) this.safeReconnect();
        return;
      }
      // comando "ping" / keepalive del equipo
      this.sendCommand([0x0a, 0xff, 0x03, 0x80, 0x00, 0x74]);
    }, 10000);
  }

  /** Reinicio periódico opcional (por defecto 1h); coordina con locks */
  public startPeriodicRestart(intervalMs: number = 3600000) {
    if (this.periodicRestartInterval) clearInterval(this.periodicRestartInterval);

    this.periodicRestartInterval = setInterval(() => {
      console.log("[UHF] Reinicio periódico: desconectando antena (sin marcar intencional)...");
      // Cerrar la conexión y heartbeat, pero sin bloquear el loop de reconexión
      this.stopReadingInternal();
      // Dar unos segundos para liberar recursos del kernel y la antena
      setTimeout(() => {
        console.log("[UHF] Reinicio periódico: reconectando antena...");
        // Asegurar que NO está marcada como intencional
        this.intentionalDisconnect = false;
        if (!this.connecting && !this.isReconnecting) {
          this.init(); // relanza el ciclo normal (connect + heartbeat + lectura)
        } else {
          console.log("[UHF] Reinicio periódico: ya hay conexión/reconexión en curso; omito init().");
        }
      }, 5000);
    }, intervalMs);

    console.log(
      `[UHF] Reinicio periódico iniciado: cada ${Math.round(intervalMs / 60000)} min.`
    );
  }

  public stopPeriodicRestart() {
    if (this.periodicRestartInterval) {
      clearInterval(this.periodicRestartInterval);
      this.periodicRestartInterval = null;
      console.log("[UHF] Reinicio periódico detenido");
    }
  }

  /** === Helpers de parada sin romper el reinicio periódico === */
  private stopReadingInternal() {
    this.isReading = false;
    this.isConnected = false;
    this.connecting = false;
    this.isReconnecting = false;
    this.clearHeartbeat();     // solo limpiamos heartbeat; NO cancelar el timer periódico
    try { this.client.destroy(); } catch { }
    console.log("[UHF] Lectura detenida (reinicio interno), conexión cerrada");
  }

  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearIntervals() {
    // Parada total: limpiar heartbeat y también el reinicio periódico
    this.clearHeartbeat();
    if (this.periodicRestartInterval) {
      clearInterval(this.periodicRestartInterval);
      this.periodicRestartInterval = null;
    }
  }

  /** === Config === */
  private loadConfiguration(): UHFConfig {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      console.log("[UHF] Carpeta 'config_files' creada.");
    }
    if (!fs.existsSync(CONFIG_FILE)) {
      console.log("[UHF] Config no encontrada. Creando default...");
      const defaultConfig: UHFConfig = {
        UHF_ANTENNA_IP: "192.168.1.112",
        UHF_ANTENNA_PORT: 100,
        TIMELAPSEBETWEENREADINGS: 5000,
      };
      this.saveConfiguration(defaultConfig);
      return defaultConfig;
    }
    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const raw = JSON.parse(data);
      const cfg: UHFConfig = {
        UHF_ANTENNA_IP: String(raw.UHF_ANTENNA_IP ?? "192.168.1.112"),
        UHF_ANTENNA_PORT: Number(raw.UHF_ANTENNA_PORT ?? 100),
        TIMELAPSEBETWEENREADINGS: Number(raw.TIMELAPSEBETWEENREADINGS ?? 5000),
        AUTO_PERIODIC_RESTART: Boolean(raw.AUTO_PERIODIC_RESTART ?? false),
        PERIODIC_RESTART_MS: Number(raw.PERIODIC_RESTART_MS ?? 3600000), // 1h por defecto
      };
      return cfg;
    } catch (error) {
      console.error("[UHF] Error al leer configuración, usando default:", error);
      return {
        UHF_ANTENNA_IP: "192.168.1.112",
        UHF_ANTENNA_PORT: 100,
        TIMELAPSEBETWEENREADINGS: 5000,
      };
    }
  }

  private saveConfiguration(config: UHFConfig) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log("[UHF] Configuración guardada:", config);
    } catch (error) {
      console.error("[UHF] Error al guardar configuración:", error);
    }
  }

  public updateConfiguration(newConfig: Partial<UHFConfig>) {
    const updated: UHFConfig = {
      ...this.config,
      ...newConfig,
    };
    if (
      updated.UHF_ANTENNA_PORT !== undefined &&
      Number.isNaN(Number(updated.UHF_ANTENNA_PORT))
    ) {
      console.error("[UHF] Error: El puerto debe ser numérico.");
      return;
    }
    if (
      updated.TIMELAPSEBETWEENREADINGS !== undefined &&
      Number.isNaN(Number(updated.TIMELAPSEBETWEENREADINGS))
    ) {
      console.error("[UHF] Error: TIMELAPSEBETWEENREADINGS debe ser numérico.");
      return;
    }
    this.config = {
      UHF_ANTENNA_IP: String(updated.UHF_ANTENNA_IP),
      UHF_ANTENNA_PORT: Number(updated.UHF_ANTENNA_PORT),
      TIMELAPSEBETWEENREADINGS: Number(updated.TIMELAPSEBETWEENREADINGS),
    };
    this.saveConfiguration(this.config);
    console.log("[UHF] Configuración actualizada:", this.config);
  }

  public getConfiguration(): UHFConfig {
    return this.config;
  }
  
  private toHexString(byteArray: Uint8Array): string {
    return Array.from(byteArray, (byte) =>
      ("0" + (byte & 0xff).toString(16)).slice(-2)
    ).join("");
  }
  
    private shouldEmit(tag: string): boolean {
    const now = Date.now();
    const exp = this.seenTags.get(tag) || 0;
    if (now < exp) return false;
    this.seenTags.set(tag, now + this.tagSuppressMs);
    return true;
  }
  
  
}

export default new UHFAntenna();
