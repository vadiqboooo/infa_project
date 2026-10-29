import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { BottomNav } from "../components/BottomNav";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export function MainLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isGuest = user?.role === "guest";
  const isExamWorkspace = /^\/exams\/\d+/.test(location.pathname);
  const isTelegramTask = /^\/tasks\/\d+/.test(location.pathname) && Boolean(window.Telegram?.WebApp?.initData);
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
    <div className={`app-shell flex h-screen bg-[#151515] transition-colors ${isTelegramTask ? 'telegram-task-shell' : ''}`}>
      {/* Sidebar — hidden on mobile, visible on md+ */}
      {!isGuest && (
        <div className="hidden md:flex">
          <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        </div>
      )}
      <main className={`min-w-0 flex-1 overflow-y-auto relative ${isExamWorkspace || isTelegramTask ? 'pb-0' : 'pb-16 md:pb-0'}`}>
        <Outlet />
      </main>
      {/* Bottom nav — visible only on mobile */}
      {!isExamWorkspace && !isTelegramTask && !isGuest && <BottomNav />}
    </div>
  );
}
