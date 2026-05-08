import { EventEmitter } from "events";
import { isConnected } from "./db";
import { insertTelemetry, stateToRow } from "./models/TelemetryLog";
import { insertEvent } from "./models/EventLog";
import {
  checkSensorAlerts,
  notifyModeChanged,
  notifyCycleStarted,
  notifyCycleStopped,
  notifyCycleFinished,
  notifyDeviceOffline,
  notifyDeviceOnline,
} from "./services/notificationService";

export type Mode = "BOOT" | "STANDBY" | "PROCESS" | "FINISHED" | "MANUAL" | "ERROR";
export type Phase = "MESOFILIK" | "TERMOFILIK" | "PENDINGINAN" | "PEMATANGAN";
export type ServoState = "CLOSE" | "HALF" | "OPEN";

export interface SensorData {
  coreTemp: number;
  airTempAvg: number;
  airHumidityAvg: number;
  soilPercent: number;
  soilRaw: number;
  gasRaw: number;
  dht1Temp: number;
  dht2Temp: number;
  dht1Humidity: number;
  dht2Humidity: number;
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

export interface EventEntry {
  timestamp: string;
  event: string;
  mode: Mode;
  phase: Phase;
}

const MAX_EVENTS = 200;
const MAX_HISTORY = 720;

export interface HistoryEntry extends ComposterState {
  id: number;
}

const ESP32_OFFLINE_TIMEOUT_MS = 30_000;
const CYCLE_LOCK_MS = 15_000;

export class StateStore extends EventEmitter {
  private _state: ComposterState;
  private _events: EventEntry[] = [];
  private _history: HistoryEntry[] = [];
  private _historyId = 0;
  private _lastHistoryTs = 0;
  private _offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private _preManualMode: Mode = "STANDBY";
  private _cmdActuator: ActuatorState = { heater: false, fan: false, pump: false, servo: "HALF" };
  private _pendingCycle: { targetMode: Mode; fromMode: Mode; expiresAt: number } | null = null;
  private _deviceId: string;
  private _lastPushedEvent = "";

  constructor(deviceId = "default") {
    super();
    this._deviceId = deviceId;
    this._state = this.defaultState();
  }

  defaultState(): ComposterState {
    return {
      timestamp: new Date().toISOString(),
      mode: "STANDBY",
      phase: "MESOFILIK",
      autoMode: true,
      sensor: {
        coreTemp: 0,
        airTempAvg: 0,
        airHumidityAvg: 0,
        soilPercent: 0,
        soilRaw: 0,
        gasRaw: 0,
        dht1Temp: 0,
        dht2Temp: 0,
        dht1Humidity: 0,
        dht2Humidity: 0,
        dht1Valid: true,
        dht2Valid: true,
        ds18b20Valid: true,
        soilValid: true,
        gasValid: true,
      },
      actuator: {
        heater: false,
        fan: false,
        pump: false,
        servo: "HALF",
      },
      cmdActuator: {
        heater: false,
        fan: false,
        pump: false,
        servo: "HALF",
      },
      wifi: "OFFLINE",
      lastEvent: "SYSTEM_BOOT",
    };
  }

  get state(): ComposterState {
    return { ...this._state };
  }

  get events(): EventEntry[] {
    return [...this._events];
  }

  get history(): HistoryEntry[] {
    return [...this._history];
  }

  get cmdActuator(): ActuatorState {
    return { ...this._cmdActuator };
  }

  updateFromTelemetry(data: Partial<ComposterState>, deviceId = "default") {
    const { actuator, sensor, ...rest } = data;

    // Protect commanded mode from being overwritten by stale telemetry
    let resolvedMode: Mode = rest.mode ?? this._state.mode;
    if (this._pendingCycle) {
      if (Date.now() >= this._pendingCycle.expiresAt) {
        this._pendingCycle = null; // lock expired — ESP32 state wins
      } else if (rest.mode === this._pendingCycle.targetMode) {
        this._pendingCycle = null; // ESP32 confirmed the transition
      } else if (rest.mode === this._pendingCycle.fromMode) {
        resolvedMode = this._pendingCycle.targetMode; // ESP32 not yet transitioned — hold command
      } else {
        this._pendingCycle = null; // unexpected mode (physical switch / natural transition) — ESP32 wins
      }
    }

    const prevWifi = this._state.wifi;
    const prevMode = this._state.mode;

    this._state = { ...this._state, ...rest, mode: resolvedMode, timestamp: new Date().toISOString() };
    if (sensor) {
      this._state.sensor = { ...this._state.sensor, ...sensor };
    }
    if (actuator) {
      this._state.actuator = { ...this._state.actuator, ...actuator };
    }
    // Hanya push event ke DB jika event berubah (mencegah duplikat satu event ribuan kali)
    if (this._state.lastEvent && this._state.lastEvent !== this._lastPushedEvent) {
      this._lastPushedEvent = this._state.lastEvent;
      this.pushEvent(this._state.lastEvent);
    }

    // Notifications (fire-and-forget)
    if (prevWifi === "OFFLINE" && this._state.wifi === "ONLINE") {
      notifyDeviceOnline(this._deviceId).catch(() => {});
    }
    if (prevMode === "PROCESS" && resolvedMode === "FINISHED") {
      notifyCycleFinished(this._deviceId).catch(() => {});
    }
    if (this._state.sensor) {
      checkSensorAlerts(this._deviceId, this._state.sensor).catch(() => {});
    }
    const now = Date.now();
    // In-memory history: snapshot once per minute (memory saver)
    if (now - this._lastHistoryTs >= 60000) {
      this._lastHistoryTs = now;
      this._history.unshift({ ...this._state, id: ++this._historyId });
      if (this._history.length > MAX_HISTORY) this._history.length = MAX_HISTORY;
    }
    // DB: save every packet (upstream rate-limited to 1 per 2s max)
    if (isConnected()) {
      insertTelemetry(stateToRow(this._state, deviceId)).catch(() => {});
    }
    this._resetOfflineTimer();
    this.emit("state", this._state);
  }

