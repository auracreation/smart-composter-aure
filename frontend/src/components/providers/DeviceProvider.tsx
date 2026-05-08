"use client";
import { useEffect } from "react";
import { useComposterStore } from "@/store/composterStore";
import { getDevices, getSettings } from "@/lib/api";

export default function DeviceProvider({ children }: { children: React.ReactNode }) {
  const setDevices = useComposterStore((s) => s.setDevices);
  const setSelectedDeviceId = useComposterStore((s) => s.setSelectedDeviceId);
  const selectedDeviceId = useComposterStore((s) => s.selectedDeviceId);

  useEffect(() => {
    async function init() {
      const [devices, settings] = await Promise.allSettled([getDevices(), getSettings()]);
      const deviceList = devices.status === "fulfilled" ? devices.value : [];
      const defaultId = settings.status === "fulfilled" ? (settings.value.default_device_id ?? null) : null;

      if (deviceList.length > 0) setDevices(deviceList);

      if (!selectedDeviceId && deviceList.length > 0) {
        const preferred = defaultId && deviceList.some((d) => d.device_id === defaultId)
          ? defaultId
          : deviceList[0].device_id;
        setSelectedDeviceId(preferred);
      }
    }
    init().catch(() => {});

    const poll = setInterval(() => {
      getDevices().then(setDevices).catch(() => {});
    }, 30_000);
    return () => clearInterval(poll);
  }, []);

  return <>{children}</>;
}
