import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getDb, isConnected } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { sendActivationEmail } from "../mailer";
import { sanitizeStr, sanitizeNumber, isStrongPassword } from "../utils/sanitize";

const router: Router = Router();

const DEFAULT_SETTINGS = {
  display_name: null,
  notify_email: true,
  notify_push: false,
  alert_temp_max: 70,
  alert_temp_min: 30,
  alert_humidity_min: 30,
  default_device_id: null,
  history_retention_days: 90,
};

// GET /api/settings
router.get("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;
  try {
    const result = await db.query(`SELECT * FROM user_settings WHERE user_id = $1`, [req.userId]);
    if (result.rowCount === 0) {
      // Row doesn't exist yet — insert defaults
      const cols = ["user_id", ...Object.keys(DEFAULT_SETTINGS)];
      const vals = [req.userId, ...Object.values(DEFAULT_SETTINGS)];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
      const ins = await db.query(
        `INSERT INTO user_settings (${cols.join(",")}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      return res.json(ins.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/settings
router.patch("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const b = req.body;
  if ("display_name" in b)          patch.display_name          = sanitizeStr(b.display_name, 100) || null;
  if ("notify_email" in b)          patch.notify_email          = b.notify_email === true;
  if ("notify_push" in b)           patch.notify_push           = b.notify_push === true;
  if ("alert_temp_max" in b)        patch.alert_temp_max        = sanitizeNumber(b.alert_temp_max, 0, 200) ?? 70;
  if ("alert_temp_min" in b)        patch.alert_temp_min        = sanitizeNumber(b.alert_temp_min, 0, 200) ?? 30;
  if ("alert_humidity_min" in b)    patch.alert_humidity_min    = sanitizeNumber(b.alert_humidity_min, 0, 100) ?? 30;
  if ("default_device_id" in b)     patch.default_device_id     = sanitizeStr(b.default_device_id, 64) || null;
  if ("history_retention_days" in b) patch.history_retention_days = sanitizeNumber(b.history_retention_days, 1, 365) ?? 90;

  // Check previous notify_email value before upsert
  const activatingEmail = patch.notify_email === true;
  let prevNotifyEmail = true;
  if (activatingEmail) {
    try {
      const prev = await db.query(`SELECT notify_email FROM user_settings WHERE user_id = $1`, [req.userId]);
      prevNotifyEmail = prev.rows[0]?.notify_email ?? true;
    } catch {}
  }

  let data: Record<string, unknown>;
  try {
    const keys = ["user_id", ...Object.keys(patch)];
    const vals = [req.userId, ...Object.values(patch)];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    const updateSet = Object.keys(patch).map((k, i) => `${k} = $${i + 2}`).join(",");
    const result = await db.query(
      `INSERT INTO user_settings (${keys.join(",")}) VALUES (${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updateSet} RETURNING *`,
      vals,
    );
    data = result.rows[0];
  } catch (e: any) { return res.status(500).json({ error: e.message }); }

  // Send activation email only when switching from off → on
  if (activatingEmail && !prevNotifyEmail) {
    try {
      const url = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && serviceKey) {
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
        const { data: userData } = await admin.auth.admin.getUserById(req.userId!);
        const email = userData?.user?.email;
        const name = (data as Record<string, unknown>).display_name as string | null;
        if (email) {
          await sendActivationEmail(email, name);
          console.log(`[Mailer] Activation email sent to ${email}`);
        }
      }
    } catch (e) {
      console.error("[Mailer] Failed to send activation email:", e);
    }
  }

  res.json({ ok: true });
});

// POST /api/account/password
router.post("/account/password", requireAuth, async (req: Request, res: Response) => {
  const { new_password } = req.body;
  if (!isStrongPassword(new_password)) {
    return res.status(400).json({
      error: "Password minimal 8 karakter dan harus mengandung huruf kecil, huruf besar, dan angka",
    });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: "Service unavailable" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.updateUserById(req.userId!, { password: new_password });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/settings/account/sessions
router.get("/account/sessions", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;
  try {
    const result = await db.query(
      `SELECT id, created_at, updated_at, refreshed_at, user_agent,
              ip::text AS ip, not_after
       FROM auth.sessions
       WHERE user_id = $1
       ORDER BY COALESCE(refreshed_at, updated_at, created_at) DESC NULLS LAST`,
      [req.userId],
    );
    res.json({ sessions: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/account/sessions/:id
router.delete("/account/sessions/:id", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;
  const sessionId = req.params.id;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const check = await client.query(
      "SELECT id FROM auth.sessions WHERE id = $1 AND user_id = $2",
      [sessionId, req.userId],
    );
    if ((check.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }
    await client.query("DELETE FROM auth.mfa_amr_claims WHERE session_id = $1", [sessionId]);
    await client.query("DELETE FROM auth.refresh_tokens WHERE session_id = $1", [sessionId]);
    await client.query("DELETE FROM auth.sessions WHERE id = $1", [sessionId]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/account/logout-all
router.post("/account/logout-all", requireAuth, async (req: Request, res: Response) => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: "Service unavailable" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.signOut(req.userId!, "others");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/account/export
router.get("/account/export", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;

  let deviceList: { device_id: string; name: string }[] = [];
  try {
    const devResult = await db.query(`SELECT device_id, name FROM devices WHERE user_id = $1`, [req.userId]);
    deviceList = devResult.rows;
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
  const deviceIds = deviceList.map((d) => d.device_id);
  const deviceNameMap: Record<string, string> = {};
  deviceList.forEach((d) => { deviceNameMap[d.device_id] = d.name; });

  function csvCell(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function fmtTimestamp(iso: unknown): string {
    if (!iso || typeof iso !== "string") return "";
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch { return String(iso); }
  }

  function fmtBool(val: unknown): string {
    if (val === true || val === "true") return "Aktif";
    if (val === false || val === "false") return "Mati";
    return "";
  }

  const HEADERS = ["Waktu", "Nama Perangkat", "ID Perangkat", "Mode", "Fase", "Suhu Inti (°C)", "Suhu Udara (°C)", "Kelembaban (%)", "Kelembaban Tanah (%)", "Gas Raw", "Heater", "Kipas", "Pompa", "Servo"];

  const emptyRow = HEADERS.join(",") + "\n";

  if (deviceIds.length === 0) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=history.csv");
    return res.send("\uFEFF" + emptyRow);
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const telResult = await db.query(
      `SELECT * FROM telemetry_logs WHERE device_id = ANY($1) ORDER BY timestamp DESC LIMIT 10000`,
      [deviceIds],
    );
    rows = telResult.rows;
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
  const csvRows = rows.map((r) => [
    csvCell(fmtTimestamp(r.timestamp)),
    csvCell(deviceNameMap[r.device_id as string] ?? ""),
    csvCell(r.device_id),
    csvCell(r.mode),
    csvCell(r.phase),
    csvCell(r.core_temp),
    csvCell(r.air_temp_avg),
    csvCell(r.air_humidity_avg),
    csvCell(r.soil_percent),
    csvCell(r.gas_raw),
    csvCell(fmtBool(r.heater)),
    csvCell(fmtBool(r.fan)),
    csvCell(fmtBool(r.pump)),
    csvCell(r.servo),
  ].join(","));

  const csv = "\uFEFF" + [HEADERS.join(","), ...csvRows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=history.csv");
  res.send(csv);
});

// DELETE /api/account
router.delete("/account", requireAuth, async (req: Request, res: Response) => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: "Service unavailable" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(req.userId!);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
