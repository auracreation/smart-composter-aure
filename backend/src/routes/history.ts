import express, { Request, Response, Router } from "express";
import { registry } from "../state";
import { getDb, isConnected } from "../db";
import { fetchTelemetry, rowToHistoryEntry, TelemetryRow } from "../models/TelemetryLog";
import { requireAuth } from "../middleware/requireAuth";

const router: Router = express.Router();

// Thresholds for "significant" sensor change
const TEMP_DELTA     = 0.5;   // °C
const HUMIDITY_DELTA = 1.5;   // %
const SOIL_DELTA     = 1.5;   // %
const GAS_DELTA      = 50;    // raw units
const MINUTE_GAP_MS  = 60_000;

function applyChangeFilter(rows: TelemetryRow[], maxOut: number): TelemetryRow[] {
  if (rows.length === 0) return [];
  const result: TelemetryRow[] = [rows[0]];
  let last = rows[0];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const lastTs = last.timestamp ? new Date(last.timestamp).getTime() : 0;
    const rTs    = r.timestamp   ? new Date(r.timestamp).getTime()   : 0;
    const gap    = lastTs - rTs; // positive: last is newer

    const actuatorChanged =
      r.heater !== last.heater ||
      r.fan    !== last.fan    ||
      r.pump   !== last.pump   ||
      r.servo  !== last.servo;

    const stateChanged  = r.mode !== last.mode || r.phase !== last.phase;
    const eventChanged  = r.last_event !== last.last_event && r.last_event !== "---";
    const tempChanged   = Math.abs((r.core_temp        ?? 0) - (last.core_temp        ?? 0)) >= TEMP_DELTA;
    const humChanged    = Math.abs((r.air_humidity_avg ?? 0) - (last.air_humidity_avg ?? 0)) >= HUMIDITY_DELTA;
    const soilChanged   = Math.abs((r.soil_percent     ?? 0) - (last.soil_percent     ?? 0)) >= SOIL_DELTA;
    const gasChanged    = Math.abs((r.gas_raw          ?? 0) - (last.gas_raw          ?? 0)) >= GAS_DELTA;
    const periodic      = gap >= MINUTE_GAP_MS;

    if (actuatorChanged || stateChanged || eventChanged || tempChanged || humChanged || soilChanged || gasChanged || periodic) {
      result.push(r);
      last = r;
      if (result.length >= maxOut) break;
    }
  }
  return result;
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const limit    = Math.min(parseInt(req.query.limit as string) || 500, 2000);
  const deviceId = req.query.device_id as string | undefined;
  const fromRaw  = req.query.from as string | undefined;
  const toRaw    = req.query.to   as string | undefined;

  // Validate date params
  let from: string | undefined;
  let to:   string | undefined;
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (isNaN(d.getTime())) { res.status(400).json({ error: "Invalid 'from' date" }); return; }
    from = d.toISOString();
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (isNaN(d.getTime())) { res.status(400).json({ error: "Invalid 'to' date" }); return; }
    to = d.toISOString();
  }

  if (deviceId && isConnected()) {
    try {
      const owned = await getDb()!.query(
        `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
        [deviceId, req.userId],
      );
      if (owned.rowCount === 0) { res.status(403).json({ error: "Forbidden" }); return; }
    } catch (e: any) { res.status(500).json({ error: e.message }); return; }
  }

  if (isConnected()) {
    try {
      // When a date range is given, fetch all rows in the window (large safety cap);
      // otherwise use a multiplier window for the change filter to work with.
      const rawCap = (from || to) ? 200_000 : limit * 20;
      const rawRows = await fetchTelemetry(rawCap, deviceId, from, to);
      const filtered = applyChangeFilter(rawRows, limit);
      return res.json(filtered.map(rowToHistoryEntry));
    } catch {
      // fall through to in-memory
    }
  }
  const deviceStore = deviceId ? registry.get(deviceId) : undefined;
  res.json((deviceStore?.history ?? []).slice(0, limit));
});

export default router;
