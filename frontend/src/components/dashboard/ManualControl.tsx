"use client";
import { useState, useCallback } from "react";
import { useComposterStore } from "@/store/composterStore";
import { setMode, setActuator } from "@/lib/api";
import { ServoState } from "@/lib/types";
import LoadingOverlay from "@/components/ui/LoadingOverlay";

type RequestStatus = "idle" | "loading" | "success" | "error";

export default function ManualControl() {
  const state = useComposterStore((s) => s.state);
  const setState = useComposterStore((s) => s.setState);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);
  const { autoMode, actuator } = state;
  const cmdActuator = state.cmdActuator ?? actuator;
  const [reqStatus, setReqStatus] = useState<RequestStatus>("idle");

  const isOutOfSync = (key: "heater" | "fan" | "pump") =>
    !autoMode && actuator[key] !== cmdActuator[key];
  const isServoOutOfSync = !autoMode && actuator.servo !== cmdActuator.servo;

  const withLoading = useCallback(async (
    fn: () => Promise<void>,
    onError?: () => void
  ) => {
    if (reqStatus === "loading") return;
    setReqStatus("loading");
    const minDelay = new Promise<void>((r) => setTimeout(r, 700));
    let failed = false;
    try {
      await Promise.all([fn(), minDelay]);
    } catch {
      failed = true;
      onError?.();
    }
    setReqStatus(failed ? "error" : "success");
    setTimeout(() => setReqStatus("idle"), 1200);
  }, [reqStatus]);

  const handleModeToggle = (auto: boolean) => {
    const prev = { ...state };
    setState({
      ...state,
      autoMode: auto,
      mode: auto ? (state.mode === "MANUAL" ? "STANDBY" : state.mode) : "MANUAL",
      cmdActuator: auto ? (state.cmdActuator ?? state.actuator) : { ...state.actuator },
    });
    withLoading(() => setMode(auto, selectedDeviceId ?? ""), () => setState(prev));
  };

  const handleToggle = (key: "heater" | "fan" | "pump", value: boolean) => {
    const prev = { ...state };
    setState({ ...state, actuator: { ...actuator, [key]: value } });
    withLoading(() => setActuator({ [key]: value }, selectedDeviceId ?? ""), () => setState(prev));
  };

  const handleServo = (value: ServoState) => {
    const prev = { ...state };
    setState({ ...state, actuator: { ...actuator, servo: value } });
    withLoading(() => setActuator({ servo: value }, selectedDeviceId ?? ""), () => setState(prev));
  };

  const servoSteps: { label: string; value: ServoState }[] = [
    { label: "Tertutup", value: "CLOSE" },
    { label: "Setengah", value: "HALF" },
    { label: "Terbuka", value: "OPEN" },
  ];

  const switches = [
    { key: "heater" as const, label: "Pemanas", active: cmdActuator.heater },
    { key: "fan" as const, label: "Kipas", active: cmdActuator.fan },
    { key: "pump" as const, label: "Pompa", active: cmdActuator.pump },
  ];

  const isLoading = reqStatus === "loading";

  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl p-6 shadow-card flex flex-col">
      <LoadingOverlay
        visible={reqStatus !== "idle"}
        status={reqStatus === "loading" ? "loading" : reqStatus === "success" ? "success" : "error"}
      />

      {/* Header: title + Auto/Manual toggle inline */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 leading-tight">Kontrol Manual</h2>
          <span className="text-xs text-gray-400">Mode operasi aktuator perangkat</span>
        </div>
        <div className={`flex items-center gap-2 ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
            autoMode
              ? "bg-brand-light text-brand-blue"
              : "bg-orange-100 text-orange-600"
          }`}>
            {autoMode ? "Auto" : "Manual"}
          </span>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-mode"
              checked={autoMode}
              onChange={(e) => handleModeToggle(e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 z-10 transition-all duration-200"
            />
            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" htmlFor="toggle-mode" />
          </div>
        </div>
      </div>

      <hr className="border-gray-100 mb-4" />

      <div className={`space-y-4 ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
        {/* Actuator toggles */}
        <div className={`space-y-4 ${autoMode ? "opacity-50 pointer-events-none" : ""}`}>
          {switches.map((sw) => (
            <div key={sw.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand-text">{sw.label}</span>
                {isOutOfSync(sw.key) && (
                  <span title="Hardware override aktif" className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                )}
              </div>
              <div className="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  id={`toggle-${sw.key}`}
                  checked={sw.active}
                  onChange={() => handleToggle(sw.key, !sw.active)}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 z-10 transition-all duration-200"
                />
                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" htmlFor={`toggle-${sw.key}`} />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-brand-text">Servo Manual</span>
              {isServoOutOfSync && (
                <span title="Hardware override aktif" className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              )}
            </div>
            <div className="flex gap-2">
              {servoSteps.map((step) => (
                <button
                  key={step.value}
                  onClick={() => handleServo(step.value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    cmdActuator.servo === step.value
                      ? "bg-brand-blue text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
