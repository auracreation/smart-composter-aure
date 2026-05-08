"use client";
import Link from "next/link";
import { useComposterStore } from "@/store/composterStore";
import { eventLabel, isWarningEvent } from "@/lib/eventLabel";

export default function LatestEvent() {
  const lastEvent = useComposterStore((s) => s.state.lastEvent);
  const timestamp = useComposterStore((s) => s.state.timestamp);

  const time = (() => {
    try {
      const d = new Date(timestamp);
      if (!timestamp || isNaN(d.getTime())) return "--:--";
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    } catch {
      return "--:--";
    }
  })();

  const isWarning = isWarningEvent(lastEvent);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-6 py-4 shadow-card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <i className={`fa-solid ${isWarning ? "fa-triangle-exclamation text-brand-red" : "fa-circle-info text-brand-blue"}`} />
        <span className="text-sm text-brand-text" suppressHydrationWarning>
          <strong className={isWarning ? "text-brand-red" : "text-brand-blue"}>
            {eventLabel(lastEvent)}
          </strong>{" "}
          pada {time}
        </span>
      </div>
      <Link
        href="/history"
        className="text-sm font-medium text-brand-blue hover:text-brand-dark transition-colors"
      >
        Lihat Semua
      </Link>
    </div>
  );
}
