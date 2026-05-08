import { ComposterState, ActuatorState, EventEntry, HistoryEntry } from "./types";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const b = await res.json(); if (b?.error) msg = b.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getState(deviceId: string): Promise<ComposterState> {
  return fetchJson<ComposterState>(`${API}/api/state?device_id=${encodeURIComponent(deviceId)}`);
}

export async function setMode(autoMode: boolean, deviceId: string): Promise<void> {
  await fetchJson(`${API}/api/control/mode`, {
    method: "POST",
    body: JSON.stringify({ autoMode, device_id: deviceId }),
  });
}

export async function setActuator(act: Partial<ActuatorState>, deviceId: string): Promise<void> {
  await fetchJson(`${API}/api/control/actuator`, {
    method: "POST",
    body: JSON.stringify({ ...act, device_id: deviceId }),
  });
}

export async function setCycle(action: "start" | "stop", deviceId: string): Promise<void> {
  await fetchJson(`${API}/api/control/cycle`, {
    method: "POST",
    body: JSON.stringify({ action, device_id: deviceId }),
  });
}

export async function getEvents(limit = 50, deviceId?: string): Promise<EventEntry[]> {
  const q = deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : "";
  return fetchJson<EventEntry[]>(`${API}/api/events?limit=${limit}${q}`);
}

export async function getHistory(limit = 100, deviceId?: string, from?: string, to?: string): Promise<HistoryEntry[]> {
  const p = new URLSearchParams({ limit: String(limit) });
  if (deviceId) p.set("device_id", deviceId);
  if (from)     p.set("from", from);
  if (to)       p.set("to", to);
  return fetchJson<HistoryEntry[]>(`${API}/api/history?${p}`);
}

export interface DeviceRow {
  id: string;
  device_id: string;
  name: string;
  user_id: string | null;
  created_at: string;
  last_seen: string | null;
}

export interface NewDeviceResult {
  device_id: string;
  api_key: string;
  name: string;
  created_at: string;
}

export async function getDevices(): Promise<DeviceRow[]> {
  return fetchJson<DeviceRow[]>(`${API}/api/devices`);
}

export async function addDevice(name: string): Promise<NewDeviceResult> {
  return fetchJson<NewDeviceResult>(`${API}/api/devices`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function removeDevice(device_id: string): Promise<void> {
  await fetchJson(`${API}/api/devices/${device_id}`, { method: "DELETE" });
}

export interface CalibrationData {
  tempCoreOffset?: number;
  tempAirOffset?: number;
  humidityOffset?: number;
  soilMin?: number;
  soilMax?: number;
  gasThreshold?: number;
}

export async function getCalibration(device_id: string): Promise<CalibrationData> {
  return fetchJson<CalibrationData>(`${API}/api/devices/${encodeURIComponent(device_id)}/calibration`);
}

export async function saveCalibration(device_id: string, data: CalibrationData): Promise<void> {
  await fetchJson(`${API}/api/devices/${encodeURIComponent(device_id)}/calibration`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Schedules ─────────────────────────────────────────────────────────────

export type Recurrence = "once" | "daily" | "weekly";
export type ScheduleAction = {
  heater?: boolean;
  fan?: boolean;
  pump?: boolean;
  servo?: "OPEN" | "HALF" | "CLOSE";
};

export interface Schedule {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  action: ScheduleAction;
  duration_sec: number | null;
  start_time: string;
  recurrence: Recurrence;
  days_of_week: number[];
  run_date: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export type ScheduleInput = Omit<Schedule, "id" | "user_id" | "created_at" | "last_run_at" | "next_run_at">;

export async function listSchedules(device_id?: string): Promise<Schedule[]> {
  const q = device_id ? `?device_id=${encodeURIComponent(device_id)}` : "";
  return fetchJson<Schedule[]>(`${API}/api/schedules${q}`);
}

export async function createSchedule(data: ScheduleInput): Promise<Schedule> {
  return fetchJson<Schedule>(`${API}/api/schedules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSchedule(id: string, data: Partial<ScheduleInput & { enabled: boolean }>): Promise<Schedule> {
  return fetchJson<Schedule>(`${API}/api/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  await fetchJson(`${API}/api/schedules/${id}`, { method: "DELETE" });
}

export async function runScheduleNow(id: string): Promise<void> {
  await fetchJson(`${API}/api/schedules/${id}/run`, { method: "POST" });
}

// ── User Settings ─────────────────────────────────────────────────────────

export interface UserSettings {
  user_id: string;
  display_name: string | null;
  notify_email: boolean;
  notify_push: boolean;
  alert_temp_max: number;
  alert_temp_min: number;
  alert_humidity_min: number;
  default_device_id: string | null;
  history_retention_days: number;
  updated_at: string;
}

export async function getSettings(): Promise<UserSettings> {
  return fetchJson<UserSettings>(`${API}/api/settings`);
}

export async function updateSettings(data: Partial<Omit<UserSettings, "user_id" | "updated_at">>): Promise<void> {
  await fetchJson<{ ok: boolean }>(`${API}/api/settings`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function changePassword(new_password: string): Promise<void> {
  await fetchJson(`${API}/api/settings/account/password`, {
    method: "POST",
    body: JSON.stringify({ new_password }),
  });
}

export async function logoutAll(): Promise<void> {
  await fetchJson(`${API}/api/settings/account/logout-all`, { method: "POST" });
}

export function exportHistoryUrl(): string {
  return `${API}/api/settings/account/export`;
}

export async function deleteAccount(): Promise<void> {
  await fetchJson(`${API}/api/settings/account`, { method: "DELETE" });
}

export interface UserSession {
  id: string;
  created_at: string;
  updated_at: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  ip: string | null;
  not_after: string | null;
}

export async function getSessions(): Promise<{ sessions: UserSession[] }> {
  return fetchJson<{ sessions: UserSession[] }>(`${API}/api/settings/account/sessions`);
}

export async function revokeSession(id: string): Promise<void> {
  await fetchJson(`${API}/api/settings/account/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Notifications ──────────────────────────────────────────────────────────

export type NotificationType = "alert" | "warning" | "info" | "system" | "schedule" | "device";

export interface Notification {
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

export async function getNotifications(opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<Notification[]> {
  const p = new URLSearchParams();
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.unreadOnly) p.set("unread", "1");
  return fetchJson<Notification[]>(`${API}/api/notifications?${p}`);
}

export async function getUnreadCount(): Promise<number> {
  const { count } = await fetchJson<{ count: number }>(`${API}/api/notifications/unread-count`);
  return count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetchJson(`${API}/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchJson(`${API}/api/notifications/read-all`, { method: "PATCH" });
}

export async function deleteNotification(id: string): Promise<void> {
  await fetchJson(`${API}/api/notifications/${id}`, { method: "DELETE" });
}

export async function deleteReadNotifications(): Promise<void> {
  await fetchJson(`${API}/api/notifications/read`, { method: "DELETE" });
}
