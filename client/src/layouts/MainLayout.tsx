import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { BottomNav } from "../components/BottomNav";
import { useEffect, useState } from "react";

export function MainLayout() {
  const location = useLocation();
  const isExamWorkspace = /^\/exams\/\d+/.test(location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("main-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("main-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {}
  }, [sidebarCollapsed]);

  return (
    <div className="app-shell flex h-screen bg-[#151515] transition-colors">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      </div>
      <main className={`min-w-0 flex-1 overflow-y-auto relative ${isExamWorkspace ? 'pb-0' : 'pb-16 md:pb-0'}`}>
        <Outlet />
      </main>
      {/* Bottom nav — visible only on mobile */}
      {!isExamWorkspace && <BottomNav />}
    </div>
  );
}
