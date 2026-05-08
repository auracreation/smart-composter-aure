"use client";
import { useEffect, useRef, useState } from "react";
import { getHistory } from "@/lib/api";
import { HistoryEntry } from "@/lib/types";
import { useComposterStore } from "@/store/composterStore";
import { eventLabel } from "@/lib/eventLabel";

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  } catch { return "---"; }
}

const MODE_LABELS: Record<string, string> = {
  BOOT:     "Boot",
  STANDBY:  "Siaga",
  PROCESS:  "Proses",
  FINISHED: "Selesai",
  MANUAL:   "Manual",
  ERROR:    "Error",
};

function modeLabel(m: string) { return MODE_LABELS[m] ?? m; }
function phaseLabel(p: string) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }
function servoLabel(s: string) {
  if (s === "CLOSE") return "Tertutup";
  if (s === "HALF")  return "Setengah";
  if (s === "OPEN")  return "Terbuka";
  return s;
}

function Badge({ on }: { on: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${on ? "bg-green-500" : "bg-slate-300"}`} />
  );
}

function isOnline(last_seen: string | null) {
  return !!last_seen && Date.now() - new Date(last_seen).getTime() < 45_000;
}

const PAGE_SIZE = 100;

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);
  const devices = useComposterStore((s) => s.devices);
  const [filterDeviceId, setFilterDeviceId] = useState<string | null>(null);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [, setTick] = useState(0);
  const deviceRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (filterDeviceId === null && selectedDeviceId) {
      setFilterDeviceId(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deviceRef.current && !deviceRef.current.contains(e.target as Node)) {
        setDeviceOpen(false);
      }
    }
    if (deviceOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [deviceOpen]);

  function fetchData(deviceId: string | null, from?: string, to?: string) {
    if (!deviceId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const fromIso = from ? new Date(from).toISOString() : undefined;
    const toIso   = to   ? new Date(to).toISOString()   : undefined;
    getHistory(500, deviceId, fromIso, toIso)
      .then((data) => { setRows(data); setCurrentPage(1); })
      .catch(() => setError("Gagal memuat data. Pastikan backend berjalan."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData(filterDeviceId, appliedFrom || undefined, appliedTo || undefined);
  }, [filterDeviceId]);

  function applyDateFilter() {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    fetchData(filterDeviceId, fromDate || undefined, toDate || undefined);
  }

  function resetDateFilter() {
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");
    fetchData(filterDeviceId);
  }

  const hasActiveFilter = !!(appliedFrom || appliedTo);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeDevice = devices.find((d) => d.device_id === filterDeviceId);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Riwayat Telemetri</h1>
          <p className="text-gray-500 text-sm">Rekaman kondisi komposer setiap menit · Menampilkan hingga 500 data terbaru</p>
        </div>
        <div className="flex items-center gap-3">
          {devices.length > 1 && activeDevice && (
            <div className="relative" ref={deviceRef}>
              <button
                onClick={() => setDeviceOpen((v) => !v)}
                className="flex items-center gap-2 pl-3 pr-3 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                <i className="fa-solid fa-microchip text-brand-blue text-xs" />
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isOnline(activeDevice.last_seen) ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span className="max-w-[160px] truncate">{activeDevice?.name ?? "Pilih Perangkat"}</span>
                <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${deviceOpen ? "rotate-180" : ""}`} />
              </button>

              {deviceOpen && (
                <div className="absolute right-0 top-11 w-64 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Perangkat</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand-blue uppercase">
                      {devices.length} Tersedia
                    </span>
                  </div>
                  <div className="py-1">
                    {devices.map((d) => {
                      const isSelected = d.device_id === filterDeviceId;
                      const online = isOnline(d.last_seen);
                      return (
                        <button
                          key={d.device_id}
                          onClick={() => { setFilterDeviceId(d.device_id); setDeviceOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isSelected
                              ? "bg-brand-light text-brand-blue font-semibold"
                              : "text-gray-600 hover:bg-brand-gray"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative ${isSelected ? "bg-brand-blue/10" : "bg-gray-100"}`}>
                            <i className={`fa-solid fa-microchip text-xs ${isSelected ? "text-brand-blue" : "text-gray-400"}`} />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              online ? "bg-green-500" : "bg-gray-300"
                            }`} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <span className="block truncate">{d.name}</span>
                            <span className={`text-[10px] font-medium ${
                              online ? "text-green-600" : "text-gray-400"
                            }`}>
                              {online ? "Aktif" : "Tidak Aktif"}
                            </span>
                          </div>
                          {isSelected && <i className="fa-solid fa-check text-xs text-brand-blue flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {devices.length === 1 && activeDevice && (
            <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
              <i className="fa-solid fa-microchip text-brand-blue text-xs" />
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isOnline(activeDevice.last_seen) ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              {activeDevice.name}
            </span>
          )}
          <button
            onClick={() => fetchData(filterDeviceId, appliedFrom || undefined, appliedTo || undefined)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-brand-blue text-white text-sm font-semibold rounded-full shadow-md shadow-blue-200 hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Date range filter strip */}
      <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-card">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Dari</label>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-gray-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sampai</label>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-gray-700"
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <button
            onClick={applyDateFilter}
            disabled={loading || (!fromDate && !toDate)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-200 hover:bg-brand-dark transition-colors disabled:opacity-40"
          >
            <i className="fa-solid fa-filter text-xs" />
            Terapkan
          </button>
          {hasActiveFilter && (
            <button
              onClick={resetDateFilter}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              <i className="fa-solid fa-xmark text-xs" />
              Hapus Filter
            </button>
          )}
        </div>
        {hasActiveFilter && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-brand-blue bg-brand-light px-3 py-1.5 rounded-full">
            <i className="fa-solid fa-circle-check text-[10px]" />
            Filter aktif
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-300">
          <i className="fa-solid fa-spinner fa-spin text-4xl" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-brand-red border border-red-100">
          <i className="fa-solid fa-circle-exclamation" />
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-300">
          <i className="fa-solid fa-clock-rotate-left text-5xl" />
          <p className="text-gray-400 text-sm">Belum ada data tersimpan untuk perangkat ini.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl shadow-card border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                {["Waktu","Mode","Fase","Suhu Inti","Suhu Udara","Lembab","Tanah","Gas","Heater","Fan","Pump","Servo","Event"].map(h => (
                  <th key={h} className="px-3 py-3 whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r, i) => (
                <tr key={r.id} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-brand-light transition-colors`}>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-500" suppressHydrationWarning>{fmt(r.timestamp)}</td>
                  <td className="px-3 py-2 font-semibold text-brand-blue">{modeLabel(r.mode)}</td>
                  <td className="px-3 py-2 text-gray-600">{phaseLabel(r.phase)}</td>
                  <td className="px-3 py-2 tabular-nums text-brand-text">{r.sensor.coreTemp.toFixed(1)}°</td>
                  <td className="px-3 py-2 tabular-nums text-brand-text">{r.sensor.airTempAvg.toFixed(1)}°</td>
                  <td className="px-3 py-2 tabular-nums text-brand-text">{r.sensor.airHumidityAvg.toFixed(1)}%</td>
                  <td className="px-3 py-2 tabular-nums text-brand-text">{r.sensor.soilPercent.toFixed(1)}%</td>
                  <td className="px-3 py-2 tabular-nums text-brand-text">{r.sensor.gasRaw}</td>
                  <td className="px-3 py-2 text-center"><Badge on={r.actuator.heater} /></td>
                  <td className="px-3 py-2 text-center"><Badge on={r.actuator.fan} /></td>
                  <td className="px-3 py-2 text-center"><Badge on={r.actuator.pump} /></td>
                  <td className="px-3 py-2 text-gray-600">{servoLabel(r.actuator.servo)}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={r.lastEvent}>{eventLabel(r.lastEvent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            Menampilkan <span className="font-semibold text-gray-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)}</span> dari <span className="font-semibold text-gray-600">{rows.length}</span> entri
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-full text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  p === currentPage
                    ? "bg-brand-blue text-white shadow-sm shadow-blue-200"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-full text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
