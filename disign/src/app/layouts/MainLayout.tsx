import { Outlet } from "react-router";
import { Sidebar } from "../components/Sidebar";

export function MainLayout() {
  return (
    <div className="flex h-screen bg-[#F8F7F4]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
