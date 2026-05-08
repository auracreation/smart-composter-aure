import { getDb } from "../db";
import { insertNotification, NotificationType } from "../models/Notification";
import { SensorData } from "../state";
import { sendAlertEmail } from "../mailer";

const SENSOR_COOLDOWN_MS = 10 * 60 * 1000; // 10 min between repeated sensor alerts
const DEVICE_COOLDOWN_MS =  5 * 60 * 1000; // 5 min between repeated online/offline

/**
 * Returns true if the alert may be sent (cooldown expired or first time).
 * Atomically updates last_sent_at so concurrent calls are safe.
 * Falls back to true (allow send) if DB is unavailable.
 */
async function checkAndSetCooldown(deviceId: string, alertKey: string, windowMs: number): Promise<boolean> {
  const db = getDb();
  if (!db) return true;
  try {
    const result = await db.query(
      `INSERT INTO notification_cooldowns (device_id, alert_key, last_sent_at)
       VALUES ($1, $2, now())
       ON CONFLICT (device_id, alert_key) DO UPDATE
         SET last_sent_at = now()
         WHERE notification_cooldowns.last_sent_at < now() - ($3 * interval '1 millisecond')
       RETURNING device_id`,
      [deviceId, alertKey, windowMs],
    );
    return (result.rowCount ?? 0) > 0;
  } catch { return true; }
}

async function getUserEmailIfEnabled(deviceId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.query<{ email: string; notify_email: boolean }>(
      `SELECT au.email, COALESCE(us.notify_email, true) AS notify_email
       FROM devices d
       JOIN auth.users au ON au.id = d.user_id
       LEFT JOIN user_settings us ON us.user_id = d.user_id
       WHERE d.device_id = $1`,
      [deviceId],
    );
    const row = r.rows[0];
    if (!row || !row.notify_email) return null;
    return row.email ?? null;
  } catch { return null; }
}

async function getUserId(deviceId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.query<{ user_id: string }>(
      `SELECT user_id FROM devices WHERE device_id = $1`,
      [deviceId],
    );
    return r.rows[0]?.user_id ?? null;
  } catch { return null; }
}

async function push(
  deviceId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const userId = await getUserId(deviceId);
  if (!userId) return;
  await insertNotification({ user_id: userId, device_id: deviceId, type, title, message, data }).catch(() => {});
}

// ── Sensor alerts ─────────────────────────────────────────────────────────

export async function checkSensorAlerts(deviceId: string, sensor: SensorData): Promise<void> {
  if (sensor.coreTemp > 75 && await checkAndSetCooldown(deviceId, "coreTemp_high", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "alert",
      "Suhu Inti Terlalu Tinggi",
      `Suhu inti mencapai ${sensor.coreTemp.toFixed(1)}°C — melebihi batas aman 75°C.`,
      { coreTemp: sensor.coreTemp });
    const email = await getUserEmailIfEnabled(deviceId);
    if (email) sendAlertEmail({ to: email, deviceId, alertType: "Suhu Inti Terlalu Tinggi", value: sensor.coreTemp, threshold: 75, unit: "°C" }).catch(() => {});
  }
  if (sensor.coreTemp > 0 && sensor.coreTemp < 25 && await checkAndSetCooldown(deviceId, "coreTemp_low", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Suhu Inti Terlalu Rendah",
      `Suhu inti ${sensor.coreTemp.toFixed(1)}°C di bawah rentang optimal (25–75°C).`,
      { coreTemp: sensor.coreTemp });
    const email = await getUserEmailIfEnabled(deviceId);
    if (email) sendAlertEmail({ to: email, deviceId, alertType: "Suhu Inti Terlalu Rendah", value: sensor.coreTemp, threshold: 25, unit: "°C" }).catch(() => {});
  }
  if (sensor.airHumidityAvg > 0 && sensor.airHumidityAvg < 30 && await checkAndSetCooldown(deviceId, "humidity_low", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Kelembaban Udara Rendah",
      `Kelembaban udara ${sensor.airHumidityAvg.toFixed(0)}% di bawah ambang optimal (30%).`,
      { airHumidityAvg: sensor.airHumidityAvg });
    const email = await getUserEmailIfEnabled(deviceId);
    if (email) sendAlertEmail({ to: email, deviceId, alertType: "Kelembaban Udara Rendah", value: sensor.airHumidityAvg, threshold: 30, unit: "%" }).catch(() => {});
  }
  if (sensor.soilPercent > 0 && sensor.soilPercent < 20 && await checkAndSetCooldown(deviceId, "soil_dry", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Media Kompos Terlalu Kering",
      `Kelembaban tanah ${sensor.soilPercent.toFixed(0)}% — pertimbangkan penambahan air.`,
      { soilPercent: sensor.soilPercent });
    const email = await getUserEmailIfEnabled(deviceId);
    if (email) sendAlertEmail({ to: email, deviceId, alertType: "Media Kompos Terlalu Kering", value: sensor.soilPercent, threshold: 20, unit: "%" }).catch(() => {});
  }
  if (sensor.soilPercent > 90 && await checkAndSetCooldown(deviceId, "soil_wet", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Media Kompos Terlalu Basah",
      `Kelembaban tanah ${sensor.soilPercent.toFixed(0)}% — terlalu jenuh air.`,
      { soilPercent: sensor.soilPercent });
    const email = await getUserEmailIfEnabled(deviceId);
    if (email) sendAlertEmail({ to: email, deviceId, alertType: "Media Kompos Terlalu Basah", value: sensor.soilPercent, threshold: 90, unit: "%" }).catch(() => {});
  }
  if (!sensor.ds18b20Valid && await checkAndSetCooldown(deviceId, "ds18b20_invalid", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Sensor Suhu Bermasalah",
      "Sensor DS18B20 (suhu inti) tidak merespons. Periksa koneksi sensor.",
      {});
  }
  if (!sensor.dht1Valid && !sensor.dht2Valid && await checkAndSetCooldown(deviceId, "dht_invalid", SENSOR_COOLDOWN_MS)) {
    await push(deviceId, "warning",
      "Sensor DHT Bermasalah",
      "Kedua sensor DHT (suhu & kelembaban udara) tidak merespons.",
      {});
  }
}

