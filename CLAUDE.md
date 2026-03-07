# CLAUDE.md — Описание проекта Edu Platform

## Что это за проект

Образовательная платформа для подготовки к ЕГЭ по информатике. Учащиеся решают задачи, получают подсказки от ИИ-ассистента и проходят контрольные варианты с таймером. Авторизация через Telegram.

---

## Структура монорепозитория

```
infa_project/
├── client/          # React SPA (TypeScript + Vite)
├── server/          # FastAPI backend (Python)
├── TZ_backend.md    # Техническое задание — бэкенд
└── TZ_frontend.md   # Техническое задание — фронтенд
```

---

## Backend (`server/`)

### Стек
- **Python 3.10+**, FastAPI (async)
- **PostgreSQL** + SQLAlchemy 2.0 (async) + asyncpg
- **Alembic** — миграции
- **Pydantic v2** — валидация
- **JWT** (python-jose) + Telegram Login Widget — авторизация
- **httpx** — HTTP-клиент для запросов к LLM API

### Запуск
```bash
cd server
# создать .env из .env.example, заполнить переменные
uvicorn app.main:app --reload
```

### Переменные окружения (`server/.env`)
| Переменная | Описание |
|---|---|
| `DATABASE_URL` | postgresql+asyncpg://... |
| `JWT_SECRET` | секрет для подписи JWT |
| `BOT_TOKEN` | Telegram Bot Token (для верификации hash) |
| `LLM_API_KEY` | ключ OpenAI / Anthropic / OpenRouter |
| `LLM_BASE_URL` | базовый URL LLM API (default: OpenAI) |
| `LLM_MODEL` | имя модели (default: gpt-4o-mini) |
| `PARSER_API_KEY` | API-ключ для защищённых admin-эндпоинтов |

### Структура приложения

```
server/app/
├── main.py           # точка входа FastAPI, CORS, подключение роутеров
├── config.py         # Settings (pydantic-settings, читает .env)
├── database.py       # async engine, AsyncSessionLocal, Base
├── dependencies.py   # get_db, get_current_user, verify_parser_api_key
├── models/
│   ├── topic.py      # Topic (id, title, order_index, category, is_mock)
│   ├── task.py       # Task (id, topic_id, external_id, ege_number, content_html, media_resources JSONB, answer_type, correct_answer JSONB, solution_steps JSONB, difficulty)
│   ├── exam.py       # Exam + exam_tasks (M2M)
│   ├── exam_attempt.py # ExamAttempt (started_at, finished_at, primary_score, score)
│   ├── user.py       # User (tg_id, username, first_name, role)
│   ├── progress.py   # UserProgress (status: not_started/solved/failed, attempts_count)
│   └── ai_chat_log.py # AIChatLog (user_id, task_id, mode, user_query, ai_response)
├── routers/
│   ├── auth.py       # POST /auth/telegram — верификация TG hash, выдача JWT
│   ├── content.py    # GET /navigation, GET /tasks/{id}, POST /tasks/sync
│   ├── solving.py    # POST /tasks/{id}/check, POST /tasks/{id}/ai-assist
│   ├── exams.py      # GET /exams/by-topic/{id}, POST /exams/{id}/start, POST /exams/{id}/submit
│   ├── stats.py      # GET /stats/overview, /weekly-activity, /topics-performance, /recent-solutions
│   └── admin.py      # /admin/* — управление темами, задачами, студентами
└── schemas/          # Pydantic-схемы для всех роутеров
```

### Ключевые эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/telegram` | Авторизация через Telegram |
| GET | `/navigation` | Дерево тем + статус прогресса пользователя |
| GET | `/tasks/{id}` | Данные задачи (HTML, медиа, тип ответа) |
| POST | `/tasks/sync` | Bulk-upsert задач (защищён PARSER_API_KEY) |
| POST | `/tasks/{id}/check` | Проверка ответа пользователя |
| POST | `/tasks/{id}/ai-assist` | Запрос подсказки у LLM (заблокирован во время экзамена) |
| GET | `/exams/by-topic/{id}` | Информация об экзамене темы |
| POST | `/exams/{id}/start` | Начать экзамен (фиксирует время) |
| POST | `/exams/{id}/submit` | Завершить и подсчитать баллы |
| GET | `/stats/overview` | Сводная статистика пользователя |
| GET | `/admin/...` | CRUD тем, задач, просмотр студентов |

### Логика проверки ответов
- `single_number` — сравнение float с точностью 1e-9, fallback на строку
- `pair` — два числа `[a, b]`
- `table` — матрица `[[a,b],[c,d]]`
- Задания 26 и 27 ЕГЭ — частичный балл (0, 1 или 2)

### Системный промпт ИИ-ассистента
Запрещает давать прямой ответ. Требует наводящих вопросов и пошаговых объяснений на русском языке. Последние 5 сообщений пользователя по задаче передаются как история.

---

## Frontend (`client/`)

