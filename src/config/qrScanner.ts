import { SerialPort, ReadlineParser } from "serialport";

class QRScanner {
  private port: SerialPort | null = null;
  private onScanCallback: ((qrData: string) => void) | null = null;

  constructor() {}

  public async init() {
    const portPath = await this.findPort();
    if (portPath) {
      this.connect(portPath);
    } else {
      console.log(
        "⚠ No se encontró un lector de QR. Reintentando en 5 segundos..."
      );
      setTimeout(() => this.init(), 5000);
    }
  }

  private async findPort(): Promise<string | null> {
    try {
      const ports = await SerialPort.list();
      const qrPort = ports.find(
        (p) => p.path.includes("/dev/ttyUSB") || p.path.includes("/dev/ttyACM")
      );

      if (qrPort) {
        console.log(`Lector QR detectado en ${qrPort.path}`);
        return qrPort.path;
      }

      return null;
    } catch (error) {
      console.error("Error buscando el puerto del lector QR:", error);
      return null;
    }
  }

  private connect(portPath: string) {
    if (this.port && this.port.isOpen) {
      console.log(
        `El puerto ${portPath} ya está abierto. No se intentará abrir de nuevo.`
      );
      return;
    }

    this.port = new SerialPort({
      path: portPath,
      baudRate: 115200,
      autoOpen: false,
    });

    // Importante: espera a que se libere
    this.port.open((err) => {
      if (err) {
        console.error(`No se pudo abrir el puerto ${portPath}:`, err.message);

        // ⚠️ Asegúrate de cerrarlo explícitamente
        try {
          this.port?.close(() => {
            this.port = null;
          });
        } catch {}

        setTimeout(() => this.init(), 5000);
        return;
      }

      console.log(`Puerto ${portPath} abierto correctamente.`);

      this.port!.on("data", (data) => {
        this.handleQRCode(data.toString());
      });

      this.port!.on("error", (err) => {
        console.error("Error en el lector QR:", err.message);
        this.cleanupAndRetry();
      });

      this.port!.on("close", () => {
        console.log("Conexión con lector QR cerrada, intentando reconectar...");
        this.cleanupAndRetry();
      });
    });

    console.log(`Intentando conexión con ${portPath}...`);
  }

  private cleanupAndRetry() {
    try {
      this.port?.close(() => {
        this.port = null;
        setTimeout(() => this.init(), 5000);
      });
    } catch {
      this.port = null;
      setTimeout(() => this.init(), 5000);
    }
  }

  private async handleQRCode(qrData: string) {
    const cleanedInfo = await this.validateData(qrData);
    if (cleanedInfo) {
      console.log(`Código QR limpio: ${cleanedInfo}`);
      if (this.onScanCallback) {
        this.onScanCallback(cleanedInfo);
      }
    }
  }

  public onQRCode(callback: (qrData: string) => void) {
    this.onScanCallback = callback;
  }

  private async validateData(value: string) {
    try {
      value = value.replace(/[\[\]][Q0]+/g, "").trim();

      if (value.includes(",")){
        return value.split(",")[0];
      }

      // Verifica si es UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(value)) {
        return value;
      }

      // Verifica si es una URL con parámetro companyCode
      if (value.includes("http")) {
          const url = new URL(value);
          const companyCode = url.searchParams.get("companyCode");
          if (companyCode) return companyCode;
      }
      console.log(`El código leído NO tiene un formato válido.`);
      return value;
    } catch (error) {
      console.error("Error validando datos:", error);
      return null;
    }
  }
}

export default new QRScanner();
