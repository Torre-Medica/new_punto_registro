import MCP23017 from "node-mcp23017";
import i2cBus from "i2c-bus";
import envConfig from "./env";

const MCP23017_ADDRESS = envConfig.I2C_ADDRESS;
const IODIRB = 0x01;
const GPPUB = 0x0D;
const GPIOB = 0x13;

const INPUT_PINS: Record<string, number> = {
  IN1: 0,
  IN2: 1,
  IN3: 2,
  IN4: 3,
  IN5: 4,
  IN6: 5,
};

const OUTPUT_PINS: Record<string, number> = {
  OUT1: 0,
  OUT2: 1,
  OUT3: 2,
  OUT4: 3,
};

class I2CService {
  private mcp: MCP23017;
  private i2c: i2cBus.I2CBus;
  private previousInputs: string[] = [];

  constructor() {
    // 👇 Esto no ejecuta nada aún, solo define la instancia
    this.i2c = i2cBus.openSync(1);
    this.mcp = new MCP23017({
      address: MCP23017_ADDRESS,
      device: 1,
      debug: false,
    });
  }

  async init() {
    this.i2c.writeByteSync(MCP23017_ADDRESS, IODIRB, 0xff);
    this.i2c.writeByteSync(MCP23017_ADDRESS, GPPUB, 0xff);
    Object.values(OUTPUT_PINS).forEach((pin) =>
      this.mcp.pinMode(pin, this.mcp.OUTPUT)
    );
    console.log("Pines I2C inicializados.");
  }

  async activatePin(pinName: keyof typeof OUTPUT_PINS, durationMs: number = 1000): Promise<void> {
    const pin = OUTPUT_PINS[pinName];
    this.mcp.digitalWrite(pin, this.mcp.HIGH);
    console.log(`Salida ${pinName} activada.`);
    setTimeout(() => {
      this.mcp.digitalWrite(pin, this.mcp.LOW);
      console.log(`Salida ${pinName} desactivada tras ${durationMs} ms.`);
    }, durationMs);
  }

  async isPinActive(pinName: keyof typeof INPUT_PINS): Promise<boolean> {
    const gpioBState = this.i2c.readByteSync(MCP23017_ADDRESS, GPIOB);
    const pin = INPUT_PINS[pinName];
    return (gpioBState & (1 << pin)) === 0;
  }

  async checkInputs(): Promise<string[]> {
    const activeInputs: string[] = [];
    const gpioBState = this.i2c.readByteSync(MCP23017_ADDRESS, GPIOB);

    Object.entries(INPUT_PINS).forEach(([name, pin]) => {
      const isActive = (gpioBState & (1 << pin)) === 0;
      if (!isActive) {
        activeInputs.push(name);
      }
    });

    if (JSON.stringify(activeInputs) !== JSON.stringify(this.previousInputs)) {
      this.previousInputs = activeInputs;
    }

    return activeInputs;
  }
}

export { I2CService };
