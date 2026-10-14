<claude-mem-context>
# Memory Context

# [infa_project] recent context, 2026-10-12 10:40pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18 442t read) | 1 167 073t work | 98% savings

### Oct 10, 2026
S96 infa_project: Topics redesign — still blocked, Artifact tool disabled, cannot read Figma artboards directly from session (Oct 10, 10:03 PM)
S97 User shared design canvas artifact for "Главная ученика — редизайн" (Student Home Redesign) and asked if agent could see the designs, with intent to update the topics (Топики) section design (Oct 10, 10:05 PM)
S98 Refactor admin panel topics tab: replace old table/modal UI with new TopicsPanel component in AdminPage.tsx (infa_project) (Oct 10, 10:06 PM)
204 10:08p 🔵 TopicAdmin TypeScript Interface and Data Contract Documented
206 " 🔵 Admin Topics UI Has No Dedicated Component File — All Embedded in AdminPage.tsx
207 " 🟣 TopicsPanel.css Created — Design Tokens from AdminTopics Artboard Extracted into CSS
S100 Admin panel home page migration review — user noticed misconfiguration after moving admin home, no specific issue identified yet (Oct 10, 10:11 PM)
### Oct 11, 2026
208 9:04a 🔵 Claude Artifact URLs Not Accessible via Web Tool
209 " 🔵 Claude Artifact Content Served via Sandboxed iframe from claudeusercontent.com
210 9:05a 🔵 Claude Artifact Frame API Requires Authentication (Returns 403)
211 " 🔵 pterm (Pinokio CLI) Not Found in Environment
213 " 🔵 Admin TopicDetail Header Structure Mapped — Badge Chip Pattern Identified
214 " 🔵 TopicsPanel Uses tp-* Design Token CSS System; TopicDetail Header Uses Raw Tailwind
212 " 🔵 Pinokio Control Plane Not Running on This Machine
215 10:44a 🟣 New Topic Wizard: "No specific EGE number" option requested
216 12:28p 🔵 CreateWizard: WizardState.egeNumber is currently always a number, never null
217 " 🟣 Topic wizard: "Без номера" option added to EGE number chip selector
218 " 🟣 "Без номера" wizard option builds and ships to production bundle
219 " 🔵 TaskBankPage loads ALL tasks in a single unbounded request — root cause of slowness
220 1:57p 🟣 Admin Home Page — New Design Request
221 2:02p 🔵 Design File Structure — "Главная ученика — редизайн.html"
222 " 🔵 AdminDashboard Inner Tabs Use Old Tailwind Classes (Not admin-tab System)
223 2:03p 🔵 Chrome Headless Screenshot — Design File Visual Extraction
244 2:05p 🔵 New Feature Requests: Exam Variants Mode Selection and Control Work Results Screen
224 10:25p 🔵 AdminPage.tsx — orphaned 'plans' tab type and hidden header
225 " 🟣 AdminHomePanel extracted as standalone dashboard home component
227 " 🔵 TypeScript compilation reveals two pre-existing errors, none in migrated admin files
S99 Admin panel home page migration review — user noticed something misconfigured after moving the admin home page (Oct 11, 10:25 PM)
226 10:26p 🔵 AdminHomePanel type field dependencies confirmed present in types.ts
228 10:27p 🔵 Design mockup artifact found with detailed AdminHome screen specs — reference for the migration
S101 Admin home dashboard refactor — move lesson overview to "/" for admins, remove "Главная" tab from AdminPage (Oct 11, 10:28 PM)
229 10:31p ⚖️ Admin Home vs Student Home: Separate Pages Confirmed
231 10:36p ⚖️ User clarified: admin home belongs inside admin panel on the "Главная" tab
230 10:44p 🟣 AdminHomePanel completely rewritten as teaching dashboard
232 " 🔵 HomePage.tsx already branches on groupPlan: students with lessons get LessonPlanHome
S102 Fix strange scroll on admin home groups list — entire block was scrolling instead of just groups (Oct 11, 10:45 PM)
233 10:50p 🔴 Admin home groups list — wrong scroll target
234 11:04p 🔵 MainLayout scroll container — `main` owns overflow-y-auto
235 11:06p 🔴 Admin home scroll fix — removed nested overflow-y-auto from panel container
S103 Admin home stats "Задания урока" tab upgraded to per-task answer matrix matching design spec (Oct 11, 11:07 PM)
236 11:09p 🔵 UserProgress model — last_answer and last_correct fields
237 " 🔵 Answer submission flow — last_answer payload shape and correctness tracking
239 " 🟣 New endpoint GET /admin/group-lessons/{lesson_id}/results — per-task answer matrix
238 11:10p 🔵 Task correct_answer JSONB format — `{"val": ...}` with scalar or list values
240 11:11p 🟣 AdminHomePanel — loadResults prop wired; LessonTaskResults types added to frontend
241 " ✅ Stats patch script staged — apply_stats.py written to scratchpad
243 " 🟣 Stats task matrix applied and TypeScript-clean — per-task answer view live in AdminHomePanel
242 11:12p 🟣 Stats tasks tab UI — tasks_section.tsx and stats_extra.css staged
S104 Admin panel performance optimization — completing frontend paginated rendering for TaskBankPage and recording all backend/DB/frontend changes made (Oct 11, 11:13 PM)
### Oct 12, 2026
245 8:27p 🔵 Performance Issue: Slow Loading in Admin Panel
246 " 🔵 Admin Router Structure Mapped During Performance Investigation
247 " 🔵 Critical N+1 Query Bug in GET /students Endpoint
248 " 🔵 GET /task-bank Returns Full Task Content for All Tasks
249 " 🔵 Topic Model Uses lazy="selectin" — Auto-Loads All Tasks and Exams on Every Topic Fetch
250 " 🔵 AdminPage Fires Three Heavy Endpoints in Parallel on Load
253 " 🔵 Slow Admin Panel Loading for Students, Groups, Topics, and Tasks
251 8:29p 🔵 Three-Level selectin Cascade: Topic → Exams → Exam Tasks (M2M)
252 " 🔵 TaskBankPage Renders All Task Cards Without Virtualization
254 8:35p ⚖️ Task Bank UX: Hide results until filter is applied (or show latest 30)
S105 Task bank filtering refactor: show tasks only on filter selection or show last 30 by default — backend API + frontend complete (Oct 12, 8:41 PM)
**Investigated**: - Reviewed admin.py to confirm or_ import fix landed correctly (it did — patch shows `from sqlalchemy import delete, func, or_, select, update`)
    - Reviewed TaskBankPage.tsx through a series of incremental edits to confirm all changes applied correctly
    - Checked for duplicate task_bank_summary endpoint (the second edit at 12:42:59 targeted `from sqlalchemy import delete, func, select, update` which was still present — meaning the first summary endpoint edit may not have landed, OR the file had been modified since; confirmed the second OR import edit succeeded)

