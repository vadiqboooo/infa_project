import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F5F4F0]">
      <Outlet />
    </div>
  );
}