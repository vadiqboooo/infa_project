Техническое задание: Разработка Backend-части образовательного сервиса
1. Общее описание
Цель: Создать серверную часть платформы для решения задач с ИИ-ассистентом.
Стек технологий:

Язык: Python 3.10+

Фреймворк: FastAPI (Async)

База данных: PostgreSQL

ORM: SQLAlchemy 2.0 + Alembic (для миграций)

Валидация: Pydantic v2

Авторизация: JWT + Telegram Login Widget API

2. Архитектура базы данных
2.1. Контент и Навигация
Topics: Группировка задач (id, title, order_index).

Tasks:

id, topic_id (FK), external_id (ID с внешнего сайта).

content_html (Text): Текст задачи с поддержкой HTML-тегов.

media_resources (JSONB): Массив ссылок на изображения и файлы.

answer_type (Enum): single_number, pair, table.

correct_answer (JSONB): Эталонный ответ для автоматической проверки.

Exams: Контрольные блоки (id, topic_id, time_limit_minutes). Связь Many-to-Many с таблицей Tasks.

2.2. Пользователи и Прогресс
Users: id, tg_id (BigInt, Unique), username, first_name, photo_url.

UserProgress: Связь пользователя с задачей. Статусы: not_started, solved, failed. Поля: attempts_count, last_attempt_at.

ExamAttempts: История прохождения контрольных тестов (время начала, время завершения, итоговый балл).

2.3. Логирование и Аналитика (AI Logs)
AIChatLog:

user_id (FK), task_id (FK).

mode (Enum: tutorial / practice).

user_query (Text): Что ввел пользователь или его ошибка.

ai_response (Text): Что ответил ассистент.

created_at (Timestamp).

3. Функциональные требования к API
3.1. Модуль авторизации
POST /auth/telegram: Принимает данные от Telegram (id, hash, и т.д.).

Логика: Проверка подписи hash через HMAC-SHA256 с использованием BOT_TOKEN. Выдача JWT-токена.

3.2. Модуль контента
GET /navigation: Получение структуры тем и задач для бокового меню (с учетом статуса прохождения пользователем).

GET /tasks/{id}: Получение данных задачи (HTML, медиа, тип ввода).

POST /tasks/sync: (Admin) Эндпоинт для сохранения/обновления задач из внешнего парсера в БД.

3.3. Модуль решения и ИИ
POST /tasks/{id}/check: Сравнение ответа пользователя с correct_answer. Обновление прогресса.

POST /tasks/{id}/ai-assist:

Получение контекста задачи и истории ошибок пользователя.

Запрос к API LLM (OpenAI/Anthropic) с системным промптом (запрет на прямые ответы).

Обязательное сохранение запроса и ответа в таблицу AIChatLog.

Возврат подсказки пользователю.

3.4. Модуль экзаменов
POST /exams/{id}/start: Фиксация времени начала теста. Отключение доступа к подсказкам ИИ для этих задач.

POST /exams/{id}/submit: Проверка всех ответов блока и расчет итогового балла.

4. Технические ограничения и валидация
Формат ответов: Использовать Pydantic-схемы для валидации JSON-ответов:

Число: {"val": float}

Пара: {"val": [float, float]}

Таблица: {"val": [[float, ...], ...]}

Безопасность: Доступ к CRUD задач (создание/удаление) только по API-ключу парсера или роли Admin.

Производительность: Запросы к задачам должны быть оптимизированы через индексы (external_id, tg_id)