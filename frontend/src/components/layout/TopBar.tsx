"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useComposterStore } from "@/store/composterStore";
import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/api";
import NotificationBell from "@/components/layout/NotificationBell";

const OFFLINE_DEBOUNCE_MS = 3000;

export default function TopBar() {
  const router = useRouter();
  const connected = useComposterStore((s) => s.connected);
  const wifi = useComposterStore((s) => s.state.wifi);
  const esp32Live = wifi === "ONLINE";
  const systemOnline = connected && esp32Live;

  const [stableConnected, setStableConnected] = useState(true);
  const [stableSystemOnline, setStableSystemOnline] = useState(true);

  useEffect(() => {
    if (connected) { setStableConnected(true); return; }
    const t = setTimeout(() => setStableConnected(false), OFFLINE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [connected]);

  useEffect(() => {
    if (systemOnline) { setStableSystemOnline(true); return; }
    const t = setTimeout(() => setStableSystemOnline(false), OFFLINE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [systemOnline]);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayRole, setDisplayRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.auth.getUser(),
      getSettings().catch(() => null),
    ]).then(([{ data }, settings]) => {
      const user = data.user;
      if (!user) return;
      const metaName: string = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const email: string = user.email ?? "";
      setDisplayRole(email || "Pengelola");
      setDisplayName(settings?.display_name || metaName || email.split("@")[0] || "Admin Sistem");
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white mx-6 mt-6 rounded-2xl flex items-center justify-between px-6 py-4 shadow-card z-50 flex-shrink-0 relative">
      <div className="text-sm text-gray-500 font-medium flex items-center gap-2 flex-wrap">
        <span>Smart Composter</span>
        <span className="mx-1 text-gray-300">|</span>
        <span>Status Sistem:</span>
        <span className={`font-semibold ${stableSystemOnline ? "text-brand-blue" : "text-gray-400"}`}>
          {stableSystemOnline ? "Terhubung" : "Terputus"}
        </span>
        <span className="mx-1 text-gray-300">|</span>
        <span>Server:</span>
        <span className={`font-semibold ${stableConnected ? "text-brand-blue" : "text-brand-red"}`}>
          {stableConnected ? "Terhubung" : "Terputus"}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Bell notification */}
        <NotificationBell />

        {/* Profile dropdown */}
        <div className="relative border-l pl-6 border-gray-100" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {displayName !== null && (
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-gray-700 truncate max-w-[140px]">{displayName}</div>
                <div className="text-xs text-gray-400 truncate max-w-[140px]">{displayRole}</div>
              </div>
            )}
            <div className="w-10 h-10 rounded-full bg-brand-light border border-gray-200 flex items-center justify-center text-brand-blue flex-shrink-0">
              <i className="fa-solid fa-user" />
            </div>
            <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-14 w-64 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 z-50 overflow-hidden">
              {/* User info header */}
              <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light border border-gray-200 flex items-center justify-center text-brand-blue flex-shrink-0">
                  <i className="fa-solid fa-user" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-700 truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{displayRole}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-brand-gray transition-colors"
                >
                  <i className="fa-solid fa-gear w-4 text-center text-gray-400" />
                  Pengaturan Akun
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-brand-red hover:bg-red-50 transition-colors"
                >
                  <i className="fa-solid fa-right-from-bracket w-4 text-center" />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
