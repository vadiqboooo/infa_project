import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
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
