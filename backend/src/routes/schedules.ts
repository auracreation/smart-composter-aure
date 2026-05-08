import { Router, Request, Response } from "express";
import { getDb, isConnected } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { registry } from "../state";
import { sanitizeStr, sanitizeEnum, sanitizeNumber, isValidTime, isValidDate } from "../utils/sanitize";
import { notifyScheduleRun } from "../services/notificationService";

const VALID_RECURRENCES = ["once", "daily", "weekly"] as const;
const VALID_SERVO = ["OPEN", "HALF", "CLOSE"] as const;

const router: Router = Router();

async function assertOwnership(scheduleId: string, userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const result = await db.query(
      `SELECT id FROM schedules WHERE id = $1 AND user_id = $2`,
      [scheduleId, userId],
    );
    return result.rowCount! > 0;
  } catch { return false; }
}

// GET /api/schedules?device_id=
router.get("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const deviceId = req.query.device_id as string | undefined;
  try {
    let result;
    if (deviceId) {
      result = await getDb()!.query(
        `SELECT * FROM schedules WHERE user_id = $1 AND device_id = $2 ORDER BY created_at DESC`,
        [req.userId, deviceId],
      );
    } else {
      result = await getDb()!.query(
        `SELECT * FROM schedules WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.userId],
      );
    }
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/schedules
router.post("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;
  const b = req.body;
  const device_id  = sanitizeStr(b.device_id, 64);
  const name       = sanitizeStr(b.name, 100);
  const start_time = sanitizeStr(b.start_time, 5);
  const recurrence = sanitizeEnum(b.recurrence, VALID_RECURRENCES);
  const run_date   = b.run_date ? sanitizeStr(b.run_date, 10) : null;
  const duration_sec = b.duration_sec !== undefined ? sanitizeNumber(b.duration_sec, 1, 86400) : null;

  const action: Record<string, unknown> = {};
  if (typeof b.action === "object" && b.action !== null) {
    if (typeof b.action.heater === "boolean") action.heater = b.action.heater;
    if (typeof b.action.fan === "boolean")    action.fan    = b.action.fan;
    if (typeof b.action.pump === "boolean")   action.pump   = b.action.pump;
    const servo = sanitizeEnum(b.action.servo, VALID_SERVO);
    if (servo) action.servo = servo;
  }

  const days_of_week: number[] = Array.isArray(b.days_of_week)
    ? b.days_of_week.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6)
    : [];

  if (!device_id || !name || !recurrence || !isValidTime(start_time)) {
    return res.status(400).json({ error: "device_id, name, start_time (HH:MM), recurrence required" });
  }
  if (recurrence === "once" && !isValidDate(run_date)) {
    return res.status(400).json({ error: "run_date (YYYY-MM-DD) required for once recurrence" });
  }
  if (recurrence === "once" && run_date) {
    if (new Date(`${run_date}T${start_time}:00+07:00`) <= new Date()) {
      return res.status(400).json({ error: "Jadwal sekali jalan harus di masa mendatang." });
    }
  }
  if (recurrence === "weekly" && days_of_week.length === 0) {
    return res.status(400).json({ error: "days_of_week required for weekly recurrence" });
  }
  if (Object.keys(action).length === 0) {
    return res.status(400).json({ error: "action must include at least one actuator" });
  }

  try {
    const owned = await db.query(
      `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
      [device_id, req.userId],
    );
    if (owned.rowCount === 0) return res.status(403).json({ error: "Forbidden" });

    const next_run_at = computeNextRun(start_time, recurrence, days_of_week, run_date);
    const result = await db.query(
      `INSERT INTO schedules
        (user_id,device_id,name,action,duration_sec,start_time,recurrence,days_of_week,run_date,enabled,next_run_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.userId, device_id, name, action, duration_sec,
        start_time, recurrence, days_of_week, run_date, true, next_run_at,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/schedules/:id
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  if (!(await assertOwnership(req.params.id, req.userId!)))
    return res.status(403).json({ error: "Forbidden" });

  const db = getDb()!;
  const b = req.body;
  const patch: Record<string, unknown> = {};
  if ("name" in b)         patch.name         = sanitizeStr(b.name, 100);
  if ("start_time" in b)   patch.start_time   = sanitizeStr(b.start_time, 5);
  if ("recurrence" in b)   patch.recurrence   = sanitizeEnum(b.recurrence, VALID_RECURRENCES) ?? undefined;
  if ("run_date" in b)     patch.run_date     = b.run_date ? sanitizeStr(b.run_date, 10) : null;
  if ("duration_sec" in b) patch.duration_sec = b.duration_sec !== null ? sanitizeNumber(b.duration_sec, 1, 86400) : null;
  if ("enabled" in b)      patch.enabled      = b.enabled === true;
  if ("days_of_week" in b) patch.days_of_week = Array.isArray(b.days_of_week)
    ? b.days_of_week.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6)
    : [];
  if ("action" in b && typeof b.action === "object" && b.action !== null) {
    const a: Record<string, unknown> = {};
    if (typeof b.action.heater === "boolean") a.heater = b.action.heater;
    if (typeof b.action.fan === "boolean")    a.fan    = b.action.fan;
    if (typeof b.action.pump === "boolean")   a.pump   = b.action.pump;
    const servo = sanitizeEnum(b.action.servo, VALID_SERVO);
    if (servo) a.servo = servo;
    if (Object.keys(a).length > 0) patch.action = a;
  }
  if (patch.start_time && !isValidTime(patch.start_time)) {
    return res.status(400).json({ error: "start_time must be HH:MM" });
  }
  if (patch.run_date && !isValidDate(patch.run_date)) {
    return res.status(400).json({ error: "run_date must be YYYY-MM-DD" });
  }
  if ((patch.run_date || patch.start_time) && b.recurrence === "once") {
    const rd = (patch.run_date ?? b.run_date) as string | null;
    const st = (patch.start_time ?? b.start_time) as string;
    if (rd && new Date(`${rd}T${st}:00+07:00`) <= new Date()) {
      return res.status(400).json({ error: "Jadwal sekali jalan harus di masa mendatang." });
    }
  }

  try {
    if (patch.start_time || patch.recurrence || patch.days_of_week || patch.run_date || patch.enabled !== undefined) {
      const ex = await db.query(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
      if (ex.rowCount! > 0) {
        const existing = ex.rows[0];
        const st = (patch.start_time ?? existing.start_time) as string;
        const rec = (patch.recurrence ?? existing.recurrence) as string;
        const dow = (patch.days_of_week ?? existing.days_of_week) as number[];
        const rd = (patch.run_date ?? existing.run_date) as string | null;
        const enabled = patch.enabled !== undefined ? patch.enabled as boolean : existing.enabled;
        patch.next_run_at = enabled ? computeNextRun(st, rec, dow, rd) : null;
      }
    }

    const setClauses = Object.keys(patch).map((k, i) => `${k} = $${i + 2}`).join(",");
    const result = await db.query(
      `UPDATE schedules SET ${setClauses} WHERE id = $1 RETURNING *`,
      [req.params.id, ...Object.values(patch)],
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/schedules/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  if (!(await assertOwnership(req.params.id, req.userId!)))
    return res.status(403).json({ error: "Forbidden" });
  try {
    await getDb()!.query(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/schedules/:id/run  — trigger immediately
router.post("/:id/run", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  if (!(await assertOwnership(req.params.id, req.userId!)))
    return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await getDb()!.query(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Schedule not found" });
    await executeSchedule(result.rows[0]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Execution failed" });
  }
});

// ── helpers ───────────────────────────────────────────────────────────────

const WIB_MS = 7 * 3600 * 1000;

function wibDateStr(offsetDays = 0): string {
  return new Date(Date.now() + WIB_MS + offsetDays * 86_400_000).toISOString().split("T")[0];
}

export function computeNextRun(
  startTime: string,
  recurrence: string,
  daysOfWeek: number[],
  runDate: string | null,
): string | null {
  const now = new Date();

  if (recurrence === "once") {
    if (!runDate) return null;
    const d = new Date(`${runDate}T${startTime}:00+07:00`);
    return d > now ? d.toISOString() : null;
  }

  if (recurrence === "daily") {
    const candidate = new Date(`${wibDateStr()}T${startTime}:00+07:00`);
    if (candidate <= now) return new Date(`${wibDateStr(1)}T${startTime}:00+07:00`).toISOString();
    return candidate.toISOString();
  }

  if (recurrence === "weekly") {
    if (!daysOfWeek || daysOfWeek.length === 0) return null;
    for (let offset = 0; offset < 14; offset++) {
      const dateStr = wibDateStr(offset);
      const d = new Date(`${dateStr}T${startTime}:00+07:00`);
      if (d <= now) continue;
      const dayOfWeek = new Date(Date.now() + WIB_MS + offset * 86_400_000).getUTCDay();
      if (daysOfWeek.includes(dayOfWeek)) return d.toISOString();
    }
  }

  return null;
}

export async function executeSchedule(schedule: Record<string, unknown>): Promise<void> {
  const deviceId = schedule.device_id as string;
  const action = schedule.action as Record<string, unknown>;
  const durationSec = schedule.duration_sec as number | null;

  const store = registry.getOrCreate(deviceId);
  store.setActuator(action as Parameters<typeof store.setActuator>[0]);

  const db = getDb();
  if (db) {
    await db.query(
      `INSERT INTO schedule_runs (schedule_id, ok, message) VALUES ($1, $2, $3)`,
      [schedule.id, true, "Executed"],
    );
    notifyScheduleRun(deviceId, schedule.name as string, true).catch(() => {});
    await db.query(
      `UPDATE schedules SET last_run_at = $1, next_run_at = $2 WHERE id = $3`,
      [
        new Date().toISOString(),
        computeNextRun(
          schedule.start_time as string,
          schedule.recurrence as string,
          schedule.days_of_week as number[],
          schedule.run_date as string | null,
        ),
        schedule.id,
      ],
    );
  }

  if (durationSec && durationSec > 0) {
    const offAction: Record<string, unknown> = {};
    if (typeof action.heater === "boolean") offAction.heater = false;
    if (typeof action.fan === "boolean") offAction.fan = false;
    if (typeof action.pump === "boolean") offAction.pump = false;
    setTimeout(() => {
      try { registry.get(deviceId)?.setActuator(offAction as Parameters<typeof store.setActuator>[0]); } catch {}
    }, durationSec * 1000);
  }
}

export default router;
