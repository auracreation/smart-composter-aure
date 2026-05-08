import { Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

let _client: SupabaseClient | null = null;

function getVerifyClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!_client) {
    _client = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return _client;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const client = getVerifyClient();

  if (!client) {
    res.status(503).json({ error: "Service unavailable" });
    return;
  }

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = user.id;
  next();
}
