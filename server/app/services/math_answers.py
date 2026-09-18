"""Small, bounded expression grammar. Never evaluate user input as Python.

Symbolic work runs in a disposable process with a deadline. Equivalence means
an exact identity on the common domain; rounded decimal approximations fail.
"""
import json
import re
import subprocess
import sys
from pathlib import Path


class MathAnswerError(ValueError):
    pass


def strip_math_delimiters(value: str) -> str:
    value = value.strip()
    for left, right in ((r"\(", r"\)"), (r"\[", r"\]"), ("$$", "$$"), ("$", "$")):
        if value.startswith(left) and value.endswith(right):
            return value[len(left):-len(right)].strip()
    return value


def parse_expression(value):
    # Import only in the worker, keeping server startup light.
    import sympy as sp

    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        raise MathAnswerError("Ожидается одно математическое выражение")
    source = strip_math_delimiters(str(value))
    if not source or len(source) > 256:
        raise MathAnswerError("Ответ должен содержать от 1 до 256 символов")
    source = source.replace("−", "-").replace("×", "*").replace("·", "*").replace(",", ".")
    for char, name in {"α": "alpha", "β": "beta", "γ": "gamma", "θ": "theta", "π": "pi", "√": "sqrt"}.items():
        source = source.replace(char, " " + name + " ")
    source = re.sub(r"\\(?:left|right)\b", "", source)
    source = re.sub(r"\\(?:operatorname|mathrm)\{(tg|ctg|tan|cot|sin|cos)\}", r" \1 ", source)
    source = re.sub(r"\\[,;! ]", " ", source)
    source = source.replace(r"\cdot", "*").replace(r"\times", "*").replace("**", "^")
    tokens = []
    pattern = re.compile(r"\s+|\\[A-Za-z]+|[A-Za-z]+|(?:\d+(?:\.\d*)?|\.\d+)|[+*/^(){}-]")
    pos = 0
    while pos < len(source):
        match = pattern.match(source, pos)
        if not match:
            raise MathAnswerError("Недопустимый символ в ответе")
        token = match.group()
        pos = match.end()
        if not token.isspace():
            tokens.append(token.lstrip("\\"))
    if len(tokens) > 80:
        raise MathAnswerError("Слишком сложное выражение")
    tokens.append("")
    symbols = {name: sp.Symbol(name, real=True) for name in ("x", "y", "z", "a", "b", "alpha", "beta", "gamma", "theta")}
    functions = {"sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "tg": sp.tan, "cot": sp.cot, "ctg": sp.cot, "sqrt": sp.sqrt, "abs": sp.Abs}

    class Parser:
        index = 0
        depth = 0

        def peek(self):
            return tokens[self.index]

        def take(self):
            token = self.peek()
            if not token:
                raise MathAnswerError("Незавершённое выражение")
            self.index += 1
            return token

        def expression(self):
            result = self.product()
            while self.peek() in ("+", "-"):
                op = self.take()
                rhs = self.product()
                result = result + rhs if op == "+" else result - rhs
            return result

        def product(self):
            result = self.unary()
            while True:
                token = self.peek()
                if token in ("*", "/"):
                    self.take()
                    rhs = self.unary()
                    if token == "/" and rhs == 0:
                        raise MathAnswerError("Деление на ноль")
                    result = result * rhs if token == "*" else result / rhs
                elif token and (token[0].isalnum() or token in ("(", "{", ".")):
                    result *= self.unary()
                else:
                    return result

        def unary(self):
            if self.peek() in ("+", "-"):
                sign = self.take()
                value = self.unary()
                return value if sign == "+" else -value
            result = self.atom()
            if self.peek() == "^":
                self.take()
                result = self.power(result, self.unary())
            return result

        def power(self, base, exponent):
            if not exponent.is_Rational or abs(exponent) > 12 or exponent.q > 12:
                raise MathAnswerError("Поддерживаются числовые степени от −12 до 12")
            if base == 0 and exponent <= 0:
                raise MathAnswerError("Неопределённая степень")
            if base.is_Rational and max(int(base.p).bit_length(), int(base.q).bit_length()) * max(abs(exponent.p), 1) > 4096:
                raise MathAnswerError("Слишком большое число")
            return base ** exponent

        def atom(self):
            self.depth += 1
            if self.depth > 16:
                raise MathAnswerError("Слишком глубокая вложенность")
            try:
                token = self.take()
                if token in ("(", "{"):
                    result = self.expression()
                    if self.take() != (")" if token == "(" else "}"):
                        raise MathAnswerError("Проверьте скобки")
                    return result
                if re.fullmatch(r"\d+(?:\.\d*)?|\.\d+", token):
                    if len(token) > 12:
                        raise MathAnswerError("Слишком длинное число")
                    return sp.Rational(token)
                if token == "pi":
                    return sp.pi
                if token in symbols:
                    return symbols[token]
                if token in ("frac", "dfrac", "tfrac"):
                    numerator = self.atom()
                    denominator = self.atom()
                    if denominator == 0:
                        raise MathAnswerError("Деление на ноль")
                    return numerator / denominator
                if token in functions:
                    exponent = None
                    if self.peek() == "^":
                        self.take()
                        exponent = self.atom()
                    result = functions[token](self.atom())
                    return result if exponent is None else self.power(result, exponent)
                raise MathAnswerError(f"Неизвестное обозначение: {token}")
            finally:
                self.depth -= 1

    parser = Parser()
    result = parser.expression()
    if parser.peek():
        raise MathAnswerError("Лишние символы или незакрытые скобки")
    if result.has(sp.zoo, sp.oo, -sp.oo, sp.nan, sp.I) or result.is_real is False:
        raise MathAnswerError("Ответ должен быть действительным и определённым")
    return result


def _worker(payload):
    import sympy as sp

    if payload["operation"] == "validate":
        errors = []
        for value in payload["values"]:
            try:
                parse_expression(value)
                errors.append(None)
            except (ValueError, TypeError, RecursionError, ZeroDivisionError) as exc:
                errors.append(str(exc))
        return errors
    try:
        expected = parse_expression(payload["expected"])
        given = parse_expression(payload["given"])
        return bool(sp.simplify(expected - given) == 0)
    except (ValueError, TypeError, RecursionError, ZeroDivisionError):
        return False


def _run_worker(payload):
    try:
        result = subprocess.run(
            [sys.executable, "-I", str(Path(__file__).resolve())],
            input=json.dumps(payload), capture_output=True, text=True, encoding="utf-8",
            timeout=5, check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        return json.loads(result.stdout)
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        raise MathAnswerError("Не удалось проверить выражение. Упростите запись и повторите попытку.") from exc


def validate_math_answers(values: list) -> list[str | None]:
    return _run_worker({"operation": "validate", "values": values}) if values else []


def math_answers_equal(expected, given) -> bool:
    return _run_worker({"operation": "compare", "expected": expected, "given": given})


if __name__ == "__main__":
    print(json.dumps(_worker(json.load(sys.stdin))))