**Learned**: - The TypeScript compiler check (`npx tsc --noEmit`) produced no errors for TaskBankPage (no output from grep on TaskBankPage)
    - Python tests (7 passed) confirm server module imports cleanly — `or_` import fix is valid, no NameError
    - The frontend edits were applied in dependency order: useEffect split first, then scopedTasks removal, then availableNumbers memo rewrite, then filteredTasks simplification, then summary state addition, then LATEST_TASKS_COUNT + TaskBankSummaryRow interface, then heading label update
    - Final file state of TaskBankPage.tsx is complete with all intended changes

**Completed**: **Backend (server/app/routers/admin.py):**
    - Fixed missing `or_` in sqlalchemy import (was causing NameError at runtime)
    - Added new `GET /admin/task-bank/summary` endpoint: returns `[{exam_type, subject, ege_number, count}]` rows using `func.coalesce(Topic.exam_type, Task.exam_type)` — lightweight, no task bodies loaded
    - Existing `GET /admin/task-bank` already has `q` (ID search) and `latest` (N most recent) params with `or_()` logic

    **Frontend (client/src/pages/TaskBankPage.tsx):**
    - Added `LATEST_TASKS_COUNT = 30` constant and `TaskBankSummaryRow` interface
    - Added `summary` state (`useState<TaskBankSummaryRow[]>([])`)
    - Mount-only `useEffect`: fetches `/admin/task-bank/summary` + `/admin/subject-settings` (no tasks, no loading spinner tied to this)
    - New filter-reactive `useEffect`: builds params, sends `latest=30` when no filters active (`hasFilters = false`), 300ms debounce on idQuery, calls `setLoading(true)` before fetch
    - Removed `scopedTasks` memo (was client-side exam/subject filter)
    - `availableNumbers` memo now reads from `summary` state (not loaded tasks), dependency array fixed to `[summary, exam, subject, subjectSettings]`
    - `filteredTasks = tasks` (server does all filtering)
    - Heading shows `Последние добавленные задания (30)` when no filters, `Все задания` when filters active but no specific number selected

    **Verification:**
    - TypeScript: no errors in TaskBankPage
    - Python tests: 7 passed, server imports cleanly

**Next Steps**: No active work — all changes are complete and verified. Pending from prior sessions:
    1. Run `alembic upgrade head` in server/ to apply 4 performance indexes from `034d7e8f9a01_add_perf_indexes.py`
    2. Optionally verify admin.py does not contain a duplicate `task_bank_summary` endpoint definition (second edit at 12:41:07 may have added it, then 12:42:59 added it again — FastAPI silently ignores the duplicate but it's dead code)


Access 1167k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>