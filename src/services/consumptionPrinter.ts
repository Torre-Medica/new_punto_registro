import { PrinterConfig } from "../config";
import axios from "axios";

export type TicketData = {
  date: string;
  VehicleType: string;
  plate: string;
  QRData: string;
  policy: string;
  additionalInformation: string;
};

async function printer(data: any): Promise<{ success: boolean; message: string }> {
  const config = PrinterConfig.getConfiguration();

  try {
    const response = await axios.post(config.JAVA_SERVER_URL, data, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.data === true) {
      return { success: true, message: "✅ Impresión enviada correctamente" };
    } else {
      return { success: false, message: "⚠️ Error en la impresión" };
    }
  } catch (error) {
    console.error("Error al conectar con el servicio de impresión:", error);
    return { success: false, message: "No se pudo conectar con la impresora" };
  }
}

async function generarCuerpoImpresion(data: TicketData) {
  const config = PrinterConfig.getConfiguration();

  return {
    "nombre_impresora": config.PRINTER_NAME,
    "operaciones": [
      { "accion": "textalign", "datos": "center" },
      { "accion": "feed", "datos": "1" },
      { "accion": "text", "datos": `` },
      { "accion": "textalign", "datos": "center" },
      { "accion": "feed", "datos": "1" },
      { "accion": "text", "datos": `Fecha de ingreso: ${data.date}` },
      { "accion": "text", "datos": `Tipo de vehículo: ${data.VehicleType}` },
      { "accion": "feed", "datos": "1" },
      { "accion": "qr", "datos": data.QRData },
      { "accion": "feed", "datos": "2" },
      { "accion": "text", "datos": data.additionalInformation },
      { "accion": "feed", "datos": "5" },
      { "accion": "cut", "datos": "full" }
    ]
  };
}

export { printer, generarCuerpoImpresion };
