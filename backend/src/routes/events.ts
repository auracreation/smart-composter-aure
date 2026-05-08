import express, { Request, Response, Router } from "express";
import { registry } from "../state";
import { isConnected } from "../db";
import { fetchEvents } from "../models/EventLog";
import { requireAuth } from "../middleware/requireAuth";

const router: Router = express.Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const deviceId = req.query.device_id as string | undefined;
  if (isConnected()) {
    try {
      const rows = await fetchEvents(limit, deviceId);
      return res.json(rows);
    } catch {
      // fall through to in-memory
    }
  }
  const deviceStore = deviceId ? registry.get(deviceId) : undefined;
  res.json((deviceStore?.events ?? []).slice(0, limit));
});

export default router;
