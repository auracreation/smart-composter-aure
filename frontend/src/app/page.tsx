"use client";
import { useEffect, useRef, useState } from "react";
import { useComposterStore } from "@/store/composterStore";
import MetricGauge from "@/components/dashboard/MetricGauge";
import SystemStatus from "@/components/dashboard/SystemStatus";
import ActuatorStatus from "@/components/dashboard/ActuatorStatus";
import ManualControl from "@/components/dashboard/ManualControl";
import SystemPower from "@/components/dashboard/SystemPower";
import DeviceDetailModal from "@/components/controls/DeviceDetailModal";

type BadgeTone = "blue" | "orange" | "green" | "red" | "gray";

function badgeCoreTemp(v: number): { label: string; tone: BadgeTone } {
  if (v < 35) return { label: "Rendah", tone: "gray" };
  if (v < 55) return { label: "Aktif", tone: "blue" };
  if (v < 70) return { label: "Optimal", tone: "green" };
  return { label: "Terlalu Panas", tone: "red" };
}

function badgeAirTemp(v: number): { label: string; tone: BadgeTone } {
  if (v < 20) return { label: "Dingin", tone: "gray" };
  if (v < 30) return { label: "Normal", tone: "blue" };
  if (v < 40) return { label: "Hangat", tone: "orange" };
  return { label: "Panas", tone: "red" };
}

function badgeHumidity(v: number): { label: string; tone: BadgeTone } {
  if (v < 30) return { label: "Kering", tone: "red" };
  if (v < 60) return { label: "Normal", tone: "blue" };
  if (v < 80) return { label: "Optimal", tone: "green" };
  return { label: "Lembab", tone: "orange" };
}

function badgeSoil(v: number): { label: string; tone: BadgeTone } {
  if (v < 40) return { label: "Kering", tone: "gray" };
  if (v < 60) return { label: "Optimal", tone: "green" };
  if (v < 80) return { label: "Basah", tone: "orange" };
  return { label: "Jenuh", tone: "red" };
}

function isOnline(last_seen: string | null) {
  return !!last_seen && Date.now() - new Date(last_seen).getTime() < 45_000;
}

export default function DashboardPage() {
  const sensor = useComposterStore((s) => s.state.sensor);
  const wifi = useComposterStore((s) => s.state.wifi);
  const connected = useComposterStore((s) => s.connected);
  const esp32Offline = !connected || wifi !== "ONLINE";
  const devices = useComposterStore((s) => s.devices);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);
  const setSelectedDeviceId = useComposterStore((s) => s.setSelectedDeviceId);

  const [deviceOpen, setDeviceOpen] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [, setTick] = useState(0);
  const deviceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deviceRef.current && !deviceRef.current.contains(e.target as Node)) {
        setDeviceOpen(false);
      }
    }
    if (deviceOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [deviceOpen]);

  const activeDevice = devices.find((d) => d.device_id === selectedDeviceId);

  return (
    <>
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Selamat Datang!</h1>
          <p className="text-gray-500 text-sm">Berikut adalah ringkasan sistem pemantauan Anda hari ini.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
                <span className="max-w-[160px] truncate">{activeDevice.name}</span>
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
                      const isSelected = d.device_id === selectedDeviceId;
                      const online = isOnline(d.last_seen);
                      return (
                        <button
                          key={d.device_id}
                          onClick={() => { setSelectedDeviceId(d.device_id); setDeviceOpen(false); }}
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
            <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full shadow-sm">
              <i className="fa-solid fa-microchip text-brand-blue text-xs" />
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isOnline(activeDevice.last_seen) ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              {activeDevice.name}
            </span>
          )}
          {activeDevice && (
            <button
              onClick={() => setShowDeviceModal(true)}
              className="bg-brand-blue text-white px-6 py-2 rounded-full text-sm font-medium shadow-md shadow-blue-200 hover:bg-brand-dark transition-colors"
            >
              Pengaturan
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricGauge
          label="Suhu Inti"
          value={sensor.coreTemp}
          unit="°C"
          min={0}
          max={100}
          accent="blue"
          icon="fa-temperature-half"
          badge={badgeCoreTemp(sensor.coreTemp)}
          decimals={1}
          offline={esp32Offline}
        />
        <MetricGauge
          label="Suhu Udara"
          value={sensor.airTempAvg}
          unit="°C"
          min={0}
          max={100}
          accent="orange"
          icon="fa-temperature-three-quarters"
          badge={badgeAirTemp(sensor.airTempAvg)}
          decimals={1}
          offline={esp32Offline}
        />
        <MetricGauge
          label="Kelembaban"
          value={sensor.airHumidityAvg}
          unit="%"
          min={0}
          max={100}
          accent="green"
          icon="fa-droplet"
          badge={badgeHumidity(sensor.airHumidityAvg)}
          offline={esp32Offline}
        />
        <MetricGauge
          label="Kelembaban Tanah"
          value={sensor.soilPercent}
          unit="%"
          min={0}
          max={100}
          accent="blue"
          icon="fa-leaf"
          badge={badgeSoil(sensor.soilPercent)}
          offline={esp32Offline}
        />
      </div>

      {/* Status + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SystemStatus />
        <div className="flex flex-col gap-6">
          <ActuatorStatus />
          <SystemPower />
          <ManualControl />
        </div>
      </div>

      {/* Device Detail Modal */}
      {showDeviceModal && activeDevice && (
        <DeviceDetailModal
          device={activeDevice}
          onClose={() => setShowDeviceModal(false)}
          onRemoved={(removedId) => {
            const remaining = devices.filter((d) => d.device_id !== removedId);
            setSelectedDeviceId(remaining.length > 0 ? remaining[0].device_id : null);
          }}
        />
      )}
    </>
  );
}
