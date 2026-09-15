// types/node-mcp23017.d.ts

declare module 'node-mcp23017' {
    interface MCP23017Config {
      address: number;
      device: number;
      debug?: boolean;
    }
  
    export default class MCP23017 {
      public INPUT: number;
      public OUTPUT: number;
      public HIGH: number;
      public LOW: number;
  
      constructor(config: MCP23017Config);
  
      pinMode(pin: number, mode: number): void;
      digitalWrite(pin: number, value: number): void;
      digitalRead(pin: number, callback: (pinId: number, err: Error | null, state: number) => void): void;
    }
  }
  