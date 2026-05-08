import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-brand-light overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-blue-500 to-indigo-600 -z-10 rounded-br-[100px]" />
        <TopBar />
        <div className="flex-1 overflow-y-auto px-6 pb-6 mt-6">
          <div className="bg-white rounded-[2rem] p-8 min-h-full shadow-card relative">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
