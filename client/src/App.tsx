import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "./layouts/MainLayout";
import { ThemeProvider } from "./context/ThemeContext";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import { HomePage } from "./pages/HomePage";
import TasksPage from "./pages/TasksPage";
import { TasksListPage } from "./pages/TasksListPage";
import ExamsListPage from "./pages/ExamsListPage";
import ExamPage from "./pages/ExamPage";
import AdminPage from "./pages/AdminPage";
import NotificationsPage from "./pages/NotificationsPage";
import TaskBankPage from "./pages/TaskBankPage";
import WorksheetPage from "./pages/WorksheetPage";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const DEFAULT_SEO_TITLE = "Подготовка к ЕГЭ по информатике и математике | RanchEasy";

const PAGE_TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/terms/, title: "Условия" },
  { pattern: /^\/privacy/, title: "Политика конфиденциальности" },
  { pattern: /^\/login/, title: "Вход" },
  { pattern: /^\/exams\/\d+/, title: "Пробник" },
  { pattern: /^\/exams/, title: "Пробники" },
  { pattern: /^\/homework\/\d+/, title: "Домашка" },
  { pattern: /^\/homework/, title: "Домашка" },
  { pattern: /^\/tasks\/\d+/, title: "Разбор" },
  { pattern: /^\/tasks/, title: "Разбор" },
  { pattern: /^\/admin/, title: "Админ" },
  { pattern: /^\/notifications/, title: "Уведомления" },
  { pattern: /^\/task-bank/, title: "База заданий" },
  { pattern: /^\/$|^\/dashboard/, title: DEFAULT_SEO_TITLE },
];

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = PAGE_TITLES.find(({ pattern }) => pattern.test(pathname));
    document.title = match
      ? (match.title === DEFAULT_SEO_TITLE ? match.title : `Инфа ЕГЭ — ${match.title}`)
      : DEFAULT_SEO_TITLE;
  }, [pathname]);
  return null;
}

function getOrCreateStorageId(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    storage.setItem(key, value);
  }
  return value;
}

function AnalyticsTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const visitorId = getOrCreateStorageId(localStorage, "analytics_visitor_id");
    const sessionId = getOrCreateStorageId(sessionStorage, "analytics_session_id");
    const token = localStorage.getItem("jwt_token");

    fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        path: `${pathname}${search}`,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics must never interrupt the user flow.
    });
  }, [pathname, search]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <LandingPage />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "admin" ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <PageTitle />
            <AnalyticsTracker />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

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
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="admin/*" element={<AdminPage />} />
                <Route
                  path="task-bank"
                  element={
                    <AdminRoute>
                      <TaskBankPage />
                    </AdminRoute>
                  }
                />
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

              <Route
                path="/worksheet/:id"
                element={
                  <ProtectedRoute>
                    <WorksheetPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
