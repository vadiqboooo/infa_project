import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  useCurrentPreparationPlan,
  useCreateCheckout,
  useNavigation,
  usePaymentStatus,
  usePreparationPlans,
  useSelectPreparationPlan,
  useSyncLatestPayment,
  useUpdatePreparationPlanActiveBlock,
  useUserStats,
  useWeeklyActivity,
} from '../hooks/useApi';
import { TopicCategory, type TopicNav } from '../api/types';
import { Award, Brain, CheckCircle2, ChevronRight, FileText, ListChecks, LockKeyhole, MoreHorizontal, PlaySquare, Route, Save, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';
import metricChart from '../assets/metric-chart.png';
import metricCup from '../assets/metric-cup.png';
import metricGift from '../assets/metric-gift.png';
import metricTasks from '../assets/metric-tasks.png';
import { useTheme } from '../context/ThemeContext';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ExamScorePoint = {
  id: number;
  name: string;
  score: number | null;
  isPendingReview: boolean;
};

type PlanTaskProgress = {
  taskId: number;
  label: string;
  solved: number;
  total: number;
  percent: number;
  href?: string;
  statusText?: string;
};

const EGE_2026_DATE = new Date(2026, 5, 18);
const PREPARATION_ACTIVE_BLOCK_STORAGE_PREFIX = 'preparation-plan-active-block';

type PlanBlockProgressItem = NonNullable<ReturnType<typeof useCurrentPreparationPlan>['data']>['block_progress'][number];

type PlanBlockTracker = {
  blockId: number;
  title: string;
  estimatedScore: number;
  includesVariant: boolean;
  isDone: boolean;
  isCurrent: boolean;
  solved: number;
  requiredSolvedCount: number;
  progressPercent: number;
  tasks: PlanTaskProgress[];
};

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userStats } = useUserStats();
  const { data: weeklyData } = useWeeklyActivity();
  const { data: navigation } = useNavigation();
  const { data: plans } = usePreparationPlans();
  const { data: currentPlan } = useCurrentPreparationPlan();
  const selectPlan = useSelectPreparationPlan();
  const updateActiveBlock = useUpdatePreparationPlanActiveBlock();
  const paymentIdFromUrl = Number(searchParams.get('payment_id'));
  const paymentId = Number.isFinite(paymentIdFromUrl) && paymentIdFromUrl > 0 ? paymentIdFromUrl : null;
  const { data: paymentStatus } = usePaymentStatus(paymentId);
  const shouldSyncLatestPayment = currentPlan?.subscription_plan === 'none' || currentPlan?.subscription_required;
  useSyncLatestPayment(!!currentPlan && shouldSyncLatestPayment);
  const [selectedPlanId, setSelectedPlanId] = React.useState<number | ''>('');
  const [durationDays, setDurationDays] = React.useState(14);
  const [localActiveBlockId, setLocalActiveBlockId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!selectedPlanId && plans?.length) {
      setSelectedPlanId(plans[0].id);
      setDurationDays(plans[0].default_duration_days);
    }
  }, [plans, selectedPlanId]);

  React.useEffect(() => {
    if (currentPlan?.plan) {
      setSelectedPlanId(currentPlan.plan.id);
      setDurationDays(currentPlan.plan.default_duration_days);
    }
  }, [currentPlan?.plan?.id]);

  const stats = userStats || {
    total_solved: 0,
    total_tasks: 0,
    accuracy: 0,
    predicted_score: 0,
    current_streak: 0,
    best_streak: 0,
  };

  const progress = stats.total_tasks > 0
    ? Math.round((stats.total_solved / stats.total_tasks) * 100)
    : 0;

  const weeklyDays = weeklyData?.days ?? [];
  const weeklyTotal = weeklyDays.reduce((sum, day) => sum + day.solved, 0);
  const weeklyAverage = weeklyDays.length > 0 ? Math.round(weeklyTotal / weeklyDays.length) : 0;

  const examScores = React.useMemo(() => {
    const topics = (navigation ?? []).filter((topic) =>
      (topic.category === TopicCategory.variants || topic.category === TopicCategory.mock)
      && isExamStarted(topic),
    );
    return buildScorePoints(topics);
  }, [navigation]);
  const completedExamScores = examScores.filter((item) => item.score != null && item.score > 0);
  const latestExamScore = completedExamScores.at(-1)?.score ?? 0;
  const planBlockTrackers = React.useMemo(
    () => buildPlanBlockTrackers(currentPlan?.block_progress ?? [], navigation ?? [], currentPlan?.current_block?.block_id),
    [currentPlan, navigation],
  );
  const activeBlockStorageKey = React.useMemo(() => {
    const planKey = currentPlan?.user_plan_id ?? currentPlan?.plan?.id;
    return planKey ? `${PREPARATION_ACTIVE_BLOCK_STORAGE_PREFIX}:${planKey}` : null;
  }, [currentPlan?.plan?.id, currentPlan?.user_plan_id]);
  const effectiveActiveBlockId = currentPlan?.active_block_id ?? localActiveBlockId;

  React.useEffect(() => {
    if (!activeBlockStorageKey) {
      setLocalActiveBlockId(null);
      return;
    }

    const serverBlockId = currentPlan?.active_block_id;
    if (serverBlockId != null) {
      setLocalActiveBlockId(serverBlockId);
      localStorage.setItem(activeBlockStorageKey, String(serverBlockId));
      return;
    }

    const savedBlockId = Number(localStorage.getItem(activeBlockStorageKey));
    const hasSavedBlock = Number.isFinite(savedBlockId)
      && planBlockTrackers.some((block) => block.blockId === savedBlockId);
    setLocalActiveBlockId(hasSavedBlock ? savedBlockId : null);
  }, [activeBlockStorageKey, currentPlan?.active_block_id, planBlockTrackers]);

  React.useEffect(() => {
    if (!paymentStatus || paymentStatus.status !== 'succeeded') return;
    setSearchParams((params) => {
      params.delete('payment_id');
      return params;
    }, { replace: true });
  }, [paymentStatus, setSearchParams]);

  return (
    <div className="home-page -m-4 min-h-screen bg-[#030A12] p-4 pt-8 text-slate-100 md:-m-8 md:p-8 md:pt-12">
      <div className="mx-auto max-w-[1232px] space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<CheckCircle2 size={18} />}
            tone="mint"
            label="Всего задач"
            subtitle="Выполнено"
            value={stats.total_solved.toString()}
            mutedValue={stats.total_tasks > 0 ? `${stats.total_tasks}` : undefined}
            caption={`${progress}% выполнено`}
            progress={progress}
            art="tasks"
          />
          <MetricCard
            icon={<Award size={18} />}
            tone="violet"
            label="Наград"
            subtitle="Получено"
            value={stats.current_streak.toString()}
            caption={stats.current_streak > 0 ? `${stats.current_streak} дней подряд` : 'Нет наград'}
            art="gift"
          />
          <MetricCard
            icon={<TrendingUp size={18} />}
            tone="green"
            label="Прогресс"
            subtitle="Общий прогресс"
            value={`${progress}%`}
            caption="Ваш общий прогресс"
            progress={progress}
            art="chart"
          />
          <MetricCard
            icon={<Star size={18} />}
            tone="amber"
            label="Баллы"
            subtitle="Всего баллов"
            value={Math.round(latestExamScore).toString()}
            caption={latestExamScore > 0 ? 'Отличная работа!' : 'Решите вариант'}
            art="cup"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_395px]">
          <div className="space-y-6">
            {paymentId && paymentStatus?.status !== 'succeeded' && (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                Проверяем оплату. Доступ откроется автоматически после подтверждения ЮKassa.
              </div>
            )}
            {currentPlan?.subscription_required ? (
              <SubscriptionOfferCard />
            ) : (
              <PreparationPlanCard
                currentPlan={currentPlan}
                plans={plans ?? []}
                selectedPlanId={selectedPlanId}
                durationDays={durationDays}
                planBlockTrackers={planBlockTrackers}
                isSelecting={selectPlan.isPending}
                activeBlockId={effectiveActiveBlockId}
                onPlanChange={(planId) => {
                  setSelectedPlanId(planId);
                  const plan = plans?.find((item) => item.id === planId);
                  if (plan) setDurationDays(plan.default_duration_days);
                }}
                onDurationChange={setDurationDays}
                onSelectPlan={(planId, days) => selectPlan.mutate({
                  plan_id: Number(planId ?? selectedPlanId),
                  duration_days: days ?? durationDays,
                })}
                onActiveBlockChange={(blockId) => {
                  setLocalActiveBlockId(blockId);
                  if (activeBlockStorageKey) {
                    localStorage.setItem(activeBlockStorageKey, String(blockId));
                  }
                  updateActiveBlock.mutate({ block_id: blockId });
                }}
              />
            )}

            <ActivityCard
              weeklyDays={weeklyDays}
              weeklyTotal={weeklyTotal}
              weeklyAverage={weeklyAverage}
            />
          </div>

          <PerformanceCard scores={examScores} />
        </div>
      </div>
    </div>
  );
}

