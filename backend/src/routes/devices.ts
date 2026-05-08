import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { getDb, isConnected } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAuthOrApiKey } from "../middleware/requireAuthOrApiKey";
import { sanitizeStr } from "../utils/sanitize";
import { hashApiKey } from "../middleware/apiKey";

const router: Router = Router();

async function assertOwnership(device_id: string, user_id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const result = await db.query(
      `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
      [device_id, user_id],
    );
    return result.rowCount! > 0;
  } catch { return false; }
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  try {
    const result = await getDb()!.query(
      `SELECT id, device_id, name, user_id, created_at, last_seen FROM devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId],
    );
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const name = sanitizeStr(req.body?.name, 100) || "New Composter";
  const device_id = crypto.randomUUID();
  const plain_key = "sk-" + randomBytes(32).toString("hex");
  const hashed_key = hashApiKey(plain_key);
  try {
    const result = await getDb()!.query(
      `INSERT INTO devices (device_id, api_key, name, user_id) VALUES ($1, $2, $3, $4)
       RETURNING device_id, name, created_at`,
      [device_id, hashed_key, name, req.userId],
    );
    res.status(201).json({ ...result.rows[0], api_key: plain_key });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:device_id", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  if (!(await assertOwnership(req.params.device_id, req.userId!)))
    return res.status(403).json({ error: "Forbidden" });
  try {
    await getDb()!.query(`DELETE FROM devices WHERE device_id = $1`, [req.params.device_id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/:device_id/calibration", requireAuthOrApiKey, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  const db = getDb()!;

  // API key path: device may only read its own calibration
  if (req.deviceId && !req.userId) {
    if (req.deviceId !== req.params.device_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  // JWT path: user may only read calibration for their own device
  if (req.userId) {
    try {
      const owned = await db.query(
        `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
        [req.params.device_id, req.userId],
      );
      if (owned.rowCount === 0) return res.status(403).json({ error: "Forbidden" });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  }

  try {
    const result = await db.query(
      `SELECT calibration FROM devices WHERE device_id = $1`,
      [req.params.device_id],
    );
    res.json(result.rows[0]?.calibration ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/:device_id/calibration", requireAuth, async (req: Request, res: Response) => {
  if (!isConnected()) return res.status(503).json({ error: "DB not connected" });
  if (!(await assertOwnership(req.params.device_id, req.userId!)))
    return res.status(403).json({ error: "Forbidden" });
  try {
    await getDb()!.query(
      `UPDATE devices SET calibration = $1 WHERE device_id = $2`,
      [req.body, req.params.device_id],
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