// ── Mode switch ───────────────────────────────────────────────────────────

export async function notifyModeChanged(deviceId: string, autoMode: boolean): Promise<void> {
  if (autoMode) {
    await push(deviceId, "system",
      "Mode Otomatis Diaktifkan",
      "Sistem beralih ke mode otomatis — aktuator dikendalikan secara otomatis.",
    );
  } else {
    await push(deviceId, "system",
      "Mode Manual Diaktifkan",
      "Sistem beralih ke mode manual — aktuator dapat dikendalikan secara langsung.",
    );
  }
}

// ── System / cycle events ─────────────────────────────────────────────────

export async function notifyCycleStarted(deviceId: string): Promise<void> {
  await push(deviceId, "system",
    "Siklus Kompos Dimulai",
    "Proses pengomposan telah diaktifkan dan sistem berjalan.",
  );
}

export async function notifyCycleStopped(deviceId: string): Promise<void> {
  await push(deviceId, "system",
    "Siklus Kompos Dihentikan",
    "Proses pengomposan dihentikan oleh pengguna.",
  );
}

export async function notifyCycleFinished(deviceId: string): Promise<void> {
  await push(deviceId, "system",
    "Siklus Kompos Selesai",
    "Proses pengomposan telah selesai secara otomatis.",
  );
}

// ── Device online / offline ───────────────────────────────────────────────

export async function notifyDeviceOffline(deviceId: string): Promise<void> {
  if (!await checkAndSetCooldown(deviceId, "offline", DEVICE_COOLDOWN_MS)) return;
  await push(deviceId, "device",
    "Perangkat Tidak Terhubung",
    `ESP32 tidak mengirimkan data lebih dari 30 detik. Periksa koneksi jaringan.`,
  );
}

export async function notifyDeviceOnline(deviceId: string): Promise<void> {
  if (!await checkAndSetCooldown(deviceId, "online", DEVICE_COOLDOWN_MS)) return;
  await push(deviceId, "device",
    "Perangkat Terhubung Kembali",
    `ESP32 kembali terhubung dan mengirimkan data telemetri.`,
  );
}

// ── Schedule events ───────────────────────────────────────────────────────

export async function notifyScheduleRun(
  deviceId: string,
  scheduleName: string,
  ok: boolean,
  errorMsg?: string,
): Promise<void> {
  if (ok) {
    await push(deviceId, "schedule",
      "Jadwal Dijalankan",
      `Jadwal "${scheduleName}" berhasil dijalankan.`,
    );
  } else {
    await push(deviceId, "schedule",
      "Jadwal Gagal Dijalankan",
      `Jadwal "${scheduleName}" gagal: ${errorMsg ?? "kesalahan tidak diketahui"}.`,
    );
  }
}
