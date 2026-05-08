"use client";
import { useEffect, useState } from "react";
import {
  getDevices, addDevice,
  DeviceRow, NewDeviceResult,
} from "@/lib/api";
import DeviceDetailModal from "@/components/controls/DeviceDetailModal";

function fmtDate(iso: string | null) {
  if (!iso) return "Belum pernah";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  } catch { return iso; }
}

function isActive(last_seen: string | null) {
  return !!last_seen && Date.now() - new Date(last_seen).getTime() < 45_000;
}

export default function ControlsPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState<NewDeviceResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);

  useEffect(() => {
    fetchDevices();
    const poll = setInterval(() => {
      getDevices().then(setDevices).catch(() => {});
    }, 30_000);
    return () => clearInterval(poll);
  }, []);

  async function fetchDevices() {
    setLoading(true);
    setError(null);
    try {
      setDevices(await getDevices());
    } catch {
      setError("Gagal memuat perangkat. Pastikan backend berjalan.");
    } finally {
      setLoading(false);
    }
  }

  function openDetail(d: DeviceRow) {
    setSelectedDevice(d);
  }

  function closeDetail() {
    setSelectedDevice(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await addDevice(addName.trim());
      setNewDevice(result);
      setAddName("");
      setShowAdd(false);
      await fetchDevices();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Gagal menambahkan perangkat.");
    } finally {
      setAdding(false);
    }
  }

  function copyApiKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Perangkat Terdaftar</h1>
          <p className="text-gray-500 text-sm">Kelola ESP32 yang terhubung ke akun Anda.</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError(null); setAddName(""); }}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-dark text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-md shadow-blue-200 transition-colors"
        >
          <i className="fa-solid fa-plus" />
          Tambah Perangkat
        </button>
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
          <i className="fa-solid fa-circle-exclamation" />
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-20 h-20 rounded-full bg-brand-gray flex items-center justify-center">
            <i className="fa-solid fa-microchip text-4xl text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">Belum ada perangkat terdaftar.</p>
        </div>
      )}

      {/* Device grid */}
      {!loading && devices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => openDetail(d)}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card flex flex-col gap-3 text-left hover:border-brand-blue/30 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0 group-hover:bg-brand-blue/10 transition-colors">
                    <i className="fa-solid fa-microchip text-brand-blue" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{d.device_id}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  isActive(d.last_seen) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}>
                  {isActive(d.last_seen) ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Didaftarkan</span>
                  <span className="font-medium text-gray-700">{fmtDate(d.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terakhir aktif</span>
                  <span className="font-medium text-gray-700">{fmtDate(d.last_seen)}</span>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs text-brand-blue font-semibold gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat detail <i className="fa-solid fa-arrow-right text-[10px]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Device Detail Modal ── */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={closeDetail}
          onRemoved={(removedId) => {
            setDevices((prev) => prev.filter((d) => d.device_id !== removedId));
          }}
        />
      )}

      {/* ── Add Device Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Tambah Perangkat Baru</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">Nama Perangkat</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="cth: Komposter Kebun Belakang"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-brand-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                />
              </div>
              {addError && (
                <p className="text-xs text-brand-red flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation" /> {addError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2.5 bg-brand-blue hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {adding ? "Mendaftarkan..." : "Tambahkan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 bg-brand-gray text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New Device API Key Reveal ── */}
      {newDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-gray-800">Perangkat Terdaftar</h2>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
                  Berhasil
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Perangkat <span className="font-semibold text-gray-600">{newDevice.name}</span> telah terdaftar dan terhubung ke akun Anda.
              </p>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Device ID */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Device ID</p>
                <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <code className="text-xs font-mono text-gray-600 break-all">{newDevice.device_id}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(newDevice.device_id)}
                    className="text-gray-400 hover:text-brand-blue transition-colors flex-shrink-0"
                    title="Salin Device ID"
                  >
                    <i className="fa-regular fa-copy text-sm" />
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Key</p>
                  <span className="text-[10px] text-brand-red font-semibold flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation" />
                    Hanya ditampilkan sekali
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <code className="flex-1 text-xs font-mono text-gray-700 break-all">{newDevice.api_key}</code>
                  <button
                    onClick={() => copyApiKey(newDevice.api_key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all border ${
                      copied
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-brand-blue border-gray-200 hover:border-brand-blue"
                    }`}
                  >
                    <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} />
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  API Key ini tidak akan ditampilkan kembali setelah jendela ini ditutup.
                  Salin dan simpan di file konfigurasi firmware ESP32 Anda sebelum melanjutkan.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setNewDevice(null)}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
