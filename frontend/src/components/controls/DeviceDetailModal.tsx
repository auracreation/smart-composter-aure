"use client";
import { useState } from "react";
import {
  getCalibration, saveCalibration, removeDevice,
  DeviceRow, CalibrationData,
} from "@/lib/api";

interface CalibrationDraft {
  tempCoreOffset: string;
  tempAirOffset: string;
  humidityOffset: string;
  soilMin: string;
  soilMax: string;
  gasThreshold: string;
}

const defaultCalib: CalibrationDraft = {
  tempCoreOffset: "0",
  tempAirOffset: "0",
  humidityOffset: "0",
  soilMin: "1300",
  soilMax: "3200",
  gasThreshold: "2200",
};

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

interface Props {
  device: DeviceRow;
  onClose: () => void;
  onRemoved?: (deviceId: string) => void;
}

export default function DeviceDetailModal({ device, onClose, onRemoved }: Props) {
  const [calib, setCalib] = useState<CalibrationDraft>(defaultCalib);
  const [calibStep, setCalibStep] = useState<"idle" | "confirming" | "unlocked">("idle");
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibSaving, setCalibSaving] = useState(false);
  const [calibSaved, setCalibSaved] = useState(false);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function unlockCalib(deviceId: string) {
    setCalibStep("unlocked");
    setCalibLoading(true);
    setCalibError(null);
    try {
      const data = await getCalibration(deviceId);
      setCalib({
        tempCoreOffset: String(data.tempCoreOffset ?? 0),
        tempAirOffset: String(data.tempAirOffset ?? 0),
        humidityOffset: String(data.humidityOffset ?? 0),
        soilMin: String(data.soilMin ?? 1300),
        soilMax: String(data.soilMax ?? 3200),
        gasThreshold: String(data.gasThreshold ?? 2200),
      });
    } catch {
      setCalibStep("confirming");
      setCalibError("Gagal memuat kalibrasi. Periksa koneksi dan coba lagi.");
    } finally {
      setCalibLoading(false);
    }
  }

  async function handleSaveCalib(deviceId: string) {
    setCalibSaving(true);
    setCalibError(null);
    setCalibSaved(false);
    const payload: CalibrationData = {
      tempCoreOffset: parseFloat(parseFloat(calib.tempCoreOffset).toFixed(1)) || 0,
      tempAirOffset: parseFloat(parseFloat(calib.tempAirOffset).toFixed(1)) || 0,
      humidityOffset: parseFloat(parseFloat(calib.humidityOffset).toFixed(1)) || 0,
      soilMin: Math.round(parseFloat(calib.soilMin)) || 0,
      soilMax: Math.round(parseFloat(calib.soilMax)) || 4095,
      gasThreshold: Math.round(parseFloat(calib.gasThreshold)) || 2000,
    };
    try {
      await saveCalibration(deviceId, payload);
      setCalibSaved(true);
      setTimeout(() => setCalibSaved(false), 2500);
    } catch {
      setCalibError("Gagal menyimpan. Coba lagi.");
    } finally {
      setCalibSaving(false);
    }
  }

  async function handleRemove(deviceId: string) {
    setRemoving(true);
    try {
      await removeDevice(deviceId);
      onRemoved?.(deviceId);
      onClose();
    } catch {
      setRemoving(false);
    }
  }

  function CalibField({ label, unit, field, step = "any" }: { label: string; unit: string; field: keyof CalibrationDraft; step?: string }) {
    return (
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm text-gray-600 flex-1">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step={step}
            value={calib[field]}
            onChange={(e) => setCalib((p) => ({ ...p, [field]: e.target.value }))}
            className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
          />
          <span className="text-xs text-gray-400 w-8">{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-microchip text-brand-blue text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{device.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isActive(device.last_seen) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
              }`}>
                {isActive(device.last_seen) ? "● Aktif" : "● Tidak Aktif"}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Section: Informasi Perangkat */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Informasi Perangkat</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Device ID</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <code className="flex-1 text-xs font-mono text-gray-600 break-all">{device.device_id}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(device.device_id)}
                    className="text-gray-400 hover:text-brand-blue transition-colors flex-shrink-0"
                    title="Salin"
                  >
                    <i className="fa-regular fa-copy text-sm" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-gray-400 mb-0.5">Didaftarkan</p>
                  <p className="font-semibold text-gray-700">{fmtDate(device.created_at)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-gray-400 mb-0.5">Terakhir aktif</p>
                  <p className="font-semibold text-gray-700">{fmtDate(device.last_seen)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Kalibrasi Sensor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pengaturan Sensor</p>
              </div>
              {calibStep === "idle" && (
                <button
                  onClick={() => setCalibStep("confirming")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:text-brand-dark transition-colors"
                >
                  <i className="fa-solid fa-sliders text-[11px]" />
                  Ubah nilai
                </button>
              )}
              {calibStep === "unlocked" && (
                <button
                  onClick={() => setCalibStep("idle")}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fa-solid fa-chevron-up text-[10px]" /> Tutup
                </button>
              )}
              {calibStep === "confirming" && (
                <button
                  onClick={() => setCalibStep("idle")}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-[11px]" />
                </button>
              )}
            </div>

            {/* Step: confirmation banner */}
            <div className={`grid transition-all duration-300 ease-in-out ${
              calibStep === "confirming" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}>
              <div className="overflow-hidden">
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-3">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[11px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 mb-0.5">Konfirmasi Perubahan Kalibrasi</p>
                      {calibError ? (
                        <p className="text-[11px] text-brand-red leading-relaxed flex items-center gap-1">
                          <i className="fa-solid fa-circle-exclamation flex-shrink-0" />
                          {calibError}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Nilai kalibrasi berdampak langsung pada akurasi pembacaan sensor.
                          Pastikan nilai yang dimasukkan sudah terverifikasi.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pl-10">
                    <button
                      onClick={() => unlockCalib(device.device_id)}
                      className="flex-1 py-1.5 bg-brand-blue hover:bg-brand-dark text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Tampilkan Pengaturan
                    </button>
                    <button
                      onClick={() => setCalibStep("idle")}
                      className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step: fields slide down */}
            <div className={`grid transition-all duration-500 ease-in-out ${
              calibStep === "unlocked" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}>
              <div className="overflow-hidden">
                {calibLoading ? (
                  <div className="flex items-center justify-center py-6 text-gray-300">
                    <i className="fa-solid fa-spinner fa-spin text-2xl" />
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 mb-3">
                      <CalibField label="Offset Suhu Inti" unit="°C" field="tempCoreOffset" step="0.1" />
                      <CalibField label="Offset Suhu Udara" unit="°C" field="tempAirOffset" step="0.1" />
                      <CalibField label="Offset Kelembaban" unit="%" field="humidityOffset" step="0.1" />
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Sensor Tanah</p>
                        <CalibField label="Nilai Raw Min (basah)" unit="raw" field="soilMin" step="1" />
                        <div className="mt-2">
                          <CalibField label="Nilai Raw Max (kering)" unit="raw" field="soilMax" step="1" />
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-3">
                        <CalibField label="Ambang Gas (threshold)" unit="raw" field="gasThreshold" step="1" />
                      </div>
                    </div>
                    {calibError && (
                      <p className="text-[11px] text-brand-red flex items-center gap-1 mb-2">
                        <i className="fa-solid fa-circle-exclamation" /> {calibError}
                      </p>
                    )}
                    <button
                      onClick={() => handleSaveCalib(device.device_id)}
                      disabled={calibSaving}
                      className={`w-full py-2 text-xs font-semibold rounded-xl transition-all ${
                        calibSaved
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-brand-blue hover:bg-brand-dark text-white disabled:opacity-50"
                      }`}
                    >
                      {calibSaving ? (
                        <><i className="fa-solid fa-spinner fa-spin mr-1.5" />Menyimpan...</>
                      ) : calibSaved ? (
                        <><i className="fa-solid fa-check mr-1.5" />Tersimpan</>
                      ) : (
                        <><i className="fa-solid fa-floppy-disk mr-1.5" />Simpan Kalibrasi</>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal footer: delete */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 text-center mb-1">
                Yakin hapus perangkat <span className="font-bold text-gray-700">{device.name}</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRemove(device.device_id)}
                  disabled={removing}
                  className="flex-1 py-2.5 bg-brand-red hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50"
                >
                  {removing ? "Menghapus..." : "Ya, Hapus Perangkat"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 border border-red-200 text-brand-red text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-trash-can" />
              Hapus Perangkat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
