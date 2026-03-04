import React, { useState, useEffect } from "react";
import "./ExamTimer.css";

interface Props {
    startedAt: string;
    timeLimitMinutes: number;
    onTimeUp?: () => void;
}

export default function ExamTimer({ startedAt, timeLimitMinutes, onTimeUp }: Props) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const startTime = new Date(startedAt).getTime();
        const endTime = startTime + timeLimitMinutes * 60 * 1000;

        const updateTimer = () => {
            const now = Date.now();
            const left = Math.max(0, endTime - now);
            setTimeLeft(left);

            if (left === 0 && onTimeUp) {
                onTimeUp();
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [startedAt, timeLimitMinutes, onTimeUp]);

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const isLowTime = timeLeft < 10 * 60 * 1000; // Less than 10 minutes
    const isCritical = timeLeft < 5 * 60 * 1000; // Less than 5 minutes

    return (
        <div className={`exam-timer ${isLowTime ? "low-time" : ""} ${isCritical ? "critical" : ""}`}>
            <span className="exam-timer-icon">⏱️</span>
            <span className="exam-timer-text">
                {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
        </div>
    );
}