### Стек
- **React 18** + **TypeScript** + **Vite**
- **React Router v6** — роутинг
- **TanStack Query (React Query)** — кэширование запросов
- **Tailwind CSS** + **shadcn/ui** — UI-компоненты
- **KaTeX / InlineMath** — рендеринг математических формул
- **canvas-confetti** — конфетти при хорошем результате экзамена
- **clsx** — условные классы

### Запуск
```bash
cd client
npm install
npm run dev
```

### Переменные окружения (`client/.env`)
```
VITE_API_URL=http://localhost:8000
```

### Структура

```
client/src/
├── App.tsx              # роутер, QueryClientProvider, AuthProvider
├── api/
│   ├── client.ts        # fetch-обёртка с JWT из localStorage
│   └── types.ts         # TypeScript типы, зеркалящие backend-схемы
├── context/
│   └── AuthContext.tsx  # хранение токена, данных пользователя
├── hooks/
│   └── useApi.ts        # React Query хуки: useNavigation, useTask, useCheckAnswer, useAIAssist, useExamByTopic, useStartExam, useSubmitExam, useUserStats, ...
├── layouts/
│   ├── MainLayout.tsx   # основной layout с Sidebar
│   └── AuthLayout.tsx   # layout для страницы логина
├── pages/
│   ├── LoginPage.tsx    # страница входа (Telegram Login Widget)
│   ├── HomePage.tsx     # дашборд (статистика, активность)
│   ├── TasksPage.tsx    # страница задачи (рабочая область)
│   ├── TasksListPage.tsx # список всех задач
│   ├── ExamsListPage.tsx # список вариантов/экзаменов
│   ├── ExamPage.tsx     # режим экзамена с таймером (без layout)
│   └── AdminPage.tsx    # панель администратора
├── components/
│   ├── Sidebar.tsx / TaskSidebar.tsx / NavigationSidebar.tsx
│   ├── AnswerInput.tsx  # динамический инпут (number / pair / table)
│   ├── ChatWidget.tsx   # ИИ-ассистент (сворачиваемый чат)
│   ├── TaskView.tsx     # рендеринг HTML задачи
│   ├── InlineMath.tsx   # KaTeX-компонент
│   ├── Skeleton.tsx     # скелетоны загрузки
│   ├── ExamTimer.tsx    # таймер обратного отсчета
│   ├── ExamIntro.tsx    # экран перед стартом экзамена
│   └── admin/           # компоненты панели администратора
└── styles/              # глобальные CSS, тема, шрифты
```

### Маршруты

| Путь | Компонент | Описание |
|---|---|---|
| `/login` | LoginPage | Telegram-авторизация |
| `/` | HomePage | Главная / дашборд |
| `/tasks` | TasksListPage | Список задач |
| `/tasks/:id` | TasksPage | Конкретная задача |
| `/homework/:id` | TasksPage | Задача (раздел домашних) |
| `/exams` | ExamsListPage | Список вариантов |
| `/exams/:id` | ExamPage | Режим экзамена (без sidebar) |
| `/admin/*` | AdminPage | Панель администратора |

### Режимы работы с задачами
- **Разбор (tutorial)** — доступен ИИ-ассистент в любое время
- **Практика (practice)** — ИИ появляется автоматически при неверном ответе
- **Экзамен** — ИИ полностью заблокирован, таймер, ответы не проверяются до конца

---

## База данных — схема

```
topics          (id, title, order_index, category[tutorial/homework/variants], is_mock)
tasks           (id, topic_id, external_id, ege_number, content_html, media_resources, answer_type, correct_answer, difficulty, solution_steps, full_solution_code, order_index)
exams           (id, topic_id, time_limit_minutes)
exam_tasks      (exam_id, task_id)  -- M2M
users           (id, tg_id, username, first_name, first_name_real, last_name_real, photo_url, role)
user_progress   (user_id, task_id, status, attempts_count, last_attempt_at)
exam_attempts   (id, user_id, exam_id, started_at, finished_at, primary_score, score)
ai_chat_log     (id, user_id, task_id, mode, user_query, ai_response, created_at)
```

### Категории тем (`TopicCategory`)
- `tutorial` — обучающий раздел
- `homework` — домашние задания
- `variants` — контрольные варианты ЕГЭ

### Типы ответов (`AnswerType`)
- `single_number` — одно число
- `pair` — пара чисел `[x, y]`
- `table` — матрица чисел
- `text` — текстовый ответ

---

## Важные детали

- JWT хранится в `localStorage` на фронтенде
- Авторизация Telegram: HMAC-SHA256 верификация hash через BOT_TOKEN
- LLM поддерживает OpenRouter (дополнительные заголовки `HTTP-Referer`, `X-Title`)
- CORS настроен как `allow_origins=["*"]` — нужно ограничить в production
- Первичный балл ЕГЭ по информатике — из 29, конвертируется в тестовый балл (0-100)
- Задания 26 и 27 дают по 2 первичных балла (частичный зачёт)
- Скелетоны вместо спиннеров при загрузке задач
- Конфетти при результате экзамена >= 80 баллов

---

## Миграции

```bash
cd server
alembic upgrade head      # применить миграции
alembic revision --autogenerate -m "описание"  # создать новую миграцию
```
