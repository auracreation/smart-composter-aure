"use client";
import { useEffect, useState, useCallback } from "react";
import { useComposterStore } from "@/store/composterStore";
import { eventLabel } from "@/lib/eventLabel";
import { getEvents } from "@/lib/api";
import { EventEntry } from "@/lib/types";

function toLabel(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Events already covered by notifications — exclude from device activity log
const NOTIFICATION_EVENTS = new Set([
  "MANUAL_OVERRIDE_ON", "MANUAL_OVERRIDE_OFF",
  "PROCESS_STARTED", "PROCESS_STARTED_WEB",
  "PROCESS_STOPPED_BY_USER", "PROCESS_STOPPED_WEB",
  "PROCESS_FINISHED",
]);

function eventSeverity(code: string): "critical" | "warning" | "info" {
  if (code.includes("EMERGENCY") || code.includes("ERROR")) return "critical";
  if (code.includes("HIGH") || code.includes("SAFETY") || code.includes("WARNING") || code.includes("DISCONNECTED")) return "warning";
  return "info";
}

function fmtRelative(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000)   return "Baru saja";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} jam lalu`;
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

const severityStyle = {
  critical: { dot: "bg-red-500",    text: "text-red-600"    },
  warning:  { dot: "bg-orange-400", text: "text-orange-500" },
  info:     { dot: "bg-gray-300",   text: "text-gray-500"   },
};

export default function SystemStatus() {
  const { sensor, mode, phase, actuator, autoMode, lastEvent } = useComposterStore((s) => s.state);
  const deviceId = useComposterStore((s) => s.selectedDeviceId);

  const [events, setEvents]   = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const raw = await getEvents(30, deviceId);
      const filtered = raw
        .filter((e) => !NOTIFICATION_EVENTS.has(e.event))
        .slice(0, 5);
      setEvents(filtered);
    } catch {} finally { setLoading(false); }
  }, [deviceId]);

  // Refresh when live state changes (mode switch, new ESP32 event, etc.)
  useEffect(() => { fetchActivity(); }, [lastEvent, fetchActivity]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">Status Sistem</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-500 mb-1">Gas Raw</span>
          <span className="text-xl font-bold text-brand-text">
            {sensor.gasRaw}{" "}
            <span className="text-xs font-normal text-gray-400">/ 4095</span>
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-500 mb-1">Mode Sistem</span>
          <span className="text-lg font-bold text-brand-blue">{autoMode ? "Otomatis" : "Manual"}</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-500 mb-1">Fase Kompos</span>
          <span className="text-lg font-bold text-brand-orange">{toLabel(mode === "PROCESS" ? phase : mode)}</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-500 mb-1">Inlet Servo</span>
          <span className="text-lg font-bold text-brand-text">
            {actuator.servo === "CLOSE" ? "Tertutup" : actuator.servo === "HALF" ? "Setengah" : "Terbuka"}
          </span>
        </div>

        {/* Activity log */}
        <div className="col-span-2 bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktivitas Perangkat</span>
            {loading && <i className="fa-solid fa-spinner fa-spin text-gray-300 text-xs" />}
          </div>

          {events.length === 0 && !loading && (
            <p className="text-xs text-gray-400 italic">Belum ada aktivitas tercatat</p>
          )}

          <div className="space-y-2">
            {events.map((e, i) => {
              const sev = eventSeverity(e.event);
              const { dot, text } = severityStyle[sev];
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                  <span className={`text-xs flex-1 leading-snug ${sev === "info" ? "text-gray-600" : text} font-medium`}>
                    {eventLabel(e.event)}
                  </span>
                  <span className="text-[10px] text-gray-300 flex-shrink-0 tabular-nums">
                    {fmtRelative(e.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
