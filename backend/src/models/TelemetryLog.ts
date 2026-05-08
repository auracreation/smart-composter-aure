import { getDb } from "../db";
import { ComposterState } from "../state";

export interface TelemetryRow {
  id?: number;
  device_id?: string;
  timestamp?: string;
  mode?: string;
  phase?: string;
  auto_mode?: boolean;
  core_temp?: number;
  air_temp_avg?: number;
  air_humidity_avg?: number;
  soil_percent?: number;
  soil_raw?: number;
  gas_raw?: number;
  dht1_temp?: number;
  dht2_temp?: number;
  dht1_humidity?: number;
  dht2_humidity?: number;
  dht1_valid?: boolean;
  dht2_valid?: boolean;
  ds18b20_valid?: boolean;
  soil_valid?: boolean;
  gas_valid?: boolean;
  heater?: boolean;
  fan?: boolean;
  pump?: boolean;
  servo?: string;
  wifi?: string;
  last_event?: string;
}

export function stateToRow(s: ComposterState, deviceId = "default"): TelemetryRow {
  return {
    device_id:        deviceId,
    timestamp:        s.timestamp,
    mode:             s.mode,
    phase:            s.phase,
    auto_mode:        s.autoMode,
    core_temp:        s.sensor.coreTemp,
    air_temp_avg:     s.sensor.airTempAvg,
    air_humidity_avg: s.sensor.airHumidityAvg,
    soil_percent:     s.sensor.soilPercent,
    soil_raw:         s.sensor.soilRaw,
    gas_raw:          s.sensor.gasRaw,
    dht1_temp:        s.sensor.dht1Temp,
    dht2_temp:        s.sensor.dht2Temp,
    dht1_humidity:    s.sensor.dht1Humidity,
    dht2_humidity:    s.sensor.dht2Humidity,
    dht1_valid:       s.sensor.dht1Valid,
    dht2_valid:       s.sensor.dht2Valid,
    ds18b20_valid:    s.sensor.ds18b20Valid,
    soil_valid:       s.sensor.soilValid,
    gas_valid:        s.sensor.gasValid,
    heater:           s.actuator.heater,
    fan:              s.actuator.fan,
    pump:             s.actuator.pump,
    servo:            s.actuator.servo,
    wifi:             s.wifi,
    last_event:       s.lastEvent,
  };
}

export async function insertTelemetry(row: TelemetryRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO telemetry_logs
        (device_id,timestamp,mode,phase,auto_mode,core_temp,air_temp_avg,air_humidity_avg,
         soil_percent,soil_raw,gas_raw,dht1_temp,dht2_temp,dht1_humidity,dht2_humidity,
         dht1_valid,dht2_valid,ds18b20_valid,soil_valid,gas_valid,
         heater,fan,pump,servo,wifi,last_event)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
      [
        row.device_id, row.timestamp, row.mode, row.phase, row.auto_mode,
        row.core_temp, row.air_temp_avg, row.air_humidity_avg, row.soil_percent, row.soil_raw,
        row.gas_raw, row.dht1_temp, row.dht2_temp, row.dht1_humidity, row.dht2_humidity,
        row.dht1_valid, row.dht2_valid, row.ds18b20_valid, row.soil_valid, row.gas_valid,
        row.heater, row.fan, row.pump, row.servo, row.wifi, row.last_event,
      ],
    );
  } catch (e: any) {
    console.error("[DB] insertTelemetry FAILED:", e.message, "| device:", row.device_id);
  }
}

export function rowToHistoryEntry(row: TelemetryRow & { id?: number }) {
  return {
    id:        row.id ?? 0,
    timestamp: row.timestamp ?? "",
    mode:      row.mode ?? "STANDBY",
    phase:     row.phase ?? "MESOFILIK",
    autoMode:  row.auto_mode ?? true,
    sensor: {
      coreTemp:       row.core_temp        ?? 0,
      airTempAvg:     row.air_temp_avg     ?? 0,
      airHumidityAvg: row.air_humidity_avg ?? 0,
      soilPercent:    row.soil_percent     ?? 0,
      soilRaw:        row.soil_raw         ?? 0,
      gasRaw:         row.gas_raw          ?? 0,
      dht1Temp:       row.dht1_temp        ?? 0,
      dht2Temp:       row.dht2_temp        ?? 0,
      dht1Humidity:   row.dht1_humidity    ?? 0,
      dht2Humidity:   row.dht2_humidity    ?? 0,
      dht1Valid:      row.dht1_valid       ?? true,
      dht2Valid:      row.dht2_valid       ?? true,
      ds18b20Valid:   row.ds18b20_valid    ?? true,
      soilValid:      row.soil_valid       ?? true,
      gasValid:       row.gas_valid        ?? true,
    },
    actuator: {
      heater: row.heater ?? false,
      fan:    row.fan    ?? false,
      pump:   row.pump   ?? false,
      servo:  row.servo  ?? "HALF",
    },
    wifi:      row.wifi       ?? "OFFLINE",
    lastEvent: row.last_event ?? "---",
  };
}

export async function fetchTelemetry(
  limit = 100,
  deviceId?: string,
  from?: string,
  to?: string,
): Promise<TelemetryRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (deviceId) { conditions.push(`device_id = $${idx++}`); params.push(deviceId); }
    if (from)     { conditions.push(`timestamp >= $${idx++}`); params.push(from); }
    if (to)       { conditions.push(`timestamp <= $${idx++}`); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const result = await db.query(
      `SELECT * FROM telemetry_logs ${where} ORDER BY timestamp DESC LIMIT $${idx}`,
      params,
    );
    return result.rows;
  } catch (e: any) {
    console.error("[DB] fetchTelemetry:", e.message);
    return [];
  }
}
