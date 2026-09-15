import fs from "fs";
import path from "path";
const CONFIG_DIR = path.join(process.cwd(), "config_files");
const CONFIG_FILE = path.join(CONFIG_DIR, "printerConfig.txt");

class PrinterConfig {
  private config: Record<string, string>;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): Record<string, string> {

    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      console.log("Carpeta 'config_files' creada en la raíz del proyecto.");
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      console.log("Archivo de configuración de la impresora no encontrado. Creando uno nuevo...");
      const defaultConfig: Record<string, string> = {
        JAVA_SERVER_URL: "http://localhost:8080/imprimir",
        PRINTER_NAME: "EPSON_TM_T20III",
      };
      this.saveConfiguration(defaultConfig);
      return defaultConfig;
    }

    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error al leer el archivo de configuración de la impresora:", error);
      return {
        JAVA_SERVER_URL: "http://localhost:8080/imprimir",
        PRINTER_NAME: "EPSON_TM_T20III",
      };
    }
  }

  private saveConfiguration(config: Record<string, string>) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log("Configuración de la impresora guardada:", config);
    } catch (error) {
      console.error("Error al guardar el archivo de configuración de la impresora:", error);
    }
  }

  public updateConfiguration(newConfig: Partial<Record<string, string>>) {
    const updatedConfig: Record<string, string> = { ...this.config };

    // Filtrar valores `undefined`
    Object.entries(newConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        updatedConfig[key] = value;
      }
    });

    this.config = updatedConfig;
    this.saveConfiguration(updatedConfig);
    console.log("Configuración de la impresora actualizada:", this.config);
  }

  public getConfiguration(): Record<string, string> {
    return this.config;
  }
}

// Exportar una única instancia de la configuración
export default new PrinterConfig();
