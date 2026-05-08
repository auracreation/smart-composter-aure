"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  listSchedules, createSchedule, updateSchedule, deleteSchedule, runScheduleNow,
  getDevices, getState, Schedule, ScheduleInput, DeviceRow, Recurrence, ScheduleAction,
} from "@/lib/api";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function fmtNextRun(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Segera";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) {
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  }
  if (h > 0) return `${h}j ${m}m lagi`;
  return `${m}m lagi`;
}

function recurrenceLabel(s: Schedule): string {
  if (s.recurrence === "once") return "Sekali";
  if (s.recurrence === "daily") return "Setiap hari";
  if (s.recurrence === "weekly" && s.days_of_week.length > 0) {
    return s.days_of_week.map((d) => DAY_LABELS[d]).join("·");
  }
  return "Mingguan";
}

type ChipColor = "orange" | "blue" | "green" | "gray" | "purple";
const chipClass: Record<ChipColor, string> = {
  orange: "bg-orange-100 text-orange-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  gray: "bg-gray-100 text-gray-500",
  purple: "bg-purple-100 text-purple-700",
};

function actionChips(action: ScheduleAction): { label: string; color: ChipColor }[] {
  const chips: { label: string; color: ChipColor }[] = [];
  if (action.heater === true) chips.push({ label: "Pemanas ON", color: "orange" });
  if (action.heater === false) chips.push({ label: "Pemanas OFF", color: "gray" });
  if (action.fan === true) chips.push({ label: "Kipas ON", color: "blue" });
  if (action.fan === false) chips.push({ label: "Kipas OFF", color: "gray" });
  if (action.pump === true) chips.push({ label: "Pompa ON", color: "green" });
  if (action.pump === false) chips.push({ label: "Pompa OFF", color: "gray" });
  if (action.servo) chips.push({ label: `Servo ${action.servo}`, color: "purple" });
  return chips;
}

interface FormState {
  name: string;
  device_id: string;
  start_time: string;
  recurrence: Recurrence;
  days_of_week: number[];
  run_date: string;
  heater: boolean | null;
  fan: boolean | null;
  pump: boolean | null;
  servo: "OPEN" | "HALF" | "CLOSE" | "";
  duration_min: string;
}

const defaultForm: FormState = {
  name: "", device_id: "", start_time: "06:00",
  recurrence: "daily", days_of_week: [], run_date: "",
  heater: null, fan: null, pump: null, servo: "", duration_min: "",
};

function buildAction(form: FormState): ScheduleAction {
  const a: ScheduleAction = {};
  if (form.heater !== null) a.heater = form.heater;
  if (form.fan !== null) a.fan = form.fan;
  if (form.pump !== null) a.pump = form.pump;
  if (form.servo) a.servo = form.servo;
  return a;
}

