import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { registry, ComposterState } from "./state";
import { getDb } from "./db";

let wss: WebSocketServer;
let _anonClient: SupabaseClient | null = null;

interface WsClientMeta { userId: string; deviceId: string; }
const clientMeta = new WeakMap<WebSocket, WsClientMeta>();
const subscribedDevices = new Set<string>();

function getAnonClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!_anonClient) {
    _anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return _anonClient;
}

async function verifyTokenGetUserId(token: string): Promise<string | null> {
  const client = getAnonClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser(token);
  return !error && user ? user.id : null;
}

async function verifyDeviceOwner(userId: string, deviceId: string): Promise<boolean> {
  if (process.env.SIMULATE === "1") return true;
  const db = getDb();
  if (!db) return true;
  try {
    const result = await db.query(
      `SELECT device_id FROM devices WHERE device_id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    return result.rowCount! > 0;
  } catch {
    return false;
  }
}

export function ensureDeviceSubscribed(deviceId: string) {
  if (subscribedDevices.has(deviceId)) return;
  const store = registry.get(deviceId);
  if (!store) return;
  subscribedDevices.add(deviceId);
  store.on("state", (state: ComposterState) => {
    broadcastToDevice(deviceId, { type: "state", deviceId, payload: state });
  });
  store.on("control", (data: any) => {
    broadcastToDevice(deviceId, { type: "control", deviceId, payload: data });
  });
}

function broadcastToDevice(deviceId: string, message: object) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    const meta = clientMeta.get(client as WebSocket);
    if (meta?.deviceId === deviceId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function setupWebSocket(server: HttpServer) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = reqUrl.searchParams.get("token");
    const deviceId = reqUrl.searchParams.get("device_id");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
      ws.close(1008, "Unauthorized");
      return;
    }
    if (!deviceId) {
      ws.send(JSON.stringify({ type: "error", message: "device_id required" }));
      ws.close(1008, "device_id required");
      return;
    }

    const userId = await verifyTokenGetUserId(token);
    if (!userId) {
      ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
      ws.close(1008, "Unauthorized");
      return;
    }

    const isOwner = await verifyDeviceOwner(userId, deviceId);
    if (!isOwner) {
      ws.send(JSON.stringify({ type: "error", message: "Forbidden" }));
      ws.close(1008, "Forbidden");
      return;
    }

    clientMeta.set(ws, { userId, deviceId });
    const deviceStore = registry.getOrCreate(deviceId);
    ensureDeviceSubscribed(deviceId);
    ws.send(JSON.stringify({ type: "state", deviceId, payload: deviceStore.state }));

    ws.on("error", (err) => console.error("[WS] client error:", err.message));
  });
}
