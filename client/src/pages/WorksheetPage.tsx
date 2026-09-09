import { useEffect, useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { SubTask, TaskOut } from "../api/types";
import TaskView from "../components/TaskView";
import { useNavigation } from "../hooks/useApi";
import "./WorksheetPage.css";

function AnswerSpace({ subTask }: { subTask?: SubTask }) {
  const isTable = subTask?.answer_type === "table";
  const rows = Math.max(1, subTask?.table?.rows ?? 2);
  const cols = Math.max(1, subTask?.table?.cols ?? 2);

  if (isTable) {
    return (
      <div className="worksheet-answer-block">
        <span className="worksheet-answer-label">Ответ:</span>
        <table className="worksheet-answer-table" aria-label="Поле для ответа">
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: cols }, (_, col) => <td key={col} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="worksheet-answer-line">
      <span>Ответ:</span>
      <span className="worksheet-answer-rule" />
    </div>
  );
}

function WorksheetTask({ task, index }: { task: TaskOut; index: number }) {
  const label = task.ege_number != null ? `№${task.ege_number}` : `№${index + 1}`;
  const content = task.content_html || task.description || "Условие не добавлено";

  return (
    <article className="worksheet-task">
      <div className="worksheet-task-heading">
        <span className="worksheet-task-index">{index + 1}</span>
        <div>
          <div className="worksheet-task-label">Задание {label}</div>
          {task.title && <div className="worksheet-task-title">{task.title}</div>}
        </div>
      </div>

      <TaskView content={content} files={task.media_resources?.files} />
      <AnswerSpace />

      {task.sub_tasks?.map((subTask, subIndex) => (
        <section className="worksheet-subtask" key={`${task.id}-${subIndex}`}>
          <div className="worksheet-subtask-title">
            {subTask.number != null ? `Задание №${subTask.number}` : `Часть ${subIndex + 2}`}
          </div>
          <TaskView content={subTask.content_html} />
          <AnswerSpace subTask={subTask} />
        </section>
      ))}
    </article>
  );
}

async function waitForPrintableContent() {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".worksheet-document img"));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  }));
}

export default function WorksheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const autoPrintStarted = useRef(false);
  const topicId = Number(id);
  const { data: topics, isLoading: navigationLoading } = useNavigation();
  const topic = topics?.find((item) => item.id === topicId);
  const printableTasks = useMemo(
    () => topic?.tasks.filter((task) => !task.is_locked) ?? [],
    [topic],
  );
  const taskQueries = useQueries({
    queries: printableTasks.map((task) => ({
      queryKey: ["task", task.id],
      queryFn: () => api<TaskOut>(`/tasks/${task.id}`),
      staleTime: 60_000,
    })),
  });
  const loading = navigationLoading || taskQueries.some((query) => query.isLoading);
  const failed = taskQueries.some((query) => query.isError);
  const tasks = taskQueries.flatMap((query) => query.data ? [query.data] : []);

  useEffect(() => {
    if (!topic) return;
    const previousTitle = document.title;
    document.title = `Рабочий лист — ${topic.title}`;
    return () => { document.title = previousTitle; };
  }, [topic]);

  useEffect(() => {
    if (!topic || loading || failed || tasks.length !== printableTasks.length || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    void waitForPrintableContent().then(() => {
      window.setTimeout(() => {
        if (document.querySelector(".worksheet-document")) window.print();
      }, 250);
    });
  }, [failed, loading, printableTasks.length, tasks.length, topic]);

  const printWorksheet = async () => {
    await waitForPrintableContent();
    window.print();
  };

  if (loading) {
    return (
      <main className="worksheet-state">
        <Loader2 className="worksheet-spinner" size={28} />
        <p>Готовим рабочий лист…</p>
      </main>
    );
  }

  if (!topic || !Number.isFinite(topicId)) {
    return <main className="worksheet-state"><p>Топик не найден.</p></main>;
  }

  if (failed) {
    return (
      <main className="worksheet-state">
        <p>Не удалось загрузить задания рабочего листа.</p>
        <button type="button" onClick={() => window.location.reload()}>Попробовать снова</button>
      </main>
    );
  }

  return (
    <main className="worksheet-page">
      <div className="worksheet-toolbar">
        <button type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} /> Назад
        </button>
        <span>В окне печати выберите «Сохранить как PDF»</span>
        <button type="button" className="worksheet-download-button" onClick={printWorksheet}>
          <Download size={17} /> Сохранить PDF
        </button>
      </div>

      <div className="worksheet-document">
        <header className="worksheet-cover">
          <div className="worksheet-brand">RanchEasy · Рабочий лист</div>
          <h1>{topic.title}</h1>
          <div className="worksheet-meta">
            <span>{topic.subject === "math" ? "Математика" : "Информатика"}</span>
            <span>{tasks.length} заданий</span>
          </div>
          <div className="worksheet-student-fields">
            <div>Ученик: <span /></div>
            <div>Дата: <span /></div>
          </div>
        </header>

        {tasks.length > 0 ? tasks.map((task, index) => (
          <WorksheetTask key={task.id} task={task} index={index} />
        )) : (
          <p className="worksheet-empty">В этом топике пока нет доступных заданий.</p>
        )}

        <footer className="worksheet-footer">RanchEasy · Подготовка к экзаменам</footer>
      </div>
    </main>
  );
}
