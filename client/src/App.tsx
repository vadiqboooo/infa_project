import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "./layouts/MainLayout";
import LoginPage from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import TasksPage from "./pages/TasksPage";
import { TasksListPage } from "./pages/TasksListPage";
import ExamsListPage from "./pages/ExamsListPage";
import ExamPage from "./pages/ExamPage";
import AdminPage from "./pages/AdminPage";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PAGE_TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/login/, title: "Вход" },
  { pattern: /^\/exams\/\d+/, title: "Пробник" },
  { pattern: /^\/exams/, title: "Пробники" },
  { pattern: /^\/homework\/\d+/, title: "Домашка" },
  { pattern: /^\/homework/, title: "Домашка" },
  { pattern: /^\/tasks\/\d+/, title: "Разбор" },
  { pattern: /^\/tasks/, title: "Разбор" },
  { pattern: /^\/admin/, title: "Админ" },
  { pattern: /^\/$|^\/dashboard/, title: "Главная" },
];

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = PAGE_TITLES.find(({ pattern }) => pattern.test(pathname));
    document.title = match ? `Инфа ЕГЭ — ${match.title}` : "Инфа ЕГЭ";
  }, [pathname]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <PageTitle />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Routes with MainLayout (Sidebar) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="dashboard" element={<HomePage />} />
              <Route path="exams" element={<ExamsListPage />} />
              <Route path="tasks" element={<TasksListPage />} />
              <Route path="tasks/:id" element={<TasksPage />} />
              <Route path="homework" element={<TasksListPage />} />
              <Route path="homework/:id" element={<TasksPage />} />
              <Route path="admin/*" element={<AdminPage />} />
            </Route>

            {/* Routes without MainLayout (keep old ones if needed or remove) */}
            <Route
              path="/exams/:id"
              element={
                <ProtectedRoute>
                  <ExamPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
