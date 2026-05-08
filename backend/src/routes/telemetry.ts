import { Router, Request, Response } from "express";
import { registry, StateStore } from "../state";
import { apiKeyMiddleware } from "../middleware/apiKey";
import { requireAuth } from "../middleware/requireAuth";
import { ensureDeviceSubscribed } from "../ws";
import { getDb, isConnected } from "../db";
import { TelemetryRow } from "../models/TelemetryLog";

const router: Router = Router();

const telemetryRateMap = new Map<string, number>();
const TELEMETRY_MIN_INTERVAL_MS = 2000;

function sanitizeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeTelemetry(data: any): any {
  if (!data || typeof data !== "object") return null;
  const out: any = {};
  if (typeof data.mode === "string") out.mode = data.mode.slice(0, 20);
  if (typeof data.phase === "string") out.phase = data.phase.slice(0, 20);
  if (typeof data.autoMode === "boolean") out.autoMode = data.autoMode;
  if (typeof data.lastEvent === "string") out.lastEvent = data.lastEvent.slice(0, 40);
  if (typeof data.wifi === "string") out.wifi = data.wifi.slice(0, 10);
  if (data.sensor && typeof data.sensor === "object") {
    const s = data.sensor;
    out.sensor = {
      coreTemp:       sanitizeNumber(s.coreTemp),
      airTempAvg:     sanitizeNumber(s.airTempAvg),
      airHumidityAvg: sanitizeNumber(s.airHumidityAvg),
      soilPercent:    sanitizeNumber(s.soilPercent),
      soilRaw:        sanitizeNumber(s.soilRaw),
      gasRaw:         sanitizeNumber(s.gasRaw),
      dht1Temp:       sanitizeNumber(s.dht1Temp),
      dht2Temp:       sanitizeNumber(s.dht2Temp),
      dht1Humidity:   sanitizeNumber(s.dht1Humidity),
      dht2Humidity:   sanitizeNumber(s.dht2Humidity),
      dht1Valid:      !!s.dht1Valid,
      dht2Valid:      !!s.dht2Valid,
      ds18b20Valid:   !!s.ds18b20Valid,
      soilValid:      !!s.soilValid,
      gasValid:       !!s.gasValid,
    };
  }
  if (data.actuator && typeof data.actuator === "object") {
    const a = data.actuator;
    out.actuator = {
      heater: !!a.heater,
      fan:    !!a.fan,
      pump:   !!a.pump,
      servo:  ["CLOSE","HALF","OPEN"].includes(a.servo) ? a.servo : "HALF",
    };
  }
  return out;
}

router.post("/", apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const deviceId = req.deviceId || "default";
    const now = Date.now();
    const last = telemetryRateMap.get(deviceId) ?? 0;
    if (now - last < TELEMETRY_MIN_INTERVAL_MS) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    telemetryRateMap.set(deviceId, now);

    const data = sanitizeTelemetry(req.body);
    if (!data) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
    const deviceStore = registry.getOrCreate(deviceId);
    ensureDeviceSubscribed(deviceId);
    deviceStore.updateFromTelemetry(data, deviceId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const deviceId = req.query.device_id as string | undefined;
  if (!deviceId) {
    res.status(400).json({ error: "device_id query param required" });
    return;
  }
  if (isConnected()) {
    try {
      const owned = await getDb()!.query(
        `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
        [deviceId, req.userId],
      );
      if (owned.rowCount === 0) { res.status(403).json({ error: "Forbidden" }); return; }
    } catch (e: any) { res.status(500).json({ error: e.message }); return; }
  }
  const deviceStore = registry.get(deviceId);
  if (!deviceStore) {
    res.json(new StateStore().defaultState());
    return;
  }
  res.json(deviceStore.state);
});

// POST /api/telemetry/sync — batch upload from SD card when ESP reconnects to WiFi
// Body: array of telemetry records with original timestamps
router.post("/sync", apiKeyMiddleware, async (req: Request, res: Response) => {
  if (!isConnected()) {
    res.status(503).json({ error: "DB not connected" });
    return;
  }
  const deviceId = req.deviceId || "default";
  const batch = req.body;

  if (!Array.isArray(batch) || batch.length === 0) {
    res.status(400).json({ error: "Expected non-empty array of telemetry records" });
    return;
  }
  if (batch.length > 5000) {
    res.status(400).json({ error: "Batch too large (max 5000 records)" });
    return;
  }

  const rows: TelemetryRow[] = batch.map((item: any) => ({
    device_id:        deviceId,
    timestamp:        typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString(),
    mode:             typeof item.mode  === "string" ? item.mode.slice(0, 20)  : undefined,
    phase:            typeof item.phase === "string" ? item.phase.slice(0, 20) : undefined,
    auto_mode:        typeof item.autoMode === "boolean" ? item.autoMode : undefined,
    last_event:       typeof item.lastEvent === "string" ? item.lastEvent.slice(0, 40) : undefined,
    wifi:             typeof item.wifi  === "string" ? item.wifi.slice(0, 10)  : undefined,
    core_temp:        sanitizeNumber(item.sensor?.coreTemp),
    air_temp_avg:     sanitizeNumber(item.sensor?.airTempAvg),
    air_humidity_avg: sanitizeNumber(item.sensor?.airHumidityAvg),
    soil_percent:     sanitizeNumber(item.sensor?.soilPercent),
    soil_raw:         sanitizeNumber(item.sensor?.soilRaw),
    gas_raw:          sanitizeNumber(item.sensor?.gasRaw),
    dht1_temp:        sanitizeNumber(item.sensor?.dht1Temp),
    dht2_temp:        sanitizeNumber(item.sensor?.dht2Temp),
    dht1_humidity:    sanitizeNumber(item.sensor?.dht1Humidity),
    dht2_humidity:    sanitizeNumber(item.sensor?.dht2Humidity),
    dht1_valid:       !!item.sensor?.dht1Valid,
    dht2_valid:       !!item.sensor?.dht2Valid,
    ds18b20_valid:    !!item.sensor?.ds18b20Valid,
    soil_valid:       !!item.sensor?.soilValid,
    gas_valid:        !!item.sensor?.gasValid,
    heater:           !!item.actuator?.heater,
    fan:              !!item.actuator?.fan,
    pump:             !!item.actuator?.pump,
    servo:            ["CLOSE","HALF","OPEN"].includes(item.actuator?.servo) ? item.actuator.servo : "HALF",
  }));

  const db = getDb()!;
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const valuePlaceholders = chunk.map((_, ri) => {
      const base = ri * 26;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18},$${base+19},$${base+20},$${base+21},$${base+22},$${base+23},$${base+24},$${base+25},$${base+26})`;
    }).join(",");
    const values = chunk.flatMap((r) => [
      r.device_id, r.timestamp, r.mode, r.phase, r.auto_mode,
      r.core_temp, r.air_temp_avg, r.air_humidity_avg, r.soil_percent, r.soil_raw,
      r.gas_raw, r.dht1_temp, r.dht2_temp, r.dht1_humidity, r.dht2_humidity,
      r.dht1_valid, r.dht2_valid, r.ds18b20_valid, r.soil_valid, r.gas_valid,
      r.heater, r.fan, r.pump, r.servo, r.wifi, r.last_event,
    ]);
    try {
      await db.query(
        `INSERT INTO telemetry_logs
          (device_id,timestamp,mode,phase,auto_mode,core_temp,air_temp_avg,air_humidity_avg,
           soil_percent,soil_raw,gas_raw,dht1_temp,dht2_temp,dht1_humidity,dht2_humidity,
           dht1_valid,dht2_valid,ds18b20_valid,soil_valid,gas_valid,
           heater,fan,pump,servo,wifi,last_event)
         VALUES ${valuePlaceholders}`,
        values,
      );
      inserted += chunk.length;
    } catch (e: any) {
      console.error("[DB] sync batch insert error:", e.message);
    }
  }

  console.log(`[Sync] Device ${deviceId}: inserted ${inserted}/${rows.length} offline records`);
  res.json({ ok: true, inserted, total: rows.length });
});

export default router;
