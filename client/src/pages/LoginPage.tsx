import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { TokenResponse } from "../api/types";
import "./LoginPage.css";

// This is the Telegram Login Widget script handler
declare global {
    interface Window {
        onTelegramAuth: (user: any) => void;
    }
}

export default function LoginPage() {
    const { login, loggedIn } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loggedIn) {
            navigate("/");
        }
    }, [loggedIn, navigate]);

    useEffect(() => {
        // Define the global callback for Telegram
        window.onTelegramAuth = async (user: any) => {
            try {
                const res = await api<TokenResponse>("/auth/telegram", {
                    method: "POST",
                    body: JSON.stringify(user),
                });
                login(res.access_token);
            } catch (err) {
                alert("Ошибка авторизации через Telegram");
            }
        };

        // Append Telegram Widget Script
        // In a real app, you'd configure the bot name
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", import.meta.env.VITE_BOT_USERNAME ?? "your_bot_name");
        script.setAttribute("data-size", "large");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        script.async = true;

        document.getElementById("telegram-login-container")?.appendChild(script);
    }, [login]);

    return (
        <div className="login-page fade-in">
            <div className="login-card card">
                <h1>Вход в систему</h1>
                <p>Для доступа к образовательной платформе авторизуйтесь через Telegram</p>
                <div id="telegram-login-container" className="tg-container" />
            </div>
        </div>
    );
}
