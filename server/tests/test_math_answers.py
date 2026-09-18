import subprocess
import unittest
from unittest.mock import patch

from app.routers.solving import _answers_equal
from app.schemas.task import AnswerIn
from app.services.math_answers import MathAnswerError, _worker, math_answers_equal, validate_math_answers


class MathAnswerTests(unittest.TestCase):
    def test_exact_equivalence(self):
        for expected, given in [
            (r"-\sqrt{2}", "-sqrt(8)/2"),
            (r"\frac{\sqrt{8}}{2}", "√2"),
            (r"\frac{1}{2}", "0,5"),
            (r"-\cos\alpha", "-cos(α)"),
            (r"\operatorname{tg}\alpha", "sin(alpha)/cos(alpha)"),
            (r"-\operatorname{ctg}\alpha", "-1/tan(alpha)"),
            ("sin(alpha)^2+cos(alpha)^2", "1"),
            (r"\sin^2(\alpha)", "1-cos(alpha)^2"),
            ("2sqrt(2)", "sqrt(8)"),
            ("(x+1)^2", "x^2+2*x+1"),
            ("0", "0"),
        ]:
            with self.subTest(expected=expected, given=given):
                self.assertTrue(_worker({"operation": "compare", "expected": expected, "given": given}))

    def test_wrong_rounded_or_invalid_answers_fail(self):
        for expected, given in [
            ("sqrt(2)", "1.4142135623730951"), ("sqrt(2)", "-sqrt(2)"),
            ("sin(alpha)", "cos(alpha)"), ("0", "1/0"), ("1", "sqrt(-1)"),
            ("1", "x/x + 1/0"), ("1", "sin(alpha"), ("1", "1; print(1)"),
            ("1", "__import__('os').system('echo bad')"), ("1", "9^999999999"),
            ("1", "sqrt"), ("1", "1" * 257), ("1", [1]), ("1", "NaN"),
        ]:
            with self.subTest(given=given):
                self.assertFalse(_worker({"operation": "compare", "expected": expected, "given": given}))

    def test_worker_and_legacy_dispatch(self):
        self.assertTrue(math_answers_equal(r"-\sqrt{2}", "-√2"))
        self.assertTrue(_answers_equal({"val": "sqrt(2)"}, AnswerIn(val="sqrt(8)/2"), "math_expression"))
        self.assertFalse(_answers_equal({"val": "sqrt(2)"}, AnswerIn(val="sqrt(8)/2"), "text"))
        self.assertTrue(_answers_equal({"val": 2}, AnswerIn(val="2,0")))
        self.assertTrue(_answers_equal({"val": [[1, 2]]}, AnswerIn(val=[[1, 2]])))
        self.assertEqual(validate_math_answers(["0", r"-\cos\alpha"]), [None, None])

    def test_worker_timeout_does_not_mark_answer_incorrect(self):
        with patch("app.services.math_answers.subprocess.run", side_effect=subprocess.TimeoutExpired("worker", 5)):
            with self.assertRaises(MathAnswerError):
                math_answers_equal("1", "1")


if __name__ == "__main__":
    unittest.main()
