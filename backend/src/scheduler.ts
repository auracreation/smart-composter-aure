import cron from "node-cron";
import { getDb, isConnected } from "./db";
import { computeNextRun, executeSchedule } from "./routes/schedules";
import { notifyScheduleRun } from "./services/notificationService";

async function fixNullNextRuns(): Promise<void> {
  if (!isConnected()) return;
  const db = getDb()!;
  try {
    const { rows } = await db.query(
      `SELECT * FROM schedules WHERE enabled = true AND next_run_at IS NULL`,
    );
    for (const s of rows) {
      const next = computeNextRun(
        s.start_time as string,
        s.recurrence as string,
        s.days_of_week as number[],
        s.run_date as string | null,
      );
      if (next) {
        await db.query(`UPDATE schedules SET next_run_at = $1 WHERE id = $2`, [next, s.id]);
        console.log(`[Scheduler] Repaired next_run_at for "${s.name}" → ${next}`);
      }
    }
  } catch (e: any) {
    console.error("[Scheduler] fixNullNextRuns error:", e.message);
  }
}

export function startScheduler(): void {
  fixNullNextRuns();

  // Run every minute at :00 seconds
  cron.schedule("* * * * *", async () => {
    if (!isConnected()) return;
    const db = getDb()!;

    const now = new Date().toISOString();
    let due: Record<string, unknown>[];
    try {
      const result = await db.query(
        `SELECT * FROM schedules WHERE enabled = true AND next_run_at IS NOT NULL AND next_run_at <= $1`,
        [now],
      );
      due = result.rows;
    } catch (e: any) {
      console.error("[Scheduler] Query error:", e.message);
      return;
    }

    if (due.length === 0) return;

    for (const schedule of due) {
      try {
        await executeSchedule(schedule);
        console.log(`[Scheduler] Executed schedule "${schedule.name}" for device ${schedule.device_id}`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        console.error(`[Scheduler] Failed schedule "${schedule.name}":`, e);
        try {
          await db.query(
            `INSERT INTO schedule_runs (schedule_id, ok, message) VALUES ($1, $2, $3)`,
            [schedule.id, false, errMsg],
          );
        } catch {}
        notifyScheduleRun(
          schedule.device_id as string,
          schedule.name as string,
          false,
          errMsg,
        ).catch(() => {});
      }
    }
  });

  console.log("[Scheduler] Started — checking schedules every minute");
}