function buildScorePoints(topics: TopicNav[]): ExamScorePoint[] {
  return topics.map((topic) => {
    const isMock = topic.category === TopicCategory.mock;
    const score = isMock && !topic.analysis_published
      ? null
      : topic.latest_score ?? (!isMock ? topic.current_score ?? null : null);

    return {
      id: topic.id,
      name: topic.title,
      score,
      isPendingReview: isMock && topic.latest_score != null && !topic.analysis_published,
    };
  });
}

function isExamStarted(topic: TopicNav) {
  return (
    topic.latest_score != null
    || topic.current_score != null
    || (topic.draft_count ?? 0) > 0
  );
}

function buildPlanBlockTrackers(
  blocks: PlanBlockProgressItem[],
  topics: TopicNav[],
  currentBlockId?: number | null,
): PlanBlockTracker[] {
  return blocks
    .map((block) => ({
      blockId: block.block_id,
      title: block.title,
      estimatedScore: block.estimated_score ?? 0,
      includesVariant: block.includes_variant ?? false,
      isDone: block.is_done ?? false,
      isCurrent: block.block_id === currentBlockId,
      tasks: [
        ...(block.task_progress?.length
          ? block.task_progress.map((task) => ({
            taskId: task.task_id,
            label: task.label,
            solved: task.solved,
            total: task.total,
            percent: task.percent,
            href: buildTaskHref(task.task_id, topics),
          }))
          : buildPlanTaskProgress(block.ege_numbers, topics)),
        ...buildPlanControlProgress(block.control_topic_id, topics),
      ],
    }))
    .map((block) => {
      const totalTasks = block.tasks.reduce((sum, task) => sum + Math.max(task.total, 0), 0);
      const solvedTasks = block.tasks.reduce((sum, task) => sum + Math.max(task.solved, 0), 0);
      return {
        ...block,
        solved: solvedTasks,
        requiredSolvedCount: totalTasks,
        progressPercent: totalTasks > 0 ? Math.min(100, Math.round((solvedTasks / totalTasks) * 100)) : 0,
      };
    })
    .filter((block) => block.tasks.length > 0);
}

