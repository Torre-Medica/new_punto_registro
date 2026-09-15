import net from "net";
import EventEmitter from "events";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export class LPRService extends EventEmitter {
  private listenerServer?: net.Server;
  public lastDetectedPlate: string | null = null;
  public urlDetected: string | null = null;
  public lastDetectedTime: number = 0; // timestamp de última detección

  constructor() {
    super();
  }

  /**
   * Inicia el servidor TCP que escucha las placas enviadas por la cámara 3
   */
  startListening(puerto: number) {
    console.log("🚀 Iniciando listener LPR...");
    if (this.listenerServer) {
      console.log("⚠️ Listener LPR ya iniciado.");
      return;
    }

    const server = net.createServer();

    server.on("connection", (socket) => {
      console.log(`🔗 Conexión LPR desde ${socket.remoteAddress}:${socket.remotePort}`);
      socket.setEncoding("utf8");

      let acc = "";

      socket.on("data", (chunk) => {
        acc += chunk;

        // Buscar XMLs completos de tipo infoplate
        const regex = /<\?xml[\s\S]*?<\/\s*(?:infoplate|InfoPlate)\s*>/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(acc)) !== null) {
          const rawXml = m[0];
          const plate = this.extractPlateFromLPRData(rawXml);
          if (plate) {
            this.lastDetectedTime = Date.now(); // ⏱️ actualizar timestamp
            console.log(`📸 LPR: plate=${plate}, url=${this.urlDetected ?? ""}`);

            // 🔔 Emitir evento a client.ts
            this.emit("plate", {
              plate,
              url: this.urlDetected ?? "",
              timestamp: this.lastDetectedTime,
            });
          } else {
            console.log("ℹ️ XML recibido, pero sin placa reconocible.");
          }
        }

        // Recortar buffer para no crecer infinito
        const lastClose = Math.max(
          acc.lastIndexOf("</infoplate>"),
          acc.lastIndexOf("</InfoPlate>")
        );
        if (lastClose >= 0) acc = acc.slice(lastClose + "</infoplate>".length);
      });

      socket.on("end", () => console.log("🔚 Conexión LPR cerrada por el emisor."));
      socket.on("error", (err) => console.error("❌ Error en socket LPR:", err.message));
    });

    server.on("listening", () => {
      const addr = server.address();
    });

    server.listen(puerto);
    this.listenerServer = server;
  }

  /**
   * Extrae datos de la placa desde el XML recibido
   */
  private extractPlateFromLPRData(rawXml: string): string | null {
    if (!XMLValidator.validate(rawXml)) return null;

    const xmlParser = new XMLParser({ ignoreAttributes: false });
    const jsonObj = xmlParser.parse(rawXml);

    const info = jsonObj.infoplate ?? jsonObj.InfoPlate ?? null;
    if (!info) return null;

    const readStr = (v: any): string | null => {
      if (typeof v === "string") return v;
      if (v?.["@_value"]) return String(v["@_value"]);
      if (v?.["#text"]) return String(v["#text"]);
      return null;
    };

    const plate = readStr(info.Plate);
    const path = readStr(info.Path);

    if (plate) {
      this.lastDetectedPlate = plate;
      this.urlDetected = path ?? null;
      return plate;
    }

    this.lastDetectedPlate = null;
    this.urlDetected = null;
    return null;
  }
}
