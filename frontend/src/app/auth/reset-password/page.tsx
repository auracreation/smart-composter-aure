"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const hasHashFragment = window.location.hash.includes("access_token");

    // PKCE flow: exchange code for session
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setLinkInvalid(true);
      });
    }
    // OTP/token_hash flow: verify OTP
    else if (tokenHash && type === "recovery") {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
        if (error) setLinkInvalid(true);
      });
    }
    // No recognised token in URL and no hash fragment — show error immediately
    else if (!hasHashFragment) {
      setLinkInvalid(true);
      return;
    }

    // Timeout: if PASSWORD_RECOVERY event never fires within 12s, the link is expired/invalid
    const timeout = setTimeout(() => setLinkInvalid(true), 12000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearTimeout(timeout);
        setLinkInvalid(false);
        setReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Kata sandi tidak cocok.");
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return setError("Password harus mengandung huruf kecil, huruf besar, dan angka.");
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setMessage("Kata sandi berhasil diubah. Mengalihkan ke halaman masuk...");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-r from-blue-500 to-indigo-600 -z-10" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[2rem] p-8 shadow-card">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">Buat Kata Sandi Baru</h2>
            <p className="text-sm text-gray-500 mt-1">
              {linkInvalid
                ? "Link tidak valid atau sudah kadaluarsa"
                : ready
                  ? "Masukkan kata sandi baru untuk akun Anda"
                  : "Memverifikasi link reset, harap tunggu..."}
            </p>
          </div>

          {linkInvalid ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <i className="fa-solid fa-circle-exclamation text-brand-red mt-0.5 shrink-0" />
                <p className="text-sm text-brand-red">
                  Link reset tidak valid atau sudah kadaluarsa. Silakan minta link baru.
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark text-white font-semibold rounded-full text-sm transition-all duration-200 shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-paper-plane" />
                Minta Link Reset Baru
              </button>
            </div>
          ) : !ready ? (
            <div className="flex justify-center py-8">
              <span className="w-8 h-8 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password Baru */}
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-brand-text placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password */}
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  Konfirmasi Kata Sandi
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <i className="fa-solid fa-lock-open text-sm" />
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-brand-text placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                  </button>
                </div>
              </div>

              {/* Password match indicator */}
              {confirm.length > 0 && (
                <div className={`flex items-center gap-2 text-xs ${password === confirm ? "text-brand-green" : "text-brand-red"}`}>
                  <i className={`fa-solid ${password === confirm ? "fa-circle-check" : "fa-circle-xmark"}`} />
                  {password === confirm ? "Kata sandi cocok" : "Kata sandi tidak cocok"}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-exclamation text-brand-red mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-red">{error}</p>
                </div>
              )}

              {/* Success */}
              {message && (
                <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-check text-brand-green mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-green">{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!message}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-all duration-200 shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</>
                ) : (
                  <><i className="fa-solid fa-key" />Simpan Kata Sandi Baru</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