function buildTaskHref(taskId: number, topics: TopicNav[]): string | undefined {
  const topic = topics.find((item) => item.tasks.some((task) => task.id === taskId));
  if (!topic) return undefined;
  const basePath = topic.category === TopicCategory.homework ? '/homework' : '/tasks';
  return `${basePath}/${topic.id}?task=${taskId}&from=home`;
}

function getDaysUntilEge2026() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.ceil((EGE_2026_DATE.getTime() - todayStart.getTime()) / 86_400_000));
}

function buildPlanControlProgress(controlTopicId: number | null | undefined, topics: TopicNav[]): PlanTaskProgress[] {
  if (!controlTopicId) return [];
  const topic = topics.find((item) => item.id === controlTopicId);
  if (!topic) {
    return [{
      taskId: controlTopicId,
      label: 'Контрольная работа',
      solved: 0,
      total: 1,
      percent: 0,
      href: `/exams/${controlTopicId}`,
      statusText: 'не пройдена',
    }];
  }

  const score = topic.latest_score ?? topic.current_score ?? null;
  const percent = score == null ? 0 : Math.min(100, Math.max(0, Math.round(score)));
  const primaryScore = topic.latest_primary_score ?? topic.current_primary_score ?? null;
  const maxScore = topic.max_score ?? topic.tasks.length;

  return [{
    taskId: topic.id,
    label: topic.title,
    solved: primaryScore ?? (percent >= 100 ? 1 : 0),
    total: primaryScore != null ? maxScore : 1,
    percent,
    href: `/exams/${topic.id}`,
    statusText: score == null ? 'контрольная работа' : `${percent}%`,
  }];
}

function buildPlanTaskProgress(egeNumbers: number[], topics: TopicNav[]): PlanTaskProgress[] {
  const uniqueNumbers = Array.from(new Set(egeNumbers.filter((num): num is number => Number.isFinite(num))));
  const planGroups: { id: number; label: string; numbers: number[] }[] = [];
  const numberSet = new Set(uniqueNumbers);
  for (const num of uniqueNumbers) {
    if (num === 19 && numberSet.has(20) && numberSet.has(21)) {
      planGroups.push({ id: 19, label: '№19-21', numbers: [19, 20, 21] });
      continue;
    }
    if ((num === 20 || num === 21) && numberSet.has(19) && numberSet.has(20) && numberSet.has(21)) {
      continue;
    }
    planGroups.push({ id: num, label: `№${num}`, numbers: [num] });
  }

  const learningTasks = topics
      .filter((topic) => topic.category === TopicCategory.tutorial || topic.category === TopicCategory.homework)
      .flatMap((topic) => topic.tasks.map((task) => ({ task, topic })));

  return planGroups.map((group) => {
    const tasks = learningTasks.filter((task) =>
      group.numbers.some((number) => isTaskForEgeNumber(task.task, number, task.topic)),
    );
    const solved = tasks.filter(({ task }) => task.status === 'solved').length;
    const total = tasks.length;
    const firstTask = tasks[0]?.task;

    return {
      taskId: group.id,
      label: group.label,
      solved,
      total,
      percent: total > 0 ? Math.round((solved / total) * 100) : 0,
      href: firstTask ? buildTaskHref(firstTask.id, topics) : '/tasks',
    };
  });
}

function isTaskForEgeNumber(task: TopicNav['tasks'][number], egeNumber: number, topic?: TopicNav) {
  const minNumber = task.ege_number ?? topic?.ege_number;
  const maxNumber = task.ege_number_max ?? task.ege_number ?? topic?.ege_number_end ?? topic?.ege_number;
  if (minNumber == null || maxNumber == null) return false;
  return egeNumber >= Math.min(minNumber, maxNumber) && egeNumber <= Math.max(minNumber, maxNumber);
}

