/* ─── TypeScript types mirroring backend schemas ─── */

export enum AnswerType {
    single_number = "single_number",
    pair = "pair",
    table = "table",
    text = "text"
}

export enum ProgressStatus {
    not_started = "not_started",
    solved = "solved",
    failed = "failed"
}

export enum AIMode {
    tutorial = "tutorial",
    practice = "practice"
}

export enum TaskDifficulty {
    easy = "easy",
    medium = "medium",
    hard = "hard"
}

/* ── Navigation ────────────────────────────────────── */
export enum TopicCategory {
    tutorial = "tutorial",
    homework = "homework",
    variants = "variants"
}

export interface TaskNav {
    id: number;
    external_id: string | null;
    ege_number: number | null;
    status: ProgressStatus;
    has_solution: boolean;
}

export interface TopicNav {
    id: number;
    title: string;
    order_index: number;
    category: TopicCategory;
    tasks: TaskNav[];
    exam_id?: number;
    latest_score?: number;
    latest_primary_score?: number;
    max_score?: number;
    time_limit_minutes?: number;
    is_mock: boolean;
}

/* ── Task ──────────────────────────────────────────── */
export interface TaskFile {
    url: string;
    name: string;
}

export interface SolutionStep {
    title: string;
    explanation: string;
    code: string;
}

export interface TaskOut {
    id: number;
    topic_id: number;
    external_id: string | null;
    ege_number: number | null;
    content_html: string;
    media_resources: { files?: TaskFile[] } | null;
    answer_type: AnswerType;
    difficulty: TaskDifficulty;
    title?: string | null;
    description?: string | null;
    solution_steps?: SolutionStep[] | null;
    full_solution_code?: string | null;
    status?: ProgressStatus;
}

/* ── Answers ───────────────────────────────────────── */
export type AnswerVal = number | number[] | number[][] | string;

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
export interface ExamInfo {
    id: number;
    topic_id: number;
    time_limit_minutes: number;
    task_count: number;
    active_attempt: {
        id: number;
        started_at: string;
    } | null;
    finished_attempt: {
        id: number;
        started_at: string;
        finished_at: string;
        primary_score: number;
        score: number;
    } | null;
}

export interface ExamStartResponse {
    attempt_id: number;
    started_at: string;
    time_limit_minutes: number;
}

export interface TaskResult {
    task_id: number;
    ege_number: number | null;
    user_answer: { val: AnswerVal } | null;
    correct_answer: { val: AnswerVal } | null;
    is_correct: boolean;
    points: number;
    max_points?: number;
    code_solution?: string | null;
    file_solution_url?: string | null;
}

export interface ExamResult {
    attempt_id: number;
    total_tasks: number;
    correct_count: number;
    primary_score: number;
    score: number;
    finished_at: string;
    task_results?: TaskResult[];
}

/* ── Statistics ────────────────────────────────────── */
export interface DayActivity {
    day: string;
    solved: number;
}

export interface TopicPerformance {
    name: string;
    correct_count: number;
    total_count: number;
    accuracy: number;
}

export interface RecentActivity {
    task_id: number;
    task_title: string;
    topic_name: string;
    is_correct: boolean;
    solved_at: string;
}

export interface UserStats {
    total_solved: number;
    total_tasks: number;
    accuracy: number;
    predicted_score: number;
    current_streak: number;
    best_streak: number;
}

export interface WeeklyActivity {
    days: DayActivity[];
}

export interface TopicsPerformance {
    topics: TopicPerformance[];
}

export interface RecentSolutions {
    solutions: RecentActivity[];
}

/* ── Admin ─────────────────────────────────────────── */
export interface TopicAdmin {
    id: number;
    title: string;
    order_index: number;
    category: TopicCategory;
    task_count: number;
    time_limit_minutes?: number;
    is_mock: boolean;
}

export interface TaskAdmin {
    id: number;
    topic_id: number;
    external_id: string | null;
    ege_number: number | null;
    title: string | null;
    description: string | null;
    content_html: string;
    answer_type: AnswerType;
    difficulty: TaskDifficulty;
    correct_answer: Record<string, unknown> | null;
    solution_steps: SolutionStep[] | null;
    full_solution_code: string | null;
    order_index: number;
}

export interface TopicIn {
    title: string;
    order_index: number;
    category: TopicCategory;
    time_limit_minutes?: number;
    is_mock: boolean;
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
    ege_number: number | null;
    title: string | null;
    description: string | null;
    content_html: string;
    answer_type: AnswerType;
    difficulty: TaskDifficulty;
    correct_answer: Record<string, unknown> | null;
    solution_steps: SolutionStep[] | null;
    full_solution_code: string | null;
}

/* ── Students ───────────────────────────────────────── */
export interface StudentTopicProgress {
    topic_name: string;
    solved: number;
    total: number;
}

export interface StudentExamScore {
    variant_name: string;
    score: number;
    max_score: number;
}

export interface StudentOut {
    id: number;
    name: string;
    username: string | null;
    photo_url: string | null;
    role: string;
    last_active_at: string;
    total_solved: number;
    total_tasks: number;
    exam_scores: StudentExamScore[];
    topic_progress: StudentTopicProgress[];
}

/* ── Auth ──────────────────────────────────────────── */
export interface TokenResponse {
    access_token: string;
    token_type: string;
}

export interface User {
    id: number;
    tg_id: number;
    username: string | null;
    first_name: string | null;
    first_name_real: string | null;
    last_name_real: string | null;
    photo_url: string | null;
    role: string;
}
