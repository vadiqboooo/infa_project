import React from "react";
import "./ExamIntro.css";

interface Props {
    taskCount: number;
    timeLimitMinutes: number;
    onStart: () => void;
    loading?: boolean;
}

export default function ExamIntro({ taskCount, timeLimitMinutes, onStart, loading }: Props) {
    const hours = Math.floor(timeLimitMinutes / 60);
    const minutes = timeLimitMinutes % 60;
    const timeText = hours > 0
        ? `${hours} ч ${minutes > 0 ? `${minutes} мин` : ""}`
        : `${minutes} мин`;

    return (
        <div className="exam-intro">
            <div className="exam-intro-card">
                <h1 className="exam-intro-title">Пробный вариант ЕГЭ</h1>

                <div className="exam-intro-info">
                    <div className="exam-info-item">
                        <span className="exam-info-icon">📝</span>
                        <div>
                            <div className="exam-info-label">Количество заданий</div>
                            <div className="exam-info-value">{taskCount}</div>
                        </div>
                    </div>

                    <div className="exam-info-item">
                        <span className="exam-info-icon">⏱️</span>
                        <div>
                            <div className="exam-info-label">Время на выполнение</div>
                            <div className="exam-info-value">{timeText}</div>
                        </div>
                    </div>
                </div>

                <div className="exam-intro-instructions">
                    <h3>Инструкция</h3>
                    <ul>
                        <li>После начала экзамена запустится обратный отсчет времени</li>
                        <li>Вы можете отвечать на задания в любом порядке</li>
                        <li>Подсказки ИИ недоступны во время экзамена</li>
                        <li>По окончании времени экзамен завершится автоматически</li>
                        <li>Ваши ответы будут сохранены при завершении</li>
                    </ul>
                </div>

                <button
                    className="btn btn-primary btn-exam-start"
                    onClick={onStart}
                    disabled={loading}
                >
                    {loading ? "Запуск..." : "Начать экзамен"}
                </button>
            </div>
        </div>
    );
}
