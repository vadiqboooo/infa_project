from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class QuizQuestion(BaseModel):
    prompt: NonBlank
    type: Literal["single", "multiple", "boolean"] = "single"
    options: list[NonBlank] = Field(min_length=2, max_length=10)
    correct_answers: list[int] = Field(min_length=1, max_length=10)
    explanation: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def validate_answers(self):
        if len(set(self.options)) != len(self.options):
            raise ValueError("Варианты ответа должны различаться")
        if len(set(self.correct_answers)) != len(self.correct_answers) or any(
            answer < 0 or answer >= len(self.options) for answer in self.correct_answers
        ):
            raise ValueError("Некорректные номера правильных ответов")
        if self.type != "multiple" and len(self.correct_answers) != 1:
            raise ValueError("Укажите один правильный ответ")
        if self.type == "boolean" and self.options != ["Верно", "Неверно"]:
            raise ValueError("Для этого типа нужны варианты «Верно» и «Неверно»")
        return self


class ArticleIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    content: str = Field(default="", max_length=200000)
    content_format: Literal["markdown", "html"] = "markdown"
    published: bool = False
    questions: list[QuizQuestion] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_publication(self):
        if self.published and not self.content.strip():
            raise ValueError("Перед публикацией добавьте текст статьи")
        return self


class ArticleUpdate(ArticleIn):
    revision: int = Field(ge=1)


class ArticleOut(ArticleIn):
    id: int
    revision: int

    model_config = {"from_attributes": True}


class QuizSubmit(BaseModel):
    revision: int = Field(ge=1)
    answers: list[list[int]] = Field(max_length=100)


class ReadArticle(BaseModel):
    revision: int = Field(ge=1)
