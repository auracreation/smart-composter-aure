"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://composter.ruangawan.com";

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message ?? "Gagal masuk dengan Google.");
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!captchaToken) {
      setError("Selesaikan verifikasi CAPTCHA terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/reset-password`,
        captchaToken,
      });
      if (error) throw error;
      setMessage("Link reset kata sandi telah dikirim ke email Anda.");
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } catch (err: any) {
      setError(err.message ?? "Gagal mengirim email reset.");
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (!captchaToken) {
        setError("Selesaikan verifikasi CAPTCHA terlebih dahulu.");
        setLoading(false);
        return;
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          setError("Password harus mengandung huruf kecil, huruf besar, dan angka.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken,
            emailRedirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Cek email Anda untuk konfirmasi akun.");
      }
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan.");
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4 relative overflow-hidden">
      {/* Blue gradient accent strip — matches AppShell */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-r from-blue-500 to-indigo-600 -z-10" />

      <div className="w-full max-w-md relative z-10">
        {/* Card — matches AppShell content card */}
        <div className="bg-white rounded-[2rem] p-8 shadow-card">
          {/* Card Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              {mode === "signin" ? "Masuk ke Sistem" : mode === "signup" ? "Buat Akun Baru" : "Reset Kata Sandi"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === "signin"
                ? "Masukkan kredensial Anda untuk melanjutkan"
                : mode === "signup"
                  ? "Daftarkan akun untuk mengakses sistem"
                  : "Masukkan alamat email Anda untuk mengatur ulang kata sandi"}
            </p>
          </div>

          {/* Tab Switch */}
          {mode !== "forgot" && (
            <div className="flex bg-brand-gray rounded-xl p-1 mb-6">
              <button
                onClick={() => { setMode("signin"); setError(null); setMessage(null); setCaptchaToken(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === "signin"
                    ? "bg-white text-brand-blue shadow-sm"
                    : "text-gray-400 hover:text-brand-text"
                }`}
              >
                Masuk
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); setMessage(null); setCaptchaToken(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === "signup"
                    ? "bg-white text-brand-blue shadow-sm"
                    : "text-gray-400 hover:text-brand-text"
                }`}
              >
                Daftar
              </button>
            </div>
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-brand-text placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-exclamation text-brand-red mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-red">{error}</p>
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-check text-brand-green mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-green">{message}</p>
                </div>
              )}
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => { setCaptchaToken(null); setError("Verifikasi CAPTCHA gagal. Coba lagi."); }}
                  options={{ theme: "light", language: "id" }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-all duration-200 shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mengirim...</>
                ) : (
                  <><i className="fa-solid fa-paper-plane" />Kirim Link Reset</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setMessage(null); setCaptchaToken(null); }}
                className="w-full text-sm text-gray-500 hover:text-brand-blue text-center transition-colors"
              >
                ← Kembali ke Masuk
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-brand-text placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-brand-text">
                    Kata Sandi
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); setMessage(null); setCaptchaToken(null); }}
                      className="text-xs text-brand-blue hover:underline"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-brand-text placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-exclamation text-brand-red mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-red">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-check text-brand-green mt-0.5 shrink-0" />
                  <p className="text-sm text-brand-green">{message}</p>
                </div>
              )}

              {/* Turnstile CAPTCHA */}
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => { setCaptchaToken(null); setError("Verifikasi CAPTCHA gagal. Coba lagi."); }}
                  options={{ theme: "light", language: "id" }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full text-sm transition-all duration-200 shadow-md shadow-blue-200 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : mode === "signin" ? (
                  <>
                    <i className="fa-solid fa-right-to-bracket" />
                    Masuk
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus" />
                    Buat Akun
                  </>
                )}
              </button>
            </form>
          )}

          {mode !== "forgot" && <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">atau</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>}

          {/* Google Sign In — hide on forgot mode */}
          {mode !== "forgot" && <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-brand-gray border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-brand-text font-semibold rounded-full text-sm transition-all duration-200 shadow-sm"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-gray-200 border-t-brand-blue rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleLoading ? "Menghubungkan..." : "Lanjutkan dengan Google"}
          </button>}
        </div>
      </div>
    </div>
  );
}
