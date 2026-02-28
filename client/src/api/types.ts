/* ─── TypeScript types mirroring backend schemas ─── */

export type AnswerType = "single_number" | "pair" | "table";
export type ProgressStatus = "not_started" | "solved" | "failed";
export type AIMode = "tutorial" | "practice";

/* ── Navigation ────────────────────────────────────── */
export interface TaskNav {
    id: number;
    external_id: string | null;
    status: ProgressStatus;
}

export interface TopicNav {
    id: number;
    title: string;
    order_index: number;
    tasks: TaskNav[];
}

/* ── Task ──────────────────────────────────────────── */
export interface TaskFile {
    url: string;
    name: string;
}

export interface TaskOut {
    id: number;
    topic_id: number;
    external_id: string | null;
    content_html: string;
    media_resources: { files?: TaskFile[] } | null;
    answer_type: AnswerType;
}

/* ── Answers ───────────────────────────────────────── */
export type AnswerVal = number | number[] | number[][];

export interface CheckResult {
    correct: boolean;
    attempts_count: number;
    status: string;
}

/* ── AI ────────────────────────────────────────────── */
export interface AIAssistResponse {
    hint: string;
}

/* ── Exam ──────────────────────────────────────────── */
export interface ExamStartResponse {
    attempt_id: number;
    started_at: string;
    time_limit_minutes: number;
}

export interface ExamResult {
    attempt_id: number;
    total_tasks: number;
    correct_count: number;
    score: number;
    finished_at: string;
}

/* ── Admin ─────────────────────────────────────────── */
export interface TopicAdmin {
    id: number;
    title: string;
    order_index: number;
    task_count: number;
}

export interface TaskAdmin {
    id: number;
    topic_id: number;
    external_id: string | null;
    content_html: string;
    answer_type: AnswerType;
    correct_answer: Record<string, unknown> | null;
}

export interface TopicIn {
    title: string;
    order_index: number;
}

export interface ImportVariantIn {
    variant_id: number;
    topic_title: string | null;
}

export interface ImportVariantResult {
    topic_id: number;
    topic_title: string;
    created_count: number;
    skipped_count: number;
}

export interface TaskAdminIn {
    topic_id: number;
    external_id: string | null;
    content_html: string;
    answer_type: AnswerType;
    correct_answer: Record<string, unknown> | null;
}

/* ── Auth ──────────────────────────────────────────── */
export interface TokenResponse {
    access_token: string;
    token_type: string;
}
