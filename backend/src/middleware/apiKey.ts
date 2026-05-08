import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { getDb } from "../db";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const AUTH_DISABLED = process.env.API_KEY_AUTH === "0";
  if (AUTH_DISABLED) {
    req.deviceId = (req.headers["x-device-id"] as string) || "default";
    return next();
  }

  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  const db = getDb();
  if (!db) {
    req.deviceId = "default";
    return next();
  }

  try {
    const hash = hashApiKey(apiKey);

    // Try hashed key first
    let result = await db.query(
      `SELECT device_id FROM devices WHERE api_key = $1`,
      [hash],
    );

    // Legacy: plaintext key — auto-migrate to hash on first use
    if (result.rowCount === 0) {
      result = await db.query(
        `SELECT device_id FROM devices WHERE api_key = $1`,
        [apiKey],
      );
      if (result.rowCount! > 0) {
        await db.query(`UPDATE devices SET api_key = $1 WHERE api_key = $2`, [hash, apiKey]);
      }
    }

    if (result.rowCount === 0) {
      res.status(403).json({ error: "Invalid API key" });
      return;
    }

    const deviceId = result.rows[0].device_id;
    await db.query(`UPDATE devices SET last_seen = $1 WHERE device_id = $2`, [new Date().toISOString(), deviceId]);
    req.deviceId = deviceId;
    next();
  } catch {
    res.status(403).json({ error: "Invalid API key" });
  }
}
