import { Router, Request, Response } from "express";
import { registry } from "../state";
import { requireAuth } from "../middleware/requireAuth";
import { apiKeyMiddleware } from "../middleware/apiKey";
import { getDb, isConnected } from "../db";

const router: ReturnType<typeof Router> = Router();

async function assertOwnership(deviceId: string, userId: string): Promise<boolean> {
  if (!isConnected()) return false;
  try {
    const result = await getDb()!.query(
      `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    return result.rowCount! > 0;
  } catch { return false; }
}

router.get("/esp32", apiKeyMiddleware, (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const store = registry.getOrCreate(deviceId);
  const s = store.state;
  res.json({ autoMode: s.autoMode, mode: s.mode, actuator: store.cmdActuator });
});

router.post("/mode", requireAuth, async (req: Request, res: Response) => {
  const { autoMode, device_id } = req.body;
  if (!device_id) { res.status(400).json({ error: "device_id required" }); return; }
  if (typeof autoMode !== "boolean") { res.status(400).json({ error: "autoMode must be boolean" }); return; }
  if (!(await assertOwnership(device_id, req.userId!))) { res.status(403).json({ error: "Forbidden" }); return; }
  registry.getOrCreate(device_id).setMode(autoMode);
  res.json({ ok: true, autoMode });
});

router.post("/actuator", requireAuth, async (req: Request, res: Response) => {
  const { heater, fan, pump, servo, device_id } = req.body;
  if (!device_id) { res.status(400).json({ error: "device_id required" }); return; }
  if (!(await assertOwnership(device_id, req.userId!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const update: Record<string, any> = {};
  if (typeof heater === "boolean") update.heater = heater;
  if (typeof fan === "boolean") update.fan = fan;
  if (typeof pump === "boolean") update.pump = pump;
  if (servo === "CLOSE" || servo === "HALF" || servo === "OPEN") update.servo = servo;
  if (Object.keys(update).length === 0) { res.status(400).json({ error: "No valid fields" }); return; }
  const deviceStore = registry.getOrCreate(device_id);
  deviceStore.setActuator(update);
  res.json({ ok: true, actuator: deviceStore.state.actuator });
});

router.post("/cycle", requireAuth, async (req: Request, res: Response) => {
  const { action, device_id } = req.body;
  if (!device_id) { res.status(400).json({ error: "device_id required" }); return; }
  if (action !== "start" && action !== "stop") { res.status(400).json({ error: "action must be 'start' or 'stop'" }); return; }
  if (!(await assertOwnership(device_id, req.userId!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const deviceStore = registry.getOrCreate(device_id);
  deviceStore.setCycle(action);
  res.json({ ok: true, mode: deviceStore.state.mode });
});

export default router;
