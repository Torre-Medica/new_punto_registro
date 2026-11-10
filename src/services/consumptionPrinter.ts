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

// Texto en una sola linea sin espacios sobrantes (la poliza viene del backend
// con espacios repetidos).
function cleanText(value?: string | null): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Tiquete de ingreso de Torre Medica: mismo formato del punto de registro
// anterior (encabezado con nombre y direccion), mas placa y datos al final.
async function generarCuerpoImpresion(data: TicketData) {
  const config = PrinterConfig.getConfiguration();
  const policy = cleanText(data.policy);

  const operaciones: { accion: string; datos: string }[] = [
    { "accion": "textalign", "datos": "center" },
    { "accion": "feed", "datos": "1" },
    { "accion": "text", "datos": "Torre Médica" },
    { "accion": "text", "datos": "Dirección: Cra. 48 # 19A - 40" },
    { "accion": "feed", "datos": "1" },
    { "accion": "text", "datos": `Fecha de ingreso: ${data.date}` },
    { "accion": "text", "datos": `Tipo de vehículo: ${data.VehicleType}` },
    { "accion": "text", "datos": `Placa: ${data.plate || "Sin placa"}` },
    { "accion": "feed", "datos": "1" },
    { "accion": "qr", "datos": data.QRData },
    { "accion": "feed", "datos": "2" },
    { "accion": "text", "datos": cleanText(data.additionalInformation) },
  ];

  if (policy) {
    operaciones.push(
      { "accion": "feed", "datos": "1" },
      { "accion": "text", "datos": policy },
    );
  }

  operaciones.push(
    { "accion": "feed", "datos": "5" },
    { "accion": "cut", "datos": "full" },
  );

  return {
    "nombre_impresora": config.PRINTER_NAME,
    "operaciones": operaciones,
  };
}

export { printer, generarCuerpoImpresion };
