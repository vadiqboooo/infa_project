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
    SolutionCommentNotification,
    AdminHelpNotification,
    CurrentPlanRecommendation,
    PreparationPlan,
    CheckoutResponse,
    LatestPaymentSync,
    PaymentHistoryItem,
    PaymentStatus,
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
export type CheckAnswerInput = { val: AnswerVal } | { answers: AnswerVal[] };

export function useCheckAnswer(taskId: number) {
    const qc = useQueryClient();
    return useMutation<CheckResult, Error, CheckAnswerInput>({
        mutationFn: (input) =>
            api<CheckResult>(`/tasks/${taskId}/check`, {
                method: "POST",
                body: JSON.stringify(input),
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

export function useSaveExamDraftAnswer(attemptId: number) {
    const qc = useQueryClient();
    return useMutation<{ ok: boolean; primary_score: number }, Error, { taskId: number; answer: { val: AnswerVal } }>({
        mutationFn: ({ taskId, answer }) =>
            api<{ ok: boolean; primary_score: number }>(`/exams/attempt/${attemptId}/save-answer`, {
                method: "PUT",
                body: JSON.stringify({ task_id: taskId, answer }),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["navigation"] });
        },
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
export function useSolutionCommentNotifications(enabled: boolean = true) {
    return useQuery<SolutionCommentNotification[]>({
        queryKey: ["solution-comment-notifications"],
        queryFn: () => api<SolutionCommentNotification[]>("/tasks/solution-comments/notifications"),
        enabled,
        refetchInterval: 5000,
    });
}

export function useAdminHelpNotifications(enabled: boolean = true) {
    return useQuery<AdminHelpNotification[]>({
        queryKey: ["admin-help-notifications"],
        queryFn: () => api<AdminHelpNotification[]>("/admin/help-notifications"),
        enabled,
        refetchInterval: 5000,
    });
}

export function useMarkAdminHelpNotificationRead() {
    const qc = useQueryClient();
    return useMutation<{ ok: boolean }, Error, { source: "comment_reaction" | "direct_request"; source_id: number }>({
        mutationFn: (body) =>
            api<{ ok: boolean }>("/admin/help-notifications/read", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin-help-notifications"] });
        },
    });
}

export function usePreparationPlans() {
    return useQuery<PreparationPlan[]>({
        queryKey: ["preparation-plans"],
        queryFn: () => api<PreparationPlan[]>("/preparation-plans"),
    });
}

export function useCurrentPreparationPlan() {
    return useQuery<CurrentPlanRecommendation>({
        queryKey: ["preparation-plans", "current"],
        queryFn: () => api<CurrentPlanRecommendation>("/preparation-plans/current"),
    });
}

export function useSelectPreparationPlan() {
    const qc = useQueryClient();
    return useMutation<CurrentPlanRecommendation, Error, { plan_id: number; duration_days?: number }>({
        mutationFn: (body) =>
            api<CurrentPlanRecommendation>("/preparation-plans/select", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["preparation-plans", "current"] });
            qc.invalidateQueries({ queryKey: ["navigation"] });
        },
    });
}

export function useUpdatePreparationPlanActiveBlock() {
    const qc = useQueryClient();
    return useMutation<CurrentPlanRecommendation, Error, { block_id: number }>({
        mutationFn: (body) =>
            api<CurrentPlanRecommendation>("/preparation-plans/current/active-block", {
                method: "PUT",
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["preparation-plans", "current"] });
        },
    });
}

export function useCreateCheckout() {
    return useMutation<CheckoutResponse, Error, { plan: "summer" | "year" }>({
        mutationFn: (body) =>
            api<CheckoutResponse>("/billing/checkout", {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}

export function usePaymentStatus(paymentId: number | null) {
    const qc = useQueryClient();
    return useQuery<PaymentStatus>({
        queryKey: ["billing", "payment", paymentId],
        queryFn: async () => {
            const status = await api<PaymentStatus>(`/billing/payments/${paymentId}`);
            if (status.status === "succeeded") {
                qc.invalidateQueries({ queryKey: ["preparation-plans", "current"] });
                qc.invalidateQueries({ queryKey: ["navigation"] });
            }
            return status;
        },
        enabled: !!paymentId,
        refetchInterval: (query) => query.state.data?.status === "succeeded" ? false : 3000,
    });
}

export function useSyncLatestPayment(enabled: boolean = true) {
    const qc = useQueryClient();
    return useQuery<LatestPaymentSync>({
        queryKey: ["billing", "latest-payment", "sync"],
        queryFn: async () => {
            const result = await api<LatestPaymentSync>("/billing/latest-payment/sync", {
                method: "POST",
                body: JSON.stringify({}),
            });
            if (result.payment?.status === "succeeded") {
                qc.invalidateQueries({ queryKey: ["preparation-plans", "current"] });
                qc.invalidateQueries({ queryKey: ["navigation"] });
            }
            return result;
        },
        enabled,
        staleTime: 0,
        retry: 1,
    });
}

export function usePaymentHistory() {
    return useQuery<PaymentHistoryItem[]>({
        queryKey: ["billing", "payments"],
        queryFn: () => api<PaymentHistoryItem[]>("/billing/payments"),
    });
}

export function useChangePassword() {
    return useMutation<void, Error, { current_password: string; new_password: string }>({
        mutationFn: (body) =>
            api<void>("/auth/change-password", {
                method: "POST",
                body: JSON.stringify(body),
            }),
    });
}

export function useMarkSolutionCommentNotificationsRead() {
    const qc = useQueryClient();
    return useMutation<{ ok: boolean; read_count: number }, Error, { comment_ids?: number[] }>({
        mutationFn: (body) =>
            api<{ ok: boolean; read_count: number }>("/tasks/solution-comments/notifications/read", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["solution-comment-notifications"] });
        },
    });
}

export function useRequestTeacherHelp(taskId: number) {
    const qc = useQueryClient();
    return useMutation<{ ok: boolean; help_request_id: number }, Error, { message?: string } | void>({
        mutationFn: (body) =>
            api<{ ok: boolean; help_request_id: number }>(`/tasks/${taskId}/solution/help-request`, {
                method: "POST",
                body: JSON.stringify({ message: body?.message }),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin-help-notifications"] });
        },
    });
}

export function useGenerateSteps() {
    return useMutation<{ steps: SolutionStep[]; examples_used: number }, Error, number>({
        mutationFn: async (taskId: number) => {
            const apiKey = localStorage.getItem("admin_api_key") || "";
            const jwt = localStorage.getItem("jwt_token") || "";
            const res = await fetch(`/api/admin/tasks/${taskId}/generate-steps`, {
                method: "POST",
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                    ...(jwt ? { "Authorization": `Bearer ${jwt}` } : {}),
                },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Ошибка генерации");
            }
            return res.json();
        },
    });
}
