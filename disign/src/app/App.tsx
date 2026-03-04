import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TasksListPage } from './pages/TasksListPage';
import { TaskPage } from './pages/TaskPage';
import { ExamPage } from './pages/ExamPage';
import { ExamVariantPage } from './pages/ExamVariantPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
        </Route>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<HomePage />} />
          <Route path="tasks" element={<TasksListPage />} />
          <Route path="task/:taskId" element={<TaskPage />} />
          <Route path="exam" element={<ExamPage />} />
          <Route path="exam/:variantId" element={<ExamVariantPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
