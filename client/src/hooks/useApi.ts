import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type {
    TopicNav,
    TaskOut,
    CheckResult,
    AnswerVal,
    AIAssistResponse,
    AIMode,
    ExamStartResponse,
    ExamResult,
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
    return useMutation<AIAssistResponse, Error, { user_query: string; mode: AIMode }>({
        mutationFn: (body) =>
            api<AIAssistResponse>(`/tasks/${taskId}/ai-assist`, {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}

/* ── Exam ─────────────────────────────────────────── */
export function useStartExam(examId: number) {
    return useMutation<ExamStartResponse, Error, void>({
        mutationFn: () =>
            api<ExamStartResponse>(`/exams/${examId}/start`, { method: "POST" }),
    });
}

export function useSubmitExam(examId: number) {
    return useMutation<ExamResult, Error, { answers: { task_id: number; answer: { val: AnswerVal } }[] }>({
        mutationFn: (body) =>
            api<ExamResult>(`/exams/${examId}/submit`, {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}
