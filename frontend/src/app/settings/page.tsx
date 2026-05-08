"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getSettings, updateSettings, changePassword, logoutAll,
  deleteAccount, getDevices, getSessions, revokeSession,
  UserSettings, DeviceRow, UserSession,
} from "@/lib/api";
import { useComposterStore } from "@/store/composterStore";

type Tab = "profil" | "notifikasi" | "sistem" | "tentang";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "profil", label: "Profil & Akun", icon: "fa-user" },
  { id: "notifikasi", label: "Notifikasi", icon: "fa-bell" },
  { id: "sistem", label: "Sistem & Data", icon: "fa-database" },
  { id: "tentang", label: "Tentang", icon: "fa-circle-info" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

function useSaveStatus(): [SaveStatus, (fn: () => Promise<void>) => Promise<void>] {
  const [status, setStatus] = useState<SaveStatus>("idle");
  async function run(fn: () => Promise<void>) {
    setStatus("saving");
    try {
      await fn();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }
  return [status, run];
}

function SaveBtn({ status, label = "Simpan Perubahan" }: { status: SaveStatus; label?: string }) {
  return (
    <button type="submit" disabled={status === "saving"}
      className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${
        status === "saved"
          ? "bg-green-100 text-green-700 border border-green-200"
          : status === "error"
          ? "bg-red-50 text-brand-red border border-red-200"
          : "bg-brand-blue hover:bg-brand-dark text-white shadow-md shadow-blue-200"
      }`}>
      {status === "saving" ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />Menyimpan...</>
        : status === "saved" ? <><i className="fa-solid fa-check mr-1.5" />Tersimpan</>
        : status === "error" ? <><i className="fa-solid fa-circle-exclamation mr-1.5" />Gagal</>
        : label}
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</p>;
}

function NumField({ label, value, onChange, min, max, step = 1, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-600 flex-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all" />
        {unit && <span className="text-xs text-gray-400 w-6">{unit}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profil");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  // Profil form
  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [profileStatus, runProfile] = useSaveStatus();

  // Password form
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwStatus, runPw] = useSaveStatus();

  // Logout all
  const [logoutDone, setLogoutDone] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Notifikasi form
  const [notif, setNotif] = useState({
    notify_email: true, notify_push: false,
    alert_temp_max: 70, alert_temp_min: 30, alert_humidity_min: 30,
  });
  const [savedNotifThresholds, setSavedNotifThresholds] = useState({ alert_temp_max: 70, alert_temp_min: 30, alert_humidity_min: 30 });
  const [notifStatus, runNotif] = useSaveStatus();

  // Sistem form
  const [defaultDeviceId, setDefaultDeviceId] = useState<string>("");
  const [retentionDays, setRetentionDays] = useState(90);
  const [savedSistem, setSavedSistem] = useState({ defaultDeviceId: "", retentionDays: 90 });
  const [sistemStatus, runSistem] = useSaveStatus();

  // Delete account
  const [exporting, setExporting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      let savedDisplayName: string | null = null;
      try {
        const [s, d] = await Promise.all([getSettings(), getDevices()]);
        setSettings(s);
        setDevices(d);
        savedDisplayName = s.display_name ?? null;
        setDisplayName(s.display_name ?? "");
        setNotif({
          notify_email: s.notify_email,
          notify_push: s.notify_push,
          alert_temp_max: Number(s.alert_temp_max),
          alert_temp_min: Number(s.alert_temp_min),
          alert_humidity_min: Number(s.alert_humidity_min),
        });
        setDefaultDeviceId(s.default_device_id ?? "");
        setRetentionDays(s.history_retention_days);
        setSavedDisplayName(s.display_name ?? "");
        setSavedNotifThresholds({ alert_temp_max: Number(s.alert_temp_max), alert_temp_min: Number(s.alert_temp_min), alert_humidity_min: Number(s.alert_humidity_min) });
        setSavedSistem({ defaultDeviceId: s.default_device_id ?? "", retentionDays: s.history_retention_days });
      } catch {}

      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        setUserEmail(user?.email ?? null);
        const identities = user?.identities ?? [];
        setHasPassword(identities.some((id) => id.provider === "email"));
        if (!savedDisplayName) {
          const metaName: string =
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            "";
          if (metaName) setDisplayName(metaName);
        }
        const { data: { session } } = await sb.auth.getSession();
        if (session?.access_token) {
          try {
            const payload = JSON.parse(
              atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
            );
            setCurrentSessionId(payload.session_id ?? null);
          } catch {}
        }
      } catch {}

      try {
        const { sessions: list } = await getSessions();
        setSessions(list);
      } catch {} finally {
        setSessionsLoading(false);
      }

      setLoading(false);
    }
    init();

  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    await runProfile(async () => {
      await updateSettings({ display_name: displayName });
      setSavedDisplayName(displayName);
    });
  }

  function cancelPwForm() {
    setShowPwForm(false);
    setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwError(null);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pwNew !== pwConfirm) { setPwError("Konfirmasi password tidak cocok."); return; }
    if (pwNew.length < 8) { setPwError("Password minimal 8 karakter."); return; }
    if (!/[a-z]/.test(pwNew) || !/[A-Z]/.test(pwNew) || !/[0-9]/.test(pwNew)) {
      setPwError("Password harus mengandung huruf kecil, huruf besar, dan angka."); return;
    }
    if (hasPassword) {
      const sb = createClient();
      const { error: authErr } = await sb.auth.signInWithPassword({ email: userEmail!, password: pwCurrent });
      if (authErr) { setPwError("Password saat ini salah."); return; }
    }
    await runPw(async () => {
      await changePassword(pwNew);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setShowPwForm(false);
      setHasPassword(true);
    });
  }

  async function handleNotifToggle(key: "notify_email" | "notify_push", value: boolean) {
    if (key === "notify_push" && value) {
      if (!("Notification" in window)) {
        alert("Browser kamu tidak mendukung Push Notification.");
        return;
      }
      let permission = Notification.permission;
      if (permission === "denied") {
        alert("Izin notifikasi telah diblokir. Buka pengaturan browser untuk mengaktifkannya kembali.");
        return;
      }
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        return;
      }
    }
    setNotif((n) => ({ ...n, [key]: value }));
    try {
      await updateSettings({ [key]: value });
    } catch {}
  }

  async function handleNotifSave(e: React.FormEvent) {
    e.preventDefault();
    await runNotif(async () => {
      await updateSettings({
        notify_email: notif.notify_email,
        notify_push: notif.notify_push,
        alert_temp_max: notif.alert_temp_max,
        alert_temp_min: notif.alert_temp_min,
        alert_humidity_min: notif.alert_humidity_min,
      });
      setSavedNotifThresholds({ alert_temp_max: notif.alert_temp_max, alert_temp_min: notif.alert_temp_min, alert_humidity_min: notif.alert_humidity_min });
    });
  }

  const setSelectedDeviceId = useComposterStore((s) => s.setSelectedDeviceId);

  async function handleSistemSave(e: React.FormEvent) {
    e.preventDefault();
    await runSistem(async () => {
      await updateSettings({
        default_device_id: defaultDeviceId || null,
        history_retention_days: retentionDays,
      });
      setSavedSistem({ defaultDeviceId, retentionDays });
      setSelectedDeviceId(defaultDeviceId || null);
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/settings/account/export`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Gagal mengekspor");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "history.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {}
    setExporting(false);
  }

  async function handleLogoutAll() {
    try { await logoutAll(); setLogoutDone(true); setSessions((prev) => prev.filter((s) => s.id === currentSessionId)); } catch {}
  }

  async function handleRevokeSession(id: string) {
    setRevokingId(id);
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {}
    setRevokingId(null);
  }

  function parseUA(ua: string | null): { label: string; icon: string } {
    if (!ua) return { label: "Browser Tidak Diketahui", icon: "fa-globe" };
    let browser = "Browser";
    let os = "";
    let icon = "fa-desktop";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    if (/Windows/.test(ua)) os = "Windows";
    else if (/Android/.test(ua)) { os = "Android"; icon = "fa-mobile-screen"; }
    else if (/iPhone|iPad/.test(ua)) { os = "iOS"; icon = "fa-mobile-screen"; }
    else if (/Macintosh|Mac OS/.test(ua)) os = "macOS";
    else if (/Linux/.test(ua)) os = "Linux";
    return { label: os ? `${browser} — ${os}` : browser, icon };
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} hari lalu`;
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      const sb = createClient();
      await sb.auth.signOut();
      window.location.href = "/login";
    } catch { setDeleting(false); }
  }

  const profileDirty = displayName !== savedDisplayName;

  const notifDirty =
    notif.alert_temp_max !== savedNotifThresholds.alert_temp_max ||
    notif.alert_temp_min !== savedNotifThresholds.alert_temp_min ||
    notif.alert_humidity_min !== savedNotifThresholds.alert_humidity_min;
  const sistemDirty = defaultDeviceId !== savedSistem.defaultDeviceId || retentionDays !== savedSistem.retentionDays;

  const initials = (displayName || userEmail || "?").slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-300">
        <i className="fa-solid fa-spinner fa-spin text-4xl" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Pengaturan</h1>
        <p className="text-gray-500 text-sm">Konfigurasi akun dan preferensi sistem.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-card flex flex-row lg:flex-col gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                  tab === t.id
                    ? "bg-brand-light text-brand-blue shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}>
                <i className={`fa-solid ${t.icon} w-4 text-center ${tab === t.id ? "text-brand-blue" : "text-gray-400"}`} />
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3 space-y-6">

          {/* ── PROFIL ── */}
          {tab === "profil" && (
            <>
              {/* Avatar + name */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
                <SectionHeader title="Profil" />
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-brand-blue">{initials}</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800">{displayName || "(Tanpa nama)"}</p>
                    <p className="text-sm text-gray-400">{userEmail ?? "—"}</p>
                  </div>
                </div>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1.5">Nama Tampilan</label>
                    <input type="text" value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama kamu"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
                    <input type="email" value={userEmail ?? ""} disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
                  </div>
                  {(profileDirty || profileStatus === "saved" || profileStatus === "error") && (
                    <div className="flex justify-end">
                      <SaveBtn status={profileStatus} />
                    </div>
                  )}
                </form>
              </div>

              {/* Change Password */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-lock text-brand-blue text-sm" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{hasPassword ? "Ganti Password" : "Atur Password"}</p>
                      <p className="text-xs text-gray-400">{hasPassword ? "Perbarui password akun Anda" : "Akun belum memiliki password"}</p>
                    </div>
                  </div>
                  {!showPwForm && (
                    <button type="button" onClick={() => setShowPwForm(true)}
                      className="px-4 py-1.5 text-xs font-semibold bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue/10 transition-colors">
                      {hasPassword ? "Ganti" : "Atur"}
                    </button>
                  )}
                </div>

                <div className={`transition-all duration-300 ease-in-out ${
                  showPwForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                }`}>
                  <form onSubmit={handlePasswordSave} className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
                    {(hasPassword
                      ? [
                          { label: "Password Saat Ini", val: pwCurrent, set: setPwCurrent },
                          { label: "Password Baru", val: pwNew, set: setPwNew },
                          { label: "Konfirmasi Password Baru", val: pwConfirm, set: setPwConfirm },
                        ]
                      : [
                          { label: "Password Baru", val: pwNew, set: setPwNew },
                          { label: "Konfirmasi Password Baru", val: pwConfirm, set: setPwConfirm },
                        ]
                    ).map((f) => (
                      <div key={f.label}>
                        <label className="block text-sm font-medium text-brand-text mb-1.5">{f.label}</label>
                        <input type="password" value={f.val} onChange={(e) => f.set(e.target.value)} required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all" />
                      </div>
                    ))}
                    {pwError && (
                      <p className="text-xs text-brand-red flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-exclamation" /> {pwError}
                      </p>
                    )}
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={cancelPwForm}
                        className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                        Batal
                      </button>
                      <SaveBtn status={pwStatus} label={hasPassword ? "Perbarui Password" : "Atur Password"} />
                    </div>
                  </form>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sesi Aktif</p>
                  {!logoutDone && sessions.filter((s) => s.id !== currentSessionId).length > 0 && (
                    <button onClick={handleLogoutAll}
                      className="text-xs font-semibold text-brand-red hover:underline">
                      Cabut Semua Sesi Lain
                    </button>
                  )}
                  {logoutDone && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-700 flex items-center gap-1.5">
                      <i className="fa-solid fa-check" /> Selesai
                    </span>
                  )}
                </div>

                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-300 border-t border-gray-100">
                    <i className="fa-solid fa-spinner fa-spin text-2xl" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8 border-t border-gray-100">
                    Tidak ada sesi aktif ditemukan.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {sessions.map((s) => {
                      const { label, icon } = parseUA(s.user_agent);
                      const isCurrent = s.id === currentSessionId;
                      const lastActive = s.refreshed_at ?? s.updated_at ?? s.created_at;
                      const ipDisplay = s.ip?.replace(/\/\d+$/, "") ?? null;
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isCurrent ? "bg-brand-light" : "bg-gray-100"
                            }`}>
                              <i className={`fa-solid ${icon} text-sm ${isCurrent ? "text-brand-blue" : "text-gray-400"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {ipDisplay && `${ipDisplay} · `}{isCurrent ? "Aktif sekarang" : relativeTime(lastActive)}
                              </p>
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-700 flex-shrink-0">
                              Sesi Ini
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRevokeSession(s.id)}
                              disabled={revokingId === s.id}
                              className="px-4 py-1.5 text-xs font-semibold text-brand-red bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40 flex-shrink-0">
                              {revokingId === s.id
                                ? <i className="fa-solid fa-spinner fa-spin" />
                                : "Cabut"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── NOTIFIKASI ── */}
          {tab === "notifikasi" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
              <SectionHeader title="Notifikasi & Alert" />
              <form onSubmit={handleNotifSave} className="space-y-6">
                {/* Toggle channels */}
                <div className="space-y-4">
                  {[
                    { key: "notify_email" as const, label: "Notifikasi Email", desc: "Kirim alert melalui email" },
                    { key: "notify_push" as const, label: "Push Notification", desc: "Notifikasi browser (web push)" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <div className="relative inline-block w-12 mr-2 align-middle select-none">
                        <input type="checkbox" id={item.key} checked={notif[item.key]}
                          onChange={(e) => handleNotifToggle(item.key, e.target.checked)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 z-10 transition-all duration-200" />
                        <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" htmlFor={item.key} />
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="border-gray-100" />

                {/* Threshold */}
                <div>
                  <p className="text-sm font-semibold text-brand-text mb-3">Ambang Batas Alert</p>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <NumField label="Suhu maksimum" value={notif.alert_temp_max} min={30} max={100}
                      onChange={(v) => setNotif((n) => ({ ...n, alert_temp_max: v }))} unit="°C" />
                    <NumField label="Suhu minimum" value={notif.alert_temp_min} min={0} max={60}
                      onChange={(v) => setNotif((n) => ({ ...n, alert_temp_min: v }))} unit="°C" />
                    <NumField label="Kelembaban minimum" value={notif.alert_humidity_min} min={0} max={80}
                      onChange={(v) => setNotif((n) => ({ ...n, alert_humidity_min: v }))} unit="%" />
                  </div>
                </div>

                {(notifDirty || notifStatus === "saved" || notifStatus === "error") && (
                  <div className="flex justify-end">
                    <SaveBtn status={notifStatus} />
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ── SISTEM & DATA ── */}
          {tab === "sistem" && (
            <>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
                <SectionHeader title="Preferensi Sistem" />
                <form onSubmit={handleSistemSave} className="space-y-5">
                  {devices.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-brand-text mb-1.5">Perangkat Default</label>
                      <select value={defaultDeviceId} onChange={(e) => setDefaultDeviceId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all">
                        <option value="">— Tidak ada —</option>
                        {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1.5">Retensi Riwayat</label>
                    <select value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all">
                      {[30, 60, 90, 180, 365].map((d) => (
                        <option key={d} value={d}>{d} hari</option>
                      ))}
                    </select>
                  </div>
                  {(sistemDirty || sistemStatus === "saved" || sistemStatus === "error") && (
                    <div className="flex justify-end">
                      <SaveBtn status={sistemStatus} />
                    </div>
                  )}
                </form>
              </div>

              {/* Export */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
                <SectionHeader title="Ekspor Data" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-text">Unduh Riwayat CSV</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ekspor hingga 10.000 entri terakhir dari seluruh perangkat Anda.</p>
                  </div>
                  <button onClick={handleExport} disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-dark text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex-shrink-0">
                    {exporting
                      ? <><i className="fa-solid fa-spinner fa-spin" /> Mengekspor...</>
                      : <><i className="fa-solid fa-download" /> Unduh CSV</>}
                  </button>
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-card">
                <SectionHeader title="Zona Bahaya" />
                {deleteStep === "idle" ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-text">Hapus Akun</p>
                      <p className="text-xs text-gray-400 mt-0.5">Menghapus akun, semua perangkat, dan data secara permanen. Tidak dapat dibatalkan.</p>
                    </div>
                    <button onClick={() => setDeleteStep("confirm")}
                      className="px-4 py-2 border border-red-200 text-brand-red text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
                      Hapus Akun
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <i className="fa-solid fa-triangle-exclamation text-brand-red mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700 leading-relaxed">
                        Tindakan ini <span className="font-bold">tidak dapat dibatalkan</span>. Semua perangkat, jadwal, dan riwayat akan dihapus selamanya.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-text mb-1.5">
                        Ketik <span className="font-bold text-brand-red">{userEmail ?? "email kamu"}</span> untuk konfirmasi
                      </label>
                      <input type="text" value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={userEmail ?? ""}
                        className="w-full px-4 py-2.5 border border-red-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-brand-red transition-all" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== userEmail || deleting}
                        className="flex-1 py-2.5 bg-brand-red hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40">
                        {deleting ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />Menghapus...</> : "Hapus Akun Selamanya"}
                      </button>
                      <button onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); }}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TENTANG ── */}
          {tab === "tentang" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
              <SectionHeader title="Tentang Aplikasi" />
              <div className="flex items-center gap-4 mt-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-seedling text-2xl text-brand-blue" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">Smart Composter</p>
                  <p className="text-xs text-gray-400">Version 1.0</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
