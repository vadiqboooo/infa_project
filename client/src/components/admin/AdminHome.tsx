import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { GroupLessonProgress, GroupOut, LessonTaskResults, StudentOut } from '../../api/types';
import { AdminHomePanel } from './AdminHomePanel';

/** Home page for admins: group / student overview with today's lesson. */
export function AdminHome() {
  const groups = useQuery<GroupOut[]>({ queryKey: ['admin-groups'], queryFn: () => api<GroupOut[]>('/admin/groups') });
  const students = useQuery<StudentOut[]>({ queryKey: ['admin-students'], queryFn: () => api<StudentOut[]>('/admin/students') });

  const loadProgress = useCallback((groupId: number, studentId?: number) => {
    const query = studentId !== undefined ? `?student_id=${studentId}` : '';
    return api<GroupLessonProgress>(`/admin/groups/${groupId}/lesson-progress${query}`);
  }, []);

  const loadResults = useCallback((lessonId: number) => api<LessonTaskResults>(`/admin/group-lessons/${lessonId}/results`), []);

  return (
    <div className="p-4 md:p-6">
      <AdminHomePanel
        groups={groups.data ?? []}
        students={students.data ?? []}
        loading={groups.isLoading || students.isLoading}
        loadProgress={loadProgress}
        loadResults={loadResults}
      />
    </div>
  );
}
