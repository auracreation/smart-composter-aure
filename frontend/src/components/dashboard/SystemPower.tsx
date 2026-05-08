"use client";
import { useState } from "react";
import { useComposterStore } from "@/store/composterStore";
import { setCycle } from "@/lib/api";
import LoadingOverlay from "@/components/ui/LoadingOverlay";

type RequestStatus = "idle" | "loading" | "success" | "error";

export default function SystemPower() {
  const state = useComposterStore((s) => s.state);
  const setState = useComposterStore((s) => s.setState);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);

  const connected = useComposterStore((s) => s.connected);
  const { mode, wifi } = state;
  const isActive = mode === "PROCESS" || mode === "MANUAL";
  const isBooting = mode === "BOOT";
  const isOffline = !connected || wifi !== "ONLINE";

  const [reqStatus, setReqStatus] = useState<RequestStatus>("idle");
  const isLoading = reqStatus === "loading";

  async function handleClick() {
    if (isLoading || isBooting || isOffline) return;
    const action = isActive ? "stop" : "start";
    const prev = { ...state };
    setState({
      ...state,
      mode: action === "start" ? "PROCESS" : "STANDBY",
      lastEvent: action === "start" ? "PROCESS_STARTED" : "PROCESS_STOPPED_BY_USER",
    });
    setReqStatus("loading");
    const minDelay = new Promise<void>((r) => setTimeout(r, 700));
    let failed = false;
    try {
      await Promise.all([setCycle(action, selectedDeviceId ?? ""), minDelay]);
    } catch {
      failed = true;
      setState(prev);
    }
    setReqStatus(failed ? "error" : "success");
    setTimeout(() => setReqStatus("idle"), 1200);
  }

  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl p-6 shadow-card overflow-hidden">
      <LoadingOverlay
        visible={reqStatus !== "idle"}
        status={reqStatus === "loading" ? "loading" : reqStatus === "success" ? "success" : "error"}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 leading-tight">Hidupkan Sistem</h2>
          {isOffline && (
            <span className="text-xs text-red-400 font-medium">Perangkat tidak terhubung</span>
          )}
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={handleClick}
            disabled={isBooting || isLoading || isOffline}
            className={`
              relative w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-200 select-none
              ${isBooting || isLoading || isOffline
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : isActive
                  ? "bg-red-50 text-red-500 border-2 border-red-500 hover:bg-red-100 active:scale-95"
                  : "bg-brand-light text-brand-blue border-2 border-brand-blue hover:bg-blue-100 active:scale-95"
              }
            `}
          >
            <i className="fa-solid fa-power-off text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}