  private _resetOfflineTimer() {
    if (this._offlineTimer) clearTimeout(this._offlineTimer);
    this._offlineTimer = setTimeout(() => {
      if (this._state.wifi !== "OFFLINE") {
        this._state.wifi = "OFFLINE";
        console.log("[State] ESP32 offline — no telemetry for 30s");
        this.emit("state", this._state);
        notifyDeviceOffline(this._deviceId).catch(() => {});
      }
    }, ESP32_OFFLINE_TIMEOUT_MS);
  }

  setMode(autoMode: boolean) {
    this._state.autoMode = autoMode;
    if (!autoMode) {
      this._preManualMode = this._state.mode;
      this._state.mode = "MANUAL";
      this._cmdActuator = { ...this._state.actuator };
      this._state.cmdActuator = { ...this._cmdActuator };
    } else {
      this._state.mode =
        this._preManualMode !== "MANUAL" && this._preManualMode !== "FINISHED"
          ? this._preManualMode
          : "STANDBY";
    }
    this._state.lastEvent = autoMode ? "MANUAL_OVERRIDE_OFF" : "MANUAL_OVERRIDE_ON";
    this._state.timestamp = new Date().toISOString();
    this.pushEvent(this._state.lastEvent);
    this.emit("state", this._state);
    this.emit("control", { type: "mode", autoMode });
    notifyModeChanged(this._deviceId, autoMode).catch(() => {});
  }

  setActuator(act: Partial<ActuatorState>) {
    this._cmdActuator = { ...this._cmdActuator, ...act };
    this._state.cmdActuator = { ...this._cmdActuator };
    this._state.actuator = { ...this._state.actuator, ...act };
    this._state.timestamp = new Date().toISOString();
    this.emit("state", this._state);
    this.emit("control", { type: "actuator", ...act });
  }

  setCycle(action: "start" | "stop") {
    const targetMode: Mode = action === "start" ? "PROCESS" : "STANDBY";
    this._pendingCycle = { targetMode, fromMode: this._state.mode, expiresAt: Date.now() + CYCLE_LOCK_MS };
    if (action === "start") {
      this._state.mode = "PROCESS";
      this._state.phase = "MESOFILIK";
      this._state.lastEvent = "PROCESS_STARTED";
      notifyCycleStarted(this._deviceId).catch(() => {});
    } else {
      this._state.mode = "STANDBY";
      this._state.lastEvent = "PROCESS_STOPPED_BY_USER";
      this._state.actuator = { heater: false, fan: false, pump: false, servo: "HALF" };
      notifyCycleStopped(this._deviceId).catch(() => {});
    }
    this._state.timestamp = new Date().toISOString();
    this.pushEvent(this._state.lastEvent);
    this.emit("state", this._state);
    this.emit("control", { type: "cycle", action });
  }

  private pushEvent(event: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      mode: this._state.mode,
      phase: this._state.phase,
    };
    this._events.unshift(entry);
    if (this._events.length > MAX_EVENTS) this._events.length = MAX_EVENTS;
    if (isConnected()) {
      insertEvent({ ...entry }).catch(() => {});
    }
  }
}

export class DeviceStoreRegistry {
  private readonly _stores = new Map<string, StateStore>();

  getOrCreate(deviceId: string): StateStore {
    if (!this._stores.has(deviceId)) {
      this._stores.set(deviceId, new StateStore(deviceId));
    }
    return this._stores.get(deviceId)!;
  }

  get(deviceId: string): StateStore | undefined {
    return this._stores.get(deviceId);
  }

  has(deviceId: string): boolean {
    return this._stores.has(deviceId);
  }
}

export const registry = new DeviceStoreRegistry();
