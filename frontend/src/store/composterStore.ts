import { create } from "zustand";
import { ComposterState, ActuatorState, Mode, Phase, ServoState } from "@/lib/types";
import type { DeviceRow } from "@/lib/api";

interface ComposterStore {
  state: ComposterState;
  connected: boolean;
  devices: DeviceRow[];
  selectedDeviceId: string | null;
  setState: (s: ComposterState) => void;
  setConnected: (c: boolean) => void;
  setDevices: (devices: DeviceRow[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  updateDeviceLastSeen: (deviceId: string, ts: string) => void;
}

const defaultState: ComposterState = {
  timestamp: "",
  mode: "STANDBY",
  phase: "MESOFILIK",
  autoMode: true,
  sensor: {
    coreTemp: 0,
    airTempAvg: 0,
    airHumidityAvg: 0,
    soilPercent: 0,
    gasRaw: 0,
    dht1Valid: true,
    dht2Valid: true,
    ds18b20Valid: true,
    soilValid: true,
    gasValid: true,
  },
  actuator: { heater: false, fan: false, pump: false, servo: "HALF" },
  cmdActuator: { heater: false, fan: false, pump: false, servo: "HALF" },
  wifi: "OFFLINE",
  lastEvent: "---",
};

export const useComposterStore = create<ComposterStore>((set) => ({
  state: defaultState,
  connected: false,
  devices: [],
  selectedDeviceId: null,
  setState: (s) => set({ state: s }),
  setConnected: (c) => set({ connected: c }),
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  updateDeviceLastSeen: (deviceId, ts) => set((s) => ({
    devices: s.devices.map((d) => d.device_id === deviceId ? { ...d, last_seen: ts } : d),
  })),
}));
