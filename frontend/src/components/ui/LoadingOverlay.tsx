"use client";
import Lottie from "lottie-react";
import loadingJson from "../../../public/loading.json";

interface LoadingOverlayProps {
  visible: boolean;
  status?: "loading" | "success" | "error";
}

export default function LoadingOverlay({ visible, status = "loading" }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 rounded-[16px] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
      {status === "loading" && (
        <Lottie animationData={loadingJson} loop autoplay className="w-40 h-40" />
      )}
      {status === "success" && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-sm font-medium text-emerald-600">Berhasil</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-sm font-medium text-red-500">Gagal</span>
        </div>
      )}
    </div>
  );
}
