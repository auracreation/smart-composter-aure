"use client";
import { useEffect } from "react";

const LOG_URL = "https://auxckqxqzxxalrzzlssr.supabase.co/functions/v1/client-log";

function sendLog(level: string, message: string, data?: unknown) {
  try {
    navigator.sendBeacon(
      LOG_URL,
      new Blob(
        [JSON.stringify({ level, message, data, url: window.location.href, userAgent: navigator.userAgent })],
        { type: "application/json" }
      )
    );
  } catch {}
}

export default function ClientLogger() {
  useEffect(() => {
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      origError(...args);
      sendLog("error", args.map(String).join(" "));
    };

    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      origWarn(...args);
      sendLog("warn", args.map(String).join(" "));
    };

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      sendLog("unhandled_rejection", String(e.reason), { stack: e.reason?.stack });
    };

    const onError = (e: ErrorEvent) => {
      sendLog("js_error", e.message, { filename: e.filename, lineno: e.lineno, colno: e.colno });
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