function TriState({ label, value, onChange }: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-brand-text w-20 flex-shrink-0">{label}</span>
      <div className="flex gap-1">
        {([true, false, null] as const).map((v) => (
          <button key={String(v)} type="button" onClick={() => onChange(v === value ? null : v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              v === value
                ? v === true ? "bg-brand-blue text-white" : v === false ? "bg-gray-500 text-white" : "bg-gray-200 text-gray-500"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}>
            {v === null ? "—" : v ? "ON" : "OFF"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [deviceModes, setDeviceModes] = useState<Record<string, boolean>>({});
  const [modesLoaded, setModesLoaded] = useState(false);

  useEffect(() => {
    fetchAll();
    getDevices().then((devs) => {
      setDevices(devs);
      if (devs.length === 0) { setModesLoaded(true); return; }
      Promise.all(
        devs.map((d) =>
          getState(d.device_id)
            .then((s) => ({ id: d.device_id, autoMode: s.autoMode }))
            .catch(() => ({ id: d.device_id, autoMode: true }))
        )
      ).then((results) => {
        const modes: Record<string, boolean> = {};
        results.forEach((r) => { modes[r.id] = r.autoMode; });
        setDeviceModes(modes);
        setModesLoaded(true);
      });
    }).catch(() => { setModesLoaded(true); });
  }, []);

  const isLocked =
    modesLoaded &&
    devices.length > 0 &&
    Object.values(deviceModes).every((m) => m === true);

  const manualDeviceCount = Object.values(deviceModes).filter((m) => m === false).length;

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await listSchedules());
    } catch {
      setError("Gagal memuat jadwal. Pastikan backend berjalan.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...defaultForm, device_id: devices[0]?.device_id ?? "" });
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(s: Schedule) {
    const a = s.action;
    setEditingId(s.id);
    setForm({
      name: s.name, device_id: s.device_id,
      start_time: s.start_time.slice(0, 5), recurrence: s.recurrence,
      days_of_week: s.days_of_week ?? [], run_date: s.run_date ?? "",
      heater: a.heater ?? null, fan: a.fan ?? null, pump: a.pump ?? null,
      servo: a.servo ?? "",
      duration_min: s.duration_sec ? String(Math.round(s.duration_sec / 60)) : "",
    });
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const action = buildAction(form);
    if (Object.keys(action).length === 0) { setSaveError("Pilih minimal satu aksi aktuator."); return; }
    if (form.recurrence === "weekly" && form.days_of_week.length === 0) { setSaveError("Pilih minimal satu hari."); return; }
    if (form.recurrence === "once") {
      const scheduled = new Date(`${form.run_date}T${form.start_time}:00`);
      if (!form.run_date || scheduled <= new Date()) {
        setSaveError("Tanggal dan waktu jadwal harus di masa mendatang.");
        return;
      }
    }
    setSaving(true); setSaveError(null);
    const payload: ScheduleInput = {
      device_id: form.device_id, name: form.name, action,
      duration_sec: form.duration_min ? Math.round(parseFloat(form.duration_min) * 60) : null,
      start_time: form.start_time, recurrence: form.recurrence,
      days_of_week: form.recurrence === "weekly" ? form.days_of_week : [],
      run_date: form.recurrence === "once" ? form.run_date : null,
      enabled: true,
    };
    try {
      if (editingId) {
        const updated = await updateSchedule(editingId, payload);
        setSchedules((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
      } else {
        const created = await createSchedule(payload);
        setSchedules((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally { setSaving(false); }
  }

  async function handleToggle(s: Schedule) {
    setTogglingId(s.id);
    try {
      const updated = await updateSchedule(s.id, { enabled: !s.enabled });
      setSchedules((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
    } catch {}
    setTogglingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch {}
    setDeletingId(null);
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    try { await runScheduleNow(id); await fetchAll(); } catch {}
    setRunningId(null);
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d],
    }));
  }

  const enabled = schedules.filter((s) => s.enabled);
  const now = Date.now();
  const upcoming = schedules.filter(
    (s) => s.enabled && s.next_run_at &&
      new Date(s.next_run_at).getTime() > now &&
      new Date(s.next_run_at).getTime() - now < 86_400_000,
  ).sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime());
  const nearest = [...schedules]
    .filter((s) => s.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0];

  function ScheduleCard({ s }: { s: Schedule }) {
    const chips = actionChips(s.action);
    const isConfirmDelete = confirmDeleteId === s.id;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.enabled ? "bg-brand-light" : "bg-gray-100"}`}>
              <i className={`fa-solid fa-calendar-check text-sm ${s.enabled ? "text-brand-blue" : "text-gray-400"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
              <p className="text-xs text-gray-400">
                {fmtTime(s.start_time)} · <span className="font-medium">{recurrenceLabel(s)}</span>
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
            {s.enabled ? "Aktif" : "Nonaktif"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c, i) => (
            <span key={i} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${chipClass[c.color]}`}>{c.label}</span>
          ))}
          {s.duration_sec && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {Math.round(s.duration_sec / 60)}m
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>Berikutnya: <span className="font-semibold text-gray-600">{fmtNextRun(s.next_run_at)}</span></span>
          {s.last_run_at && (
            <span>{new Date(s.last_run_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</span>
          )}
        </div>

        {isConfirmDelete ? (
          <div className="border-t border-gray-100 pt-3 mt-auto">
            <p className="text-xs text-gray-500 mb-2 text-center">
              Hapus <span className="font-bold text-gray-700">{s.name}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                className="flex-1 py-1.5 bg-brand-red hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-opacity disabled:opacity-50">
                {deletingId === s.id ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 border-t border-gray-100 pt-3 mt-auto">
            <button onClick={() => handleRunNow(s.id)} disabled={runningId === s.id} title="Jalankan sekarang"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 flex-shrink-0">
              {runningId === s.id ? <i className="fa-solid fa-spinner fa-spin text-xs" /> : <i className="fa-solid fa-play text-xs" />}
            </button>
            <button onClick={() => openEdit(s)} title="Edit"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-light text-brand-blue hover:bg-brand-blue/10 transition-colors flex-shrink-0">
              <i className="fa-solid fa-pen text-xs" />
            </button>
            <button onClick={() => handleToggle(s)} disabled={togglingId === s.id} title={s.enabled ? "Nonaktifkan" : "Aktifkan"}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-50 flex-shrink-0">
              {togglingId === s.id ? <i className="fa-solid fa-spinner fa-spin text-xs" /> : <i className={`fa-solid ${s.enabled ? "fa-pause" : "fa-bolt"} text-xs`} />}
            </button>
            <button onClick={() => setConfirmDeleteId(s.id)} title="Hapus"
              className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-brand-red transition-colors flex-shrink-0">
              <i className="fa-solid fa-trash-can text-xs" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Lock Overlay — shown while loading OR when all devices are auto */}
      {(!modesLoaded || isLocked) && (
        <div className="absolute inset-0 z-40 rounded-[2rem] flex items-center justify-center p-6"
          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.55)" }}>
          {!modesLoaded ? (
            <i className="fa-solid fa-spinner fa-spin text-3xl text-gray-300" />
          ) : (
            <div className="bg-white rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] p-8 max-w-sm w-full flex flex-col items-center gap-5 border border-gray-100">
              <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center">
                <i className="fa-solid fa-lock text-3xl text-gray-400" />
              </div>
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-bold text-gray-800">Jadwal Terkunci</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Jadwal otomatis hanya tersedia saat setidaknya satu perangkat berada dalam
                  <span className="font-semibold text-gray-700"> mode Manual</span>.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Saat ini semua perangkat berjalan dalam mode Otomatis.
                </p>
              </div>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-sliders" />
                Ubah Mode Perangkat
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Jadwal Otomatis</h1>
          <p className="text-gray-500 text-sm">Atur jadwal aktuator secara otomatis.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isLocked && manualDeviceCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              <i className="fa-solid fa-lock-open text-[10px]" />
              {manualDeviceCount} perangkat manual
            </span>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-brand-blue hover:bg-brand-dark text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-md shadow-blue-200 transition-colors">
            <i className="fa-solid fa-plus" />
            Tambah Jadwal
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: "fa-bolt", label: "Jadwal Aktif", value: String(enabled.length), bg: "bg-brand-light", color: "text-brand-blue" },
          { icon: "fa-clock", label: "Jadwal Mendatang", value: String(upcoming.length), bg: "bg-orange-50", color: "text-brand-orange" },
          { icon: "fa-calendar", label: "Total Jadwal", value: String(schedules.length), bg: "bg-gray-100", color: "text-gray-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fa-solid ${stat.icon} text-lg ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-[30vh] text-gray-300">
          <i className="fa-solid fa-spinner fa-spin text-4xl" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-brand-red border border-red-100 mb-6">
          <i className="fa-solid fa-circle-exclamation" /> {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center">
            <i className="fa-solid fa-calendar-plus text-4xl text-brand-blue" />
          </div>
          <p className="text-gray-700 font-semibold">Belum ada jadwal</p>
          <p className="text-gray-400 text-sm">Tambahkan jadwal pertama Anda untuk memulai otomasi.</p>
          <button onClick={openAdd}
            className="mt-2 bg-brand-blue text-white px-5 py-2 rounded-full text-sm font-semibold shadow-md shadow-blue-200 hover:bg-brand-dark transition-colors">
            + Tambah Jadwal
          </button>
        </div>
      )}

      {/* Upcoming 24h */}
      {!loading && upcoming.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Dalam 24 Jam ke Depan</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {upcoming.map((s) => <ScheduleCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Active schedules */}
      {!loading && enabled.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Jadwal Aktif ({enabled.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {enabled.map((s) => <ScheduleCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* All schedules (collapsible) */}
      {!loading && schedules.length > 0 && (
        <div>
          <button onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 hover:text-gray-600 transition-colors">
            <i className={`fa-solid fa-chevron-${showAll ? "up" : "down"} text-[10px]`} />
            Semua Jadwal ({schedules.length})
          </button>
          {showAll && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {schedules.map((s) => <ScheduleCard key={s.id} s={s} />)}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] w-full max-w-lg flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center">
                  <i className="fa-solid fa-calendar-plus text-brand-blue text-sm" />
                </div>
                <h2 className="text-base font-bold text-gray-800">
                  {editingId ? "Edit Jadwal" : "Tambah Jadwal Baru"}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            {/* Modal body */}
            <form id="schedule-form" onSubmit={handleSave} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Nama */}
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">Nama Jadwal</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="cth: Siram Pagi"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
              </div>

              {/* Device (only shown if more than 1) */}
              {devices.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1.5">Perangkat</label>
                  <select value={form.device_id} onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all">
                    {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {/* Waktu + Pengulangan */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1.5">Waktu Mulai</label>
                  <input type="time" required value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1.5">Pengulangan</label>
                  <select value={form.recurrence}
                    onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Recurrence }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all">
                    <option value="once">Sekali</option>
                    <option value="daily">Setiap Hari</option>
                    <option value="weekly">Mingguan</option>
                  </select>
                </div>
              </div>

              {form.recurrence === "once" && (
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-1.5">Tanggal</label>
                  <input type="date" required value={form.run_date}
                    min={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}
                    onChange={(e) => setForm((f) => ({ ...f, run_date: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
                </div>
              )}

              {form.recurrence === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-brand-text mb-2">Hari</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                          form.days_of_week.includes(i)
                            ? "bg-brand-blue text-white shadow-sm"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Aktuator */}
              <div>
                <p className="text-sm font-medium text-brand-text mb-3">Aksi Aktuator</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                  <TriState label="Pemanas" value={form.heater} onChange={(v) => setForm((f) => ({ ...f, heater: v }))} />
                  <TriState label="Kipas" value={form.fan} onChange={(v) => setForm((f) => ({ ...f, fan: v }))} />
                  <TriState label="Pompa" value={form.pump} onChange={(v) => setForm((f) => ({ ...f, pump: v }))} />
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-brand-text w-20 flex-shrink-0">Servo</span>
                    <div className="flex gap-1">
                      {(["OPEN", "HALF", "CLOSE", ""] as const).map((v) => (
                        <button key={String(v)} type="button"
                          onClick={() => setForm((f) => ({ ...f, servo: v }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            form.servo === v ? "bg-brand-blue text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}>
                          {v || "—"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Durasi */}
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  Durasi <span className="text-gray-400 font-normal">(menit, opsional)</span>
                </label>
                <input type="number" min="1" step="1" value={form.duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                  placeholder="Biarkan kosong jika tanpa batas waktu"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
              </div>

              {saveError && (
                <p className="text-xs text-brand-red flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation" /> {saveError}
                </p>
              )}
            </form>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button type="submit" form="schedule-form" disabled={saving}
                className="flex-1 py-2.5 bg-brand-blue hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />Menyimpan...</>
                  : editingId ? "Simpan Perubahan" : "Tambahkan Jadwal"}
              </button>
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
