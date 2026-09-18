"""Import the numbered UTF-8 worksheet format; no TeX execution or LLM calls."""
import re
from html import escape

from app.services.math_answers import strip_math_delimiters, validate_math_answers

MAX_FILE_BYTES = 1024 * 1024
MARKER = re.compile(r"^\s*(?:№|Задание)\s*(\d+(?:\.\d+)*)\s*[.)]?\s*$", re.MULTILINE | re.IGNORECASE)
ANSWER = re.compile(r"^\s*Ответ\s*:\s*", re.MULTILINE | re.IGNORECASE)


def parse_latex_worksheet(text: str) -> dict:
    text = text.lstrip("\ufeff").replace("\r\n", "\n").strip()
    markers = list(MARKER.finditer(text))
    if not markers:
        raise ValueError("Не найдены задания. Начинайте каждое задание с отдельной строки «№ 2.1» или «Задание 1».")
    if len(markers) > 200:
        raise ValueError("В одном файле допускается не более 200 заданий")
    heading = text[:markers[0].start()].strip().splitlines()
    tasks = []
    numbers = set()
    for i, marker in enumerate(markers):
        number = marker.group(1)
        if number in numbers:
            raise ValueError(f"Номер {number} повторяется")
        numbers.add(number)
        block = text[marker.end():markers[i + 1].start() if i + 1 < len(markers) else len(text)].strip()
        answers = list(ANSWER.finditer(block))
        if len(answers) != 1:
            raise ValueError(f"Задание № {number}: нужна ровно одна строка «Ответ: …» в конце задания")
        answer_marker = answers[0]
        condition = block[:answer_marker.start()].strip()
        answer = block[answer_marker.end():].strip()
        if answer.endswith("."):
            answer = answer[:-1].rstrip()
        answer = strip_math_delimiters(answer)
        if not condition or not answer:
            raise ValueError(f"Задание № {number}: отсутствует условие или ответ")
        # Keep newlines inside math delimiters (KaTeX treats them as whitespace).
        content = "<div style=\"white-space:pre-wrap\">" + escape(condition) + "</div>"
        tasks.append({
            "index": i, "title": f"№ {number}", "ege_number": None,
            "content_html": content, "answer_type": "math_expression",
            "correct_answer": {"val": answer}, "images": [], "files": [], "sub_tasks": [],
        })
    errors = validate_math_answers([task["correct_answer"]["val"] for task in tasks])
    for task, error in zip(tasks, errors):
        if error:
            raise ValueError(f"{task['title']}: {error}. Поддерживаются числа, дроби, sqrt, sin, cos, tg и ctg.")
    return {"topic_title": heading[0][:255] if heading else "Импорт из LaTeX", "tasks": tasks, "full_text": text}
