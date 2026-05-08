try { (process as any).loadEnvFile(".env"); } catch {}
import express from "express";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import telemetryRouter from "./routes/telemetry";
import controlRouter from "./routes/control";
import eventsRouter from "./routes/events";
import historyRouter from "./routes/history";
import { setupWebSocket } from "./ws";
import { startSimulator } from "./simulator";
import { connectDB } from "./db";
import devicesRouter from "./routes/devices";
import schedulesRouter from "./routes/schedules";
import settingsRouter from "./routes/settings";
import notificationsRouter from "./routes/notifications";
import { startScheduler } from "./scheduler";

const PORT = parseInt(process.env.PORT || "3001", 10);
const SIMULATE = process.env.SIMULATE === "1" || process.env.SIMULATE === "true";

const app = express();

app.use(helmet());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "100kb" }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
app.use("/api", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later." },
});

app.use("/api/telemetry", telemetryRouter);
app.use("/api/state", telemetryRouter);
app.use("/api/control", controlRouter);
app.use("/api/events", eventsRouter);
app.use("/api/history", historyRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings/account/password", authLimiter);
app.use("/api/settings/account", authLimiter);
app.use("/api/settings", settingsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
setupWebSocket(server);

connectDB(); // sync — just creates Supabase client

server.listen(PORT, () => {
  console.log(`[Backend] Listening on http://localhost:${PORT}`);
  console.log(`[Backend] WebSocket on ws://localhost:${PORT}/ws`);

  startScheduler();

  if (SIMULATE) {
    startSimulator(3000);
  }
});
