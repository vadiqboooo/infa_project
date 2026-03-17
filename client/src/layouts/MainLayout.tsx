import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { BottomNav } from "../components/BottomNav";

export function MainLayout() {
  return (
    <div className="flex h-screen bg-[#F8F7F4]">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto relative pb-16 md:pb-0">
        <Outlet />
      </main>
      {/* Bottom nav — visible only on mobile */}
      <BottomNav />
    </div>
  );
}
