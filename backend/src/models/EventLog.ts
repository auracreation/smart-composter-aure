import { getDb } from "../db";

export interface EventRow {
  device_id?: string;
  timestamp?: string;
  event: string;
  mode?: string;
  phase?: string;
}

export async function insertEvent(row: EventRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO event_logs (device_id, timestamp, event, mode, phase) VALUES ($1, $2, $3, $4, $5)`,
      [row.device_id, row.timestamp, row.event, row.mode, row.phase],
    );
  } catch (e: any) {
    console.error("[DB] insertEvent:", e.message);
  }
}

export async function fetchEvents(limit = 50, deviceId?: string): Promise<EventRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    let result;
    if (deviceId) {
      result = await db.query(
        `SELECT * FROM event_logs WHERE device_id = $1 ORDER BY timestamp DESC LIMIT $2`,
        [deviceId, limit],
      );
    } else {
      result = await db.query(
        `SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT $1`,
        [limit],
      );
    }
    return result.rows;
  } catch (e: any) {
    console.error("[DB] fetchEvents:", e.message);
    return [];
  }
}
