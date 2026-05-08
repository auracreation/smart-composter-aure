import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  fetchNotifications,
  countUnread,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllRead,
} from "../models/Notification";

const router: ReturnType<typeof Router> = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response) => {
  const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const notifications = await fetchNotifications(req.userId!, { limit, unreadOnly });
  res.json(notifications);
});

router.get("/unread-count", async (req: Request, res: Response) => {
  const count = await countUnread(req.userId!);
  res.json({ count });
});

router.patch("/:id/read", async (req: Request, res: Response) => {
  const ok = await markRead(req.params.id, req.userId!);
  if (!ok) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

router.patch("/read-all", async (req: Request, res: Response) => {
  const updated = await markAllRead(req.userId!);
  res.json({ ok: true, updated });
});

router.delete("/read", async (req: Request, res: Response) => {
  const deleted = await deleteAllRead(req.userId!);
  res.json({ ok: true, deleted });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const ok = await deleteNotification(req.params.id, req.userId!);
  if (!ok) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

export default router;