function MetricCard({
  icon,
  tone,
  label,
  subtitle,
  value,
  mutedValue,
  caption,
  progress,
  art,
}: {
  icon: React.ReactNode;
  tone: 'mint' | 'violet' | 'green' | 'amber';
  label: string;
  subtitle: string;
  value: string;
  mutedValue?: string;
  caption: string;
  progress?: number;
  art: 'tasks' | 'gift' | 'chart' | 'cup';
}) {
  const toneClass = metricToneClasses[tone];
  const safeProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <div className="home-metric-card relative h-[164px] overflow-hidden rounded-[16px] border border-white/10 bg-[#0A1522] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.03]">
      <div className={`absolute -bottom-12 -right-10 h-32 w-32 rounded-full blur-2xl ${toneClass.glow}`} />
      <MetricArt type={art} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass.iconBg}`}>
              <span className={toneClass.iconText}>{icon}</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-5 text-slate-100">{label}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
            </div>
          </div>
          <MoreHorizontal size={18} className="mt-1 shrink-0 text-slate-600" />
        </div>

        <div className="mt-5 max-w-[150px]">
          <div className="flex items-end gap-2">
            <span className="text-[32px] font-bold leading-none tracking-normal text-white">{value}</span>
            {mutedValue && (
              <span className="pb-0.5 text-base font-bold text-slate-500">/ {mutedValue}</span>
            )}
          </div>
          <p className={`mt-2 truncate text-xs font-semibold ${toneClass.accentText}`}>{caption}</p>
        </div>

        {progress != null && (
          <div className="mt-3 h-2 max-w-[126px] overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${toneClass.progress}`}
              style={{ width: `${safeProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const metricToneClasses = {
  mint: {
    iconBg: 'bg-emerald-400/15',
    iconText: 'text-emerald-300',
    accentText: 'text-emerald-300',
    progress: 'bg-[#14C9A0]',
    pill: 'bg-[#E5FBF4] text-[#11B889]',
    glow: 'bg-emerald-500/25',
  },
  violet: {
    iconBg: 'bg-violet-400/15',
    iconText: 'text-violet-300',
    accentText: 'text-violet-300',
    progress: 'bg-[#7C4DFF]',
    pill: 'bg-[#F0EBFF] text-[#7251E8]',
    glow: 'bg-violet-500/25',
  },
  green: {
    iconBg: 'bg-green-400/15',
    iconText: 'text-green-300',
    accentText: 'text-green-300',
    progress: 'bg-[#64C83D]',
    pill: 'bg-[#E8F8E4] text-[#42B326]',
    glow: 'bg-green-500/25',
  },
  amber: {
    iconBg: 'bg-amber-400/15',
    iconText: 'text-amber-300',
    accentText: 'text-amber-300',
    progress: 'bg-[#FFAE25]',
    pill: 'bg-[#FFF3E4] text-[#F28B00]',
    glow: 'bg-amber-500/25',
  },
};

function MetricArt({ type }: { type: 'tasks' | 'gift' | 'chart' | 'cup' }) {
  const art = {
    tasks: metricTasks,
    gift: metricGift,
    chart: metricChart,
    cup: metricCup,
  }[type];
  const sizeClass = type === 'chart'
    ? 'h-[102px] w-[112px]'
    : 'h-[100px] w-[100px]';

  return (
    <div className="pointer-events-none absolute bottom-0 right-1 z-0 flex h-[112px] w-[112px] items-end justify-end overflow-hidden" aria-hidden="true">
      <img
        src={art}
        alt=""
        loading="eager"
        draggable={false}
        className={`${sizeClass} object-contain object-bottom drop-shadow-[0_10px_18px_rgba(15,23,42,0.06)]`}
      />
    </div>
  );
}

function SubscriptionOfferCard() {
  const createCheckout = useCreateCheckout();
  const handleCheckout = async (plan: 'summer' | 'year') => {
    const checkout = await createCheckout.mutateAsync({ plan });
    window.location.assign(checkout.confirmation_url);
  };
  const features = [
    { icon: FileText, title: 'Все задания ЕГЭ', text: 'Актуальные задачи с решениями' },
    { icon: Brain, title: 'ИИ-ассистент', text: 'Помощь в решении и объяснения' },
    { icon: Route, title: 'Планы подготовки', text: 'Персональные маршруты' },
    { icon: Save, title: 'Сохранение решений', text: 'Все твои решения в одном месте' },
    { icon: PlaySquare, title: 'Разборы и теория', text: 'Подробные разборы и материалы' },
    { icon: ListChecks, title: 'Варианты ЕГЭ', text: 'Тренируйся на реальных вариантах' },
  ];

  return (
    <Panel className="relative overflow-hidden !rounded-[24px] !border-emerald-300/20 !bg-[#030B12] !p-0 shadow-[0_28px_80px_rgba(0,0,0,0.42),0_0_70px_rgba(16,185,129,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(16,185,129,0.14),transparent_30%),linear-gradient(135deg,rgba(3,11,18,0.98),rgba(2,32,24,0.68))]" />
      <div className="relative p-6 md:p-7">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
          <div className="min-w-0">
            <h2 className="text-[34px] font-black leading-none tracking-tight text-white sm:text-[40px]">
              Lite <span className="text-emerald-300">Access</span>
            </h2>
            <p className="mt-3 max-w-[360px] text-[13px] leading-5 text-slate-400">
              Полный доступ к задачам, ИИ и инструментам подготовки.
            </p>
          </div>

          <div className="min-w-0 md:text-right">
            <div className="flex items-center gap-3 md:justify-end">
              <div className="text-[34px] font-black leading-none tracking-tight text-emerald-300">990 ₽</div>
              <div className="inline-flex rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                -84%
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-[11px] leading-4 md:justify-end">
              <span className="font-bold text-slate-500 line-through">6 240 ₽</span>
              <span className="font-semibold text-slate-400">цена за один предмет в месяц в любой школе</span>
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-2">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-300/12 bg-emerald-400/[0.045] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-300">
                <Icon size={17} />
              </div>
              <div className="min-w-0 truncate text-[13px] leading-5">
                <span className="font-black text-white">{title}</span>
                <span className="font-semibold text-slate-400"> — {text}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={createCheckout.isPending}
          onClick={() => handleCheckout('year')}
          className="mt-7 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#00140d] shadow-[0_18px_42px_rgba(16,185,129,0.32)] transition hover:bg-emerald-300 disabled:opacity-70"
        >
          {createCheckout.isPending ? 'Готовим оплату...' : 'Получить доступ'}
          <Zap size={18} />
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <LockKeyhole size={14} />
          <span>Доступ активируется сразу после оплаты.</span>
        </div>
      </div>
    </Panel>
  );
}

function SubscriptionOption({
  title,
  description,
  plan,
  accent,
  actionLabel,
  footnote,
  onAction,
  isBusy = false,
}: {
  title: string;
  description: string;
  plan?: NonNullable<ReturnType<typeof usePreparationPlans>['data']>[number];
  accent: 'emerald' | 'violet';
  actionLabel: string;
  footnote?: string;
  onAction?: () => void;
  isBusy?: boolean;
}) {
  const isEmerald = accent === 'emerald';
  const actionClassName = clsx(
    "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition",
    isEmerald ? "bg-emerald-500 hover:bg-emerald-400" : "bg-violet-500 hover:bg-violet-400",
  );
  return (
    <div className={clsx(
      "rounded-2xl border p-5",
      isEmerald
        ? "border-emerald-300/18 bg-emerald-400/[0.07]"
        : "border-violet-300/18 bg-violet-400/[0.07]",
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-5 text-slate-400">{description}</p>
        </div>
        <span className={clsx(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1",
          isEmerald ? "bg-emerald-400/12 text-emerald-200 ring-emerald-300/20" : "bg-violet-400/12 text-violet-200 ring-violet-300/20",
        )}>
          {plan ? `${plan.blocks.length} блок.` : 'скоро'}
        </span>
      </div>
      <button type="button" disabled={isBusy} onClick={onAction} className={clsx(actionClassName, isBusy && "opacity-70")}>
        {isBusy ? "Готовим оплату..." : actionLabel}
        <ChevronRight size={16} />
      </button>
      {footnote && <p className="mt-2 text-xs font-semibold text-slate-500">{footnote}</p>}
    </div>
  );
}

function PreparationPlanCard({
  currentPlan,
  plans,
  selectedPlanId,
  durationDays,
  planBlockTrackers,
  isSelecting,
  activeBlockId,
  onPlanChange,
  onDurationChange,
  onSelectPlan,
  onActiveBlockChange,
}: {
  currentPlan: ReturnType<typeof useCurrentPreparationPlan>['data'];
  plans: NonNullable<ReturnType<typeof usePreparationPlans>['data']>;
  selectedPlanId: number | '';
  durationDays: number;
  planBlockTrackers: PlanBlockTracker[];
  isSelecting: boolean;
  activeBlockId: number | null;
  onPlanChange: (planId: number) => void;
  onDurationChange: (days: number) => void;
  onSelectPlan: (planId?: number, durationDays?: number) => void;
  onActiveBlockChange: (blockId: number) => void;
}) {
  const [activeBlockIndex, setActiveBlockIndex] = React.useState(0);
  const [showPlanPicker, setShowPlanPicker] = React.useState(false);
  const createCheckout = useCreateCheckout();
  const syncLatestPayment = useSyncLatestPayment(false);
  const summerPlan = plans.find((plan) => plan.course_type === 'summer');
  const yearlyPlan = plans.find((plan) => plan.course_type !== 'summer');
  const currentSubscription = currentPlan?.subscription_plan ?? 'none';
  const applyPlan = (plan?: NonNullable<ReturnType<typeof usePreparationPlans>['data']>[number]) => {
    if (!plan) return;
    onPlanChange(plan.id);
    onDurationChange(plan.default_duration_days);
    onSelectPlan(plan.id, plan.default_duration_days);
    setShowPlanPicker(false);
  };
  const handlePlanAction = async (plan?: NonNullable<ReturnType<typeof usePreparationPlans>['data']>[number]) => {
    if (!plan) return;
    const requiredSubscription = plan.course_type === 'summer' ? 'summer' : 'year';
    const hasAccess = currentSubscription === 'year' || currentSubscription === requiredSubscription;
    if (hasAccess) {
      applyPlan(plan);
      return;
    }
    const syncedPayment = await syncLatestPayment.refetch();
    const syncedPlan = syncedPayment.data?.payment?.subscription_plan;
    if (syncedPlan === 'year' || syncedPlan === requiredSubscription) {
      applyPlan(plan);
      return;
    }
    const checkout = await createCheckout.mutateAsync({ plan: requiredSubscription });
    window.location.assign(checkout.confirmation_url);
  };

  React.useEffect(() => {
    if (!planBlockTrackers.length) {
      setActiveBlockIndex(0);
      return;
    }

    const currentBlockIndex = planBlockTrackers.findIndex((block) => block.isCurrent);
    const savedBlockIndex = activeBlockId == null
      ? -1
      : planBlockTrackers.findIndex((block) => block.blockId === activeBlockId);
    const fallbackIndex = currentBlockIndex >= 0 ? currentBlockIndex : 0;
    const nextIndex = savedBlockIndex >= 0 ? savedBlockIndex : fallbackIndex;

    setActiveBlockIndex(nextIndex);
  }, [activeBlockId, planBlockTrackers]);

  if (!currentPlan?.plan) {
    return (
      <Panel className="min-h-[210px]">
        <div className="flex h-full flex-col justify-between gap-6">
          <div>
            <h2 className="text-lg font-bold text-white">План подготовки</h2>
            <p className="mt-2 max-w-[720px] text-sm leading-6 text-slate-400">
              Выберите цель и срок, чтобы сайт подсказал, что решать каждый день.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={selectedPlanId}
              onChange={(event) => onPlanChange(Number(event.target.value))}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-[#07111D] px-3 text-sm text-white outline-none focus:border-emerald-400"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.title}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={durationDays}
              onChange={(event) => onDurationChange(Number(event.target.value))}
              className="h-11 rounded-xl border border-white/10 bg-[#07111D] px-3 text-sm text-white outline-none focus:border-emerald-400 md:w-28"
              aria-label="Срок подготовки в днях"
            />
            <button
              onClick={onSelectPlan}
              disabled={!selectedPlanId || isSelecting}
              className="h-11 rounded-xl bg-[#05C96A] px-5 text-sm font-bold text-white transition hover:bg-[#04B960] disabled:opacity-50"
            >
              Подобрать
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  const daysUntilEge = getDaysUntilEge2026();

  return (
    <Panel className="min-h-[210px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="text-lg font-bold leading-none text-white">План подготовки</h2>
          <button
            type="button"
            onClick={() => setShowPlanPicker((value) => !value)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-emerald-100"
          >
            {showPlanPicker ? 'Скрыть' : 'Изменить'}
          </button>
        </div>
        <div className="flex shrink-0 items-baseline gap-3 pt-0.5 text-right">
          <p className="text-xs font-semibold text-slate-500">До ЕГЭ 2026</p>
          <p className="text-sm font-extrabold text-emerald-300">{daysUntilEge} дн.</p>
        </div>
      </div>

      {showPlanPicker && (
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-sm font-bold text-white">
          Изменить план
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SubscriptionOption
            title="Летний курс"
            description="Короткий интенсив с отдельным набором заданий."
            plan={summerPlan}
            accent="emerald"
            actionLabel={currentSubscription === 'summer' || currentSubscription === 'year' ? 'Выбрать летний' : 'Оплатить 990 ₽'}
            footnote={currentSubscription === 'summer' || currentSubscription === 'year' ? undefined : 'Позже цена будет 1990 ₽'}
            onAction={() => handlePlanAction(summerPlan)}
            isBusy={isSelecting || createCheckout.isPending}
          />
          <SubscriptionOption
            title="Годовой курс"
            description="Полный план подготовки и все материалы платформы."
            plan={yearlyPlan}
            accent="violet"
            actionLabel={currentSubscription === 'year' ? 'Выбрать годовой' : 'Оплатить 990 ₽/мес'}
            footnote={currentSubscription === 'year' ? undefined : 'Позже цена будет 1490 ₽/мес'}
            onAction={() => handlePlanAction(yearlyPlan)}
            isBusy={isSelecting || createCheckout.isPending}
          />
        </div>
        <div className="hidden">
          <select
            value={selectedPlanId}
            onChange={(event) => onPlanChange(Number(event.target.value))}
            className="h-11 flex-1 rounded-xl border border-white/10 bg-[#07111D] px-3 text-sm text-white outline-none focus:border-emerald-400"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.course_type === 'summer' ? 'Летний курс - ' : 'Годовой курс - '}
                {plan.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(event) => onDurationChange(Number(event.target.value))}
            className="h-11 rounded-xl border border-white/10 bg-[#07111D] px-3 text-sm text-white outline-none focus:border-emerald-400 md:w-28"
            aria-label="Срок подготовки в днях"
          />
          <button
            type="button"
            onClick={() => {
              onSelectPlan();
              setShowPlanPicker(false);
            }}
            disabled={!selectedPlanId || isSelecting}
            className="h-11 rounded-xl bg-[#05C96A] px-5 text-sm font-bold text-white transition hover:bg-[#04B960] disabled:opacity-50"
          >
            {isSelecting ? 'Меняем...' : 'Применить'}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          При смене плана текущий маршрут будет заменён новым, прогресс по уже решённым задачам сохранится.
        </p>
      </div>
      )}

      {planBlockTrackers.length > 0 && (
        <div className="mt-5">
          <PlanBlockCarousel
            blocks={planBlockTrackers}
            activeIndex={activeBlockIndex}
            onSelect={(index) => {
              setActiveBlockIndex(index);
              const block = planBlockTrackers[index];
              if (block) onActiveBlockChange(block.blockId);
            }}
          />
        </div>
      )}
    </Panel>
  );
}

function ActivityCard({
  weeklyDays,
  weeklyTotal,
  weeklyAverage,
}: {
  weeklyDays: { day: string; solved: number }[];
  weeklyTotal: number;
  weeklyAverage: number;
}) {
  return (
    <Panel className="min-h-[326px]">
      <h2 className="text-lg font-bold text-white">Активность за неделю</h2>
      <p className="mt-2 text-sm text-slate-400">
        {weeklyTotal} задач · ср. {weeklyAverage}/день
      </p>

      <div className="mt-6 h-[210px]">
        {weeklyDays.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyDays} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#05C96A" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#05C96A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="transparent" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                dy={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
              />
              <Tooltip content={<ActivityTooltip />} />
              <Area
                type="monotone"
                dataKey="solved"
                stroke="#28D96F"
                strokeWidth={2}
                fill="url(#activityFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#28D96F', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Нет данных за неделю
          </div>
        )}
      </div>
    </Panel>
  );
}

function PerformanceCard({ scores }: { scores: ExamScorePoint[] }) {
  const completed = scores.filter((score) => score.score != null && score.score > 0);
  const pending = scores.filter((score) => score.isPendingReview);

  return (
    <Panel className="min-h-[334px]">
      <h2 className="text-lg font-bold text-white">Успеваемость</h2>
      <p className="mt-2 text-sm text-slate-400">Реальные баллы по вариантам и пробникам</p>

      {completed.length > 0 ? (
        <div className="mt-7 space-y-6">
          {completed.slice(-6).map((item) => (
            <Link key={item.id} to={`/exams/${item.id}`} className="block">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 truncate text-base font-bold text-slate-100" title={item.name}>
                  {item.name}
                </span>
                <span className="text-sm text-slate-400">{Math.round(item.score ?? 0)}/100</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#05C96A]"
                  style={{ width: `${Math.min(100, Math.max(0, item.score ?? 0))}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
          Информация появится после решения варианта. По пробникам результат появится после проверки.
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-6 rounded-2xl bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200">
          {pending.length} пробник(ов) ожидает проверки
        </div>
      )}
    </Panel>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`home-panel rounded-[16px] border border-white/10 bg-[#0A1522] p-6 shadow-[0_18px_42px_rgba(0,0,0,0.25)] ${className}`}>
      {children}
    </section>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function PlanBlockCarousel({
  blocks,
  activeIndex,
  onSelect,
}: {
  blocks: PlanBlockTracker[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <div className="relative h-[520px] overflow-hidden rounded-2xl">
        {blocks.map((block, index) => {
          const offset = index - activeIndex;
          const isActive = offset === 0;
          const isVisible = Math.abs(offset) <= 1;
          const cardStyle: React.CSSProperties = {
            transform: `translateX(calc(-50% + ${offset * 76}%)) scale(${isActive ? 1 : 0.94})`,
            opacity: isVisible ? (isActive ? 1 : 0.76) : 0,
            zIndex: isActive ? 20 : 10 - Math.abs(offset),
            pointerEvents: isVisible ? 'auto' : 'none',
          };

          return (
            <div
              key={block.title}
              role={isActive ? undefined : 'button'}
              tabIndex={isActive ? undefined : 0}
              onClick={isActive ? undefined : () => onSelect(index)}
              onKeyDown={
                isActive
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(index);
                      }
                    }
              }
              className={`absolute left-1/2 top-0 h-full w-[86%] max-w-[340px] rounded-[18px] text-left transition-all duration-300 ease-out sm:w-[54%] ${
                isActive ? '' : 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#05C96A]'
              }`}
              style={cardStyle}
              aria-label={`Открыть блок ${block.title}`}
            >
              <PlanBlockTrackerSection block={block} compact={!isActive} active={isActive} toneIndex={index} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {blocks.map((block, index) => (
          <button
            key={block.title}
            type="button"
            onClick={() => onSelect(index)}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex ? 'w-5 bg-[#05C96A]' : 'w-2 bg-white/15 hover:bg-white/30'
            }`}
            aria-label={`Перейти к блоку ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function PlanBlockTrackerSection({
  block,
  compact = false,
  active = false,
  toneIndex = 0,
}: {
  block: PlanBlockTracker;
  compact?: boolean;
  active?: boolean;
  toneIndex?: number;
}) {
  const { theme } = useTheme();
  const tones = theme === 'light' ? lightPlanBlockToneClasses : planBlockToneClasses;
  const tone = tones[toneIndex % tones.length];
  const primaryHref = block.tasks.find((item) => item.href)?.href ?? '/tasks';

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-[18px] border px-4 py-5 transition-colors ${
        active ? 'ring-2 ring-black/5' : ''
      }`}
      style={{
        background: active ? tone.activeBackground : tone.background,
        borderColor: active ? tone.activeBorder : tone.border,
        boxShadow: active
          ? `0 14px 34px ${tone.shadow}, 0 0 0 1px ${tone.activeBorder}`
          : '0 10px 26px rgba(15,23,42,0.08)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-2xl"
        style={{ background: tone.glow }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full blur-3xl"
        style={{ background: tone.secondaryGlow }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <h4 className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-6 text-white" title={block.title}>
          {block.title}
        </h4>
        {block.estimatedScore > 0 && (
          <span
            className="shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-extrabold shadow-[0_8px_18px_rgba(15,23,42,0.10)]"
            style={{ background: tone.scoreBg, color: tone.accent }}
          >
            {block.estimatedScore} балл
          </span>
        )}
      </div>
      <div className="relative z-10 mt-4">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
          <span>{block.solved} из {block.requiredSolvedCount || block.tasks.length} решено</span>
          <span>{block.progressPercent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${block.progressPercent}%`, background: tone.accent }}
          />
        </div>
      </div>

      <div className="relative z-10 mt-5 min-h-0 flex-1 space-y-2 overflow-visible">
        {block.tasks.map((item, taskIndex) => (
          <PlanTaskTrackerItem
            key={item.taskId}
            item={item}
            disabled={compact}
            accent={taskAccentColors[(toneIndex + taskIndex) % taskAccentColors.length]}
          />
        ))}
      </div>

      <Link
        to={primaryHref}
        className="home-action-button relative z-10 mt-4 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(15,23,42,0.10)] transition hover:translate-y-[-1px]"
        style={{ background: tone.buttonBg }}
      >
        {active ? 'Продолжить подготовку' : 'Перейти к блоку'}
        <ChevronRight size={17} strokeWidth={2.6} />
      </Link>
    </div>
  );
}

const planBlockToneClasses = [
  {
    background: 'linear-gradient(135deg, rgba(9,40,31,0.94) 0%, rgba(13,27,42,0.98) 56%, rgba(8,16,28,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(11,74,48,0.96) 0%, rgba(10,35,43,0.98) 54%, rgba(8,19,30,0.98) 100%)',
    border: 'rgba(52,211,153,0.24)',
    activeBorder: '#34D399',
    accent: '#34D399',
    scoreBg: 'rgba(52,211,153,0.16)',
    buttonBg: 'linear-gradient(135deg, #20C46C 0%, #0EA95B 100%)',
    glow: 'rgba(5,201,106,0.24)',
    secondaryGlow: 'rgba(89,197,255,0.18)',
    shadow: 'rgba(5,201,106,0.18)',
  },
  {
    background: 'linear-gradient(135deg, rgba(55,35,12,0.94) 0%, rgba(32,22,28,0.98) 55%, rgba(8,16,28,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(88,52,12,0.96) 0%, rgba(42,24,31,0.98) 55%, rgba(10,18,30,0.98) 100%)',
    border: 'rgba(251,191,36,0.24)',
    activeBorder: '#F59E0B',
    accent: '#F59E0B',
    scoreBg: 'rgba(245,158,11,0.16)',
    buttonBg: 'linear-gradient(135deg, #FFB21A 0%, #FF8A00 100%)',
    glow: 'rgba(255,149,26,0.24)',
    secondaryGlow: 'rgba(255,111,166,0.16)',
    shadow: 'rgba(242,139,0,0.18)',
  },
  {
    background: 'linear-gradient(135deg, rgba(40,24,78,0.94) 0%, rgba(14,31,50,0.98) 55%, rgba(8,16,28,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(70,38,135,0.96) 0%, rgba(18,42,64,0.98) 55%, rgba(10,18,31,0.98) 100%)',
    border: 'rgba(167,139,250,0.26)',
    activeBorder: '#8B5CF6',
    accent: '#A78BFA',
    scoreBg: 'rgba(139,92,246,0.18)',
    buttonBg: 'linear-gradient(135deg, #78A0FF 0%, #4E6CFF 100%)',
    glow: 'rgba(124,77,255,0.22)',
    secondaryGlow: 'rgba(58,190,255,0.16)',
    shadow: 'rgba(124,77,255,0.18)',
  },
  {
    background: 'linear-gradient(135deg, rgba(30,52,21,0.94) 0%, rgba(48,36,12,0.92) 54%, rgba(8,16,28,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(44,88,28,0.96) 0%, rgba(71,52,14,0.94) 54%, rgba(9,18,30,0.98) 100%)',
    border: 'rgba(132,204,22,0.24)',
    activeBorder: '#84CC16',
    accent: '#A3E635',
    scoreBg: 'rgba(132,204,22,0.15)',
    buttonBg: 'linear-gradient(135deg, #9B7AF0 0%, #7154D9 100%)',
    glow: 'rgba(100,200,61,0.22)',
    secondaryGlow: 'rgba(255,214,72,0.18)',
    shadow: 'rgba(100,200,61,0.18)',
  },
];

const lightPlanBlockToneClasses = [
  {
    background: 'linear-gradient(135deg, rgba(244,253,248,0.98) 0%, rgba(234,247,240,0.98) 56%, rgba(255,255,255,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(226,248,237,0.98) 0%, rgba(242,251,246,0.98) 54%, rgba(255,255,255,0.98) 100%)',
    border: 'rgba(63,140,98,0.18)',
    activeBorder: '#16A765',
    accent: '#158354',
    scoreBg: 'rgba(22,167,101,0.12)',
    buttonBg: 'linear-gradient(135deg, #20C46C 0%, #0EA95B 100%)',
    glow: 'rgba(22,167,101,0.14)',
    secondaryGlow: 'rgba(89,197,255,0.10)',
    shadow: 'rgba(22,167,101,0.12)',
  },
  {
    background: 'linear-gradient(135deg, rgba(255,250,238,0.98) 0%, rgba(255,246,229,0.98) 55%, rgba(255,255,255,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(255,243,216,0.98) 0%, rgba(255,249,236,0.98) 55%, rgba(255,255,255,0.98) 100%)',
    border: 'rgba(217,119,6,0.18)',
    activeBorder: '#D97706',
    accent: '#B45309',
    scoreBg: 'rgba(217,119,6,0.12)',
    buttonBg: 'linear-gradient(135deg, #FFB21A 0%, #E98500 100%)',
    glow: 'rgba(217,119,6,0.12)',
    secondaryGlow: 'rgba(255,111,166,0.08)',
    shadow: 'rgba(217,119,6,0.10)',
  },
  {
    background: 'linear-gradient(135deg, rgba(248,245,255,0.98) 0%, rgba(240,247,255,0.98) 55%, rgba(255,255,255,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(241,235,255,0.98) 0%, rgba(236,247,255,0.98) 55%, rgba(255,255,255,0.98) 100%)',
    border: 'rgba(124,77,255,0.18)',
    activeBorder: '#6D5BD0',
    accent: '#5B4BB7',
    scoreBg: 'rgba(109,91,208,0.12)',
    buttonBg: 'linear-gradient(135deg, #78A0FF 0%, #4E6CFF 100%)',
    glow: 'rgba(109,91,208,0.12)',
    secondaryGlow: 'rgba(58,190,255,0.08)',
    shadow: 'rgba(109,91,208,0.10)',
  },
  {
    background: 'linear-gradient(135deg, rgba(247,252,238,0.98) 0%, rgba(255,250,232,0.98) 54%, rgba(255,255,255,0.98) 100%)',
    activeBackground: 'linear-gradient(135deg, rgba(239,250,218,0.98) 0%, rgba(255,247,221,0.98) 54%, rgba(255,255,255,0.98) 100%)',
    border: 'rgba(101,163,13,0.18)',
    activeBorder: '#65A30D',
    accent: '#4D7C0F',
    scoreBg: 'rgba(101,163,13,0.12)',
    buttonBg: 'linear-gradient(135deg, #8B74E8 0%, #6550CC 100%)',
    glow: 'rgba(101,163,13,0.12)',
    secondaryGlow: 'rgba(255,214,72,0.08)',
    shadow: 'rgba(101,163,13,0.10)',
  },
];

const taskAccentColors = ['#56C6F6', '#54D879', '#FFBF4B', '#A989F7', '#FF758F'];

function PlanTaskTrackerItem({
  item,
  disabled = false,
  accent,
}: {
  item: PlanTaskProgress;
  disabled?: boolean;
  accent: string;
}) {
  const color = getPlanTaskColor(item.percent);
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-100">{item.label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {item.statusText ?? (item.total > 0 ? `${item.solved}/${item.total} решено` : 'нет задач')}
        </p>
      </div>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${color}`}>
        {item.percent}%
      </div>
    </>
  );

  if (disabled) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.16)] backdrop-blur-sm"
        style={{ borderLeft: `4px solid ${accent}` }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={item.href ?? '/tasks'}
      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.16)] backdrop-blur-sm transition hover:bg-white/[0.10]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      {content}
    </Link>
  );
}

function getPlanTaskColor(percent: number) {
  if (percent <= 0) return 'border-white/10 bg-white/[0.06] text-slate-400';
  if (percent < 40) return 'border-red-400/30 bg-red-500/15 text-red-200';
  if (percent < 70) return 'border-amber-400/30 bg-amber-500/15 text-amber-200';
  return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200';
}

function ActivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1623] px-3 py-2 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.28)]">
      <p className="font-bold text-white">{label}</p>
      <p className="text-slate-400">{payload[0].value} задач</p>
    </div>
  );
}
