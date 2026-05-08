import { getDb } from "../db";

export type NotificationType = "alert" | "warning" | "info" | "system" | "schedule" | "device";

export interface NotificationRow {
  id: string;
  user_id: string;
  device_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
}

export interface CreateNotificationInput {
  user_id: string;
  device_id?: string | null;
  type?: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function insertNotification(input: CreateNotificationInput): Promise<NotificationRow | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const result = await db.query<NotificationRow>(
      `INSERT INTO notifications (user_id, device_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.user_id,
        input.device_id ?? null,
        input.type ?? "info",
        input.title,
        input.message,
        JSON.stringify(input.data ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  } catch (e: any) {
    console.error("[DB] insertNotification:", e.message);
    return null;
  }
}

export async function fetchNotifications(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  const db = getDb();
  if (!db) return [];
  const { limit = 50, unreadOnly = false } = opts;
  try {
    const result = await db.query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND deleted_at IS NULL ${unreadOnly ? "AND read = false" : ""}
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows;
  } catch (e: any) {
    console.error("[DB] fetchNotifications:", e.message);
    return [];
  }
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = false AND deleted_at IS NULL`,
      [userId],
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch (e: any) {
    console.error("[DB] countUnread:", e.message);
    return 0;
  }
}

export async function markRead(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const result = await db.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (e: any) {
    console.error("[DB] markRead:", e.message);
    return false;
  }
}

export async function markAllRead(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const result = await db.query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false AND deleted_at IS NULL`,
      [userId],
    );
    return result.rowCount ?? 0;
  } catch (e: any) {
    console.error("[DB] markAllRead:", e.message);
    return 0;
  }
}

export async function deleteNotification(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const result = await db.query(
      `UPDATE notifications SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (e: any) {
    console.error("[DB] deleteNotification:", e.message);
    return false;
  }
}

export async function deleteAllRead(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const result = await db.query(
      `UPDATE notifications SET deleted_at = now() WHERE user_id = $1 AND read = true AND deleted_at IS NULL`,
      [userId],
    );
    return result.rowCount ?? 0;
  } catch (e: any) {
    console.error("[DB] deleteAllRead:", e.message);
    return 0;
  }
}
