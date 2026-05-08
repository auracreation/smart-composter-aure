"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteReadNotifications,
  Notification,
  NotificationType,
} from "@/lib/api";
import { useComposterStore } from "@/store/composterStore";

const POLL_INTERVAL_MS = 15_000; // fallback poll
const DROPDOWN_LIMIT = 5;
const MODAL_LIMIT = 50;

function typeIcon(type: NotificationType) {
  switch (type) {
    case "alert":    return { icon: "fa-triangle-exclamation", bg: "bg-red-50",    color: "text-red-500" };
    case "warning":  return { icon: "fa-triangle-exclamation", bg: "bg-orange-50", color: "text-orange-500" };
    case "schedule": return { icon: "fa-calendar-check",       bg: "bg-purple-50", color: "text-purple-500" };
    case "device":   return { icon: "fa-microchip",            bg: "bg-gray-100",  color: "text-gray-500" };
    case "system":   return { icon: "fa-gear",                 bg: "bg-gray-100",  color: "text-gray-500" };
    default:         return { icon: "fa-circle-info",          bg: "bg-blue-50",   color: "text-brand-blue" };
  }
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000)   return "Baru saja";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} jam lalu`;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
}

function NotifItem({
  n,
  onMarkRead,
}: {
  n: Notification;
  onMarkRead: (id: string) => void;
}) {
  const { icon, bg, color } = typeIcon(n.type);
  return (
    <div
      onClick={() => { if (!n.read) onMarkRead(n.id); }}
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors cursor-pointer hover:bg-gray-50 ${n.read ? "opacity-55" : ""}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
        <i className={`fa-solid ${icon} text-sm ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className={`text-sm leading-snug ${n.read ? "text-gray-500 font-normal" : "text-gray-700 font-semibold"}`}>
            {n.title}
          </p>
          {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{n.message}</p>
        <p className="text-[10px] text-gray-300 mt-1">{fmtTime(n.created_at)}</p>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const [open, setOpen]                   = useState(false);
  const [modalOpen, setModalOpen]         = useState(false);
  const [preview, setPreview]             = useState<Notification[]>([]);
  const [all, setAll]                     = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingAll, setLoadingAll]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Trigger badge refresh on any live state event (mode switch, cycle, device online/offline, etc.)
  const lastEvent  = useComposterStore((s) => s.state.lastEvent);
  const wifiStatus = useComposterStore((s) => s.state.wifi);

  const fetchCount = useCallback(async () => {
    try { setUnreadCount(await getUnreadCount()); } catch {}
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const data = await getNotifications({ limit: DROPDOWN_LIMIT });
      setPreview(data);
      setUnreadCount(await getUnreadCount());
    } catch {} finally { setLoadingPreview(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const data = await getNotifications({ limit: MODAL_LIMIT });
      setAll(data);
    } catch {} finally { setLoadingAll(false); }
  }, []);

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Refresh badge immediately whenever the live state changes
  useEffect(() => { fetchCount(); }, [lastEvent, wifiStatus, fetchCount]);

  useEffect(() => { if (open) fetchPreview(); }, [open, fetchPreview]);
  useEffect(() => { if (modalOpen) fetchAll(); }, [modalOpen, fetchAll]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function applyRead(id: string, target: Notification[]) {
    return target.map((n) => n.id === id ? { ...n, read: true } : n);
  }

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setPreview((p) => applyRead(id, p));
      setAll((a) => applyRead(id, a));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setPreview((p) => p.map((n) => ({ ...n, read: true })));
      setAll((a) => a.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleDeleteRead() {
    try {
      await deleteReadNotifications();
      setPreview((p) => p.filter((n) => !n.read));
      setAll((a) => a.filter((n) => !n.read));
    } catch {}
  }

  function openModal() {
    setOpen(false);
    setModalOpen(true);
  }

  const hasRead = all.some((n) => n.read) || preview.some((n) => n.read);

  return (
    <>
      {/* Bell button + dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-gray-400 hover:text-gray-600 relative transition-colors"
          aria-label="Notifikasi"
        >
          <i className="fa-solid fa-bell text-lg" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                    {unreadCount} belum dibaca
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} className="text-[11px] text-brand-blue hover:text-brand-dark font-semibold transition-colors">
                  Tandai semua dibaca
                </button>
              )}
            </div>

            {/* Preview list (5 items) */}
            <div>
              {loadingPreview && preview.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  <i className="fa-solid fa-spinner fa-spin mb-2 block text-lg" />
                  Memuat...
                </div>
              )}
              {!loadingPreview && preview.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  <i className="fa-regular fa-bell-slash block text-2xl mb-2 text-gray-300" />
                  Tidak ada notifikasi
                </div>
              )}
              {preview.map((n) => (
                <NotifItem key={n.id} n={n} onMarkRead={handleMarkRead} />
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
              <button
                onClick={openModal}
                className="text-xs text-brand-blue hover:text-brand-dark font-semibold transition-colors flex items-center gap-1.5"
              >
                Lihat selengkapnya
                <i className="fa-solid fa-arrow-right text-[10px]" />
              </button>
              {hasRead && (
                <button onClick={handleDeleteRead} className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center gap-1.5">
                  <i className="fa-solid fa-trash text-[10px]" />
                  Hapus dibaca
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          {/* Panel */}
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-800">Semua Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                    {unreadCount} belum dibaca
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAll} className="text-xs text-brand-blue hover:text-brand-dark font-semibold transition-colors">
                    Tandai semua dibaca
                  </button>
                )}
                <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingAll && all.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                  <i className="fa-solid fa-spinner fa-spin mb-2 block text-2xl" />
                  Memuat...
                </div>
              )}
              {!loadingAll && all.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                  <i className="fa-regular fa-bell-slash block text-3xl mb-3 text-gray-300" />
                  Tidak ada notifikasi
                </div>
              )}
              {all.map((n) => (
                <NotifItem key={n.id} n={n} onMarkRead={handleMarkRead} />
              ))}
            </div>

            {/* Footer */}
            {hasRead && (
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                <button onClick={handleDeleteRead} className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center gap-1.5">
                  <i className="fa-solid fa-trash text-[10px]" />
                  Hapus semua notifikasi yang sudah dibaca
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
