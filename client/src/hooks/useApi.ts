import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type {
    TopicNav,
    TaskOut,
    CheckResult,
    AnswerVal,
    AIAssistResponse,
    AIMode,
    ExamInfo,
    ExamStartResponse,
    ExamResult,
    UserStats,
    WeeklyActivity,
    TopicsPerformance,
    RecentSolutions,
    SolutionStep,
} from "../api/types";

/* ── Navigation ──────────────────────────────────────── */
export function useNavigation() {
    return useQuery<TopicNav[]>({
        queryKey: ["navigation"],
        queryFn: () => api<TopicNav[]>("/navigation"),
    });
}

/* ── Task detail ─────────────────────────────────────── */
export function useTask(taskId: number | null) {
    return useQuery<TaskOut>({
        queryKey: ["task", taskId],
        queryFn: () => api<TaskOut>(`/tasks/${taskId}`),
        enabled: !!taskId,
    });
}

/* ── Check answer ────────────────────────────────────── */
export function useCheckAnswer(taskId: number) {
    const qc = useQueryClient();
    return useMutation<CheckResult, Error, AnswerVal>({
        mutationFn: (val) =>
            api<CheckResult>(`/tasks/${taskId}/check`, {
                method: "POST",
                body: JSON.stringify({ val }),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["navigation"] });
        },
    });
}

/* ── AI Assist ───────────────────────────────────────── */
export function useAIAssist(taskId: number) {
    return useMutation<AIAssistResponse, Error, { user_query: string; mode: AIMode; user_code?: string | null }>({
        mutationFn: (body) =>
            api<AIAssistResponse>(`/tasks/${taskId}/ai-assist`, {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}

/* ── Exam ─────────────────────────────────────────── */
export function useExamByTopic(topicId: number | null) {
    return useQuery<ExamInfo>({
        queryKey: ["exam", "topic", topicId],
        queryFn: () => api<ExamInfo>(`/exams/by-topic/${topicId}`),
        enabled: !!topicId,
    });
}

export function useStartExam(examId: number) {
    const qc = useQueryClient();
    return useMutation<ExamStartResponse, Error, void>({
        mutationFn: () =>
            api<ExamStartResponse>(`/exams/${examId}/start`, { method: "POST" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["exam"] });
        },
    });
}

export function useSubmitExam(examId: number) {
    return useMutation<ExamResult, Error, {
        answers: { task_id: number; answer: { val: AnswerVal } }[];
        code_solutions?: { task_id: number; code: string }[];
    }>({
        mutationFn: (body) =>
            api<ExamResult>(`/exams/${examId}/submit`, {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}

export function useSaveCodeSolution(attemptId: number) {
    return useMutation<{ ok: boolean }, Error, { taskId: number; code: string }>({
        mutationFn: ({ taskId, code }) =>
            api(`/exams/attempt/${attemptId}/code/${taskId}`, {
                method: "POST",
                body: JSON.stringify({ code }),
            }),
    });
}

export function useCheckCode(attemptId: number) {
    return useMutation<{ analysis: string }, Error, { taskId: number }>({
        mutationFn: ({ taskId }) =>
            api(`/exams/attempt/${attemptId}/task/${taskId}/check-code`, {
                method: "POST",
            }),
    });
}

/* ── Statistics ──────────────────────────────────────── */
export function useUserStats() {
    return useQuery<UserStats>({
        queryKey: ["stats", "overview"],
        queryFn: () => api<UserStats>("/stats/overview"),
    });
}

export function useWeeklyActivity() {
    return useQuery<WeeklyActivity>({
        queryKey: ["stats", "weekly"],
        queryFn: () => api<WeeklyActivity>("/stats/weekly-activity"),
    });
}

export function useTopicsPerformance() {
    return useQuery<TopicsPerformance>({
        queryKey: ["stats", "topics"],
        queryFn: () => api<TopicsPerformance>("/stats/topics-performance"),
    });
}

export function useRecentSolutions(limit: number = 10) {
    return useQuery<RecentSolutions>({
        queryKey: ["stats", "recent", limit],
        queryFn: () => api<RecentSolutions>(`/stats/recent-solutions?limit=${limit}`),
    });
}

/* ── AI Step Generation ───────────────────────────────── */
export function useGenerateSteps() {
    return useMutation<{ steps: SolutionStep[]; examples_used: number }, Error, number>({
        mutationFn: async (taskId: number) => {
            const apiKey = localStorage.getItem("parser_api_key") || "";
            const res = await fetch(`/api/admin/tasks/${taskId}/generate-steps`, {
                method: "POST",
                headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Ошибка генерации");
            }
            return res.json();
        },
    });
}
