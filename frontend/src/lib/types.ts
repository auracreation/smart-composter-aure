export type Mode = "BOOT" | "STANDBY" | "PROCESS" | "FINISHED" | "MANUAL" | "ERROR";
export type Phase = "MESOFILIK" | "TERMOFILIK" | "PENDINGINAN" | "PEMATANGAN";
export type ServoState = "CLOSE" | "HALF" | "OPEN";

export interface SensorData {
  coreTemp: number;
  airTempAvg: number;
  airHumidityAvg: number;
  soilPercent: number;
  gasRaw: number;
  dht1Valid: boolean;
  dht2Valid: boolean;
  ds18b20Valid: boolean;
  soilValid: boolean;
  gasValid: boolean;
}

export interface ActuatorState {
  heater: boolean;
  fan: boolean;
  pump: boolean;
  servo: ServoState;
}

export interface ComposterState {
  timestamp: string;
  mode: Mode;
  phase: Phase;
  autoMode: boolean;
  sensor: SensorData;
  actuator: ActuatorState;
  cmdActuator: ActuatorState;
  wifi: "ONLINE" | "OFFLINE";
  lastEvent: string;
}

export interface HistoryEntry extends ComposterState {
  id: number;
}

export interface EventEntry {
  timestamp: string;
  event: string;
  mode: Mode;
  phase: Phase;
}
