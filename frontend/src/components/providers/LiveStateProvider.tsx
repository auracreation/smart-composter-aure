"use client";
import { useLiveState } from "@/hooks/useLiveState";
import { useNotifications } from "@/hooks/useNotifications";

export default function LiveStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useLiveState();
  useNotifications();
  return <>{children}</>;
}
