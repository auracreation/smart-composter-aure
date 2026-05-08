"use client";
import { usePathname } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import LiveStateProvider from "@/components/providers/LiveStateProvider";
import DeviceProvider from "@/components/providers/DeviceProvider";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AppShell>
      <DeviceProvider>
        <LiveStateProvider>{children}</LiveStateProvider>
      </DeviceProvider>
    </AppShell>
  );
}
