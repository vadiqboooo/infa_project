"""Article publishing and server-side quiz grading."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.article import Article, ArticleProgress
from app.models.group_plan import GroupLessonItem
from app.models.user import User
from app.schemas.article import ArticleIn, ArticleOut, ArticleUpdate, QuizSubmit, ReadArticle

router = APIRouter(prefix="/articles", tags=["articles"])
admin_router = APIRouter(prefix="/admin/articles", tags=["admin", "articles"], dependencies=[Depends(verify_parser_api_key)])


async def get_article(db: AsyncSession, article_id: int, *, published=False, lock=False):
    query = select(Article).where(Article.id == article_id)
    if published:
        query = query.where(Article.published.is_(True))
    if lock:
        query = query.with_for_update()
    article = (await db.execute(query)).scalar_one_or_none()
    if article is None:
        raise HTTPException(404, "Статья не найдена")
    return article


def progress_out(article: Article, progress: ArticleProgress | None):
    current = progress is not None and progress.revision == article.revision
    read = bool(current and progress.read)
    score = progress.best_score if current else 0
    total = len(article.questions)
    return {"read": read, "best_score": score, "total": total,
            "attempts": progress.attempts if current else 0,
            "completed": read and (not total or score == total)}


async def get_progress(db: AsyncSession, article: Article, user: User):
    progress = await db.get(ArticleProgress, (user.id, article.id))
    if progress is None:
        progress = ArticleProgress(user_id=user.id, article_id=article.id, revision=article.revision, read=False, best_score=0, attempts=0)
        db.add(progress)
    elif progress.revision != article.revision:
        progress.revision = article.revision
        progress.read = False
        progress.best_score = 0
        progress.attempts = 0
    return progress


def check_revision(article: Article, revision: int):
    if article.revision != revision:
        raise HTTPException(409, "Статья изменилась. Обновите страницу.")


def grade_quiz(questions: list[dict], answers: list[list[int]]):
    if not questions or len(answers) != len(questions):
        raise HTTPException(422, "Ответьте на все вопросы теста")
    results = []
    for question, selected in zip(questions, answers):
        if not selected or len(set(selected)) != len(selected) or any(index < 0 or index >= len(question["options"]) for index in selected):
            raise HTTPException(422, "Выберите допустимые варианты ответа")
        if question["type"] != "multiple" and len(selected) != 1:
            raise HTTPException(422, "В этом вопросе нужен один ответ")
        results.append({"correct": set(selected) == set(question["correct_answers"]),
                        "correct_answers": question["correct_answers"], "explanation": question["explanation"]})
    return results


@admin_router.get("")
async def list_articles(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Article).order_by(Article.updated_at.desc(), Article.id.desc()))).scalars().all()
    return [{"id": row.id, "title": row.title, "published": row.published, "question_count": len(row.questions)} for row in rows]


@admin_router.post("", response_model=ArticleOut, status_code=201)
async def create_article(body: ArticleIn, db: AsyncSession = Depends(get_db)):
    article = Article(**body.model_dump())
    db.add(article)
    await db.commit()
    return article


@admin_router.get("/{article_id}", response_model=ArticleOut)
async def admin_article(article_id: int, db: AsyncSession = Depends(get_db)):
    return await get_article(db, article_id)


@admin_router.put("/{article_id}", response_model=ArticleOut)
async def update_article(article_id: int, body: ArticleUpdate, db: AsyncSession = Depends(get_db)):
    article = await get_article(db, article_id, lock=True)
    check_revision(article, body.revision)
    if not body.questions:
        attached_quiz = (await db.execute(select(GroupLessonItem.id).where(GroupLessonItem.article_id == article_id, GroupLessonItem.article_mode == "quiz").limit(1))).first()
        if attached_quiz:
            raise HTTPException(409, "Тест используется в плане урока. Сначала уберите его из плана, чтобы удалить все вопросы.")
    for key, value in body.model_dump(exclude={"revision"}).items():
        setattr(article, key, value)
    article.revision += 1
    await db.commit()
    return article


@admin_router.delete("/{article_id}")
async def delete_article(article_id: int, db: AsyncSession = Depends(get_db)):
    article = await get_article(db, article_id, lock=True)
    attached = (await db.execute(select(GroupLessonItem.id).where(GroupLessonItem.article_id == article_id).limit(1))).first()
    if attached:
        raise HTTPException(409, "Сначала уберите статью из планов уроков или снимите её с публикации")
    await db.delete(article)
    await db.commit()
    return {"ok": True}


@router.get("/{article_id}")
async def read_article(article_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    article = await get_article(db, article_id, published=True)
    progress = await db.get(ArticleProgress, (user.id, article.id))
    return {"id": article.id, "title": article.title, "content": article.content, "content_format": article.content_format, "revision": article.revision,
            "questions": [{key: question[key] for key in ("prompt", "type", "options")} for question in article.questions],
            "progress": progress_out(article, progress)}


@router.post("/{article_id}/read")
async def mark_read(article_id: int, body: ReadArticle, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    article = await get_article(db, article_id, published=True, lock=True)
    check_revision(article, body.revision)
    progress = await get_progress(db, article, user)
    progress.read = True
    await db.commit()
    return progress_out(article, progress)


@router.post("/{article_id}/quiz")
async def submit_quiz(article_id: int, body: QuizSubmit, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    article = await get_article(db, article_id, published=True, lock=True)
    check_revision(article, body.revision)
    results = grade_quiz(article.questions, body.answers)
    progress = await get_progress(db, article, user)
    if not progress.read:
        raise HTTPException(400, "Сначала отметьте статью прочитанной")
    score = sum(result["correct"] for result in results)
    progress.best_score = max(progress.best_score, score)
    progress.attempts += 1
    await db.commit()
    return {"score": score, "total": len(results), "progress": progress_out(article, progress)}
