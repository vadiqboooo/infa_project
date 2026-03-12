import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ShieldCheck, GraduationCap } from "lucide-react";
import type { TokenResponse } from "../api/types";
import { EyeFollowCharacters } from "../components/EyeFollowCharacters";
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
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (loggedIn) navigate("/");
    }, [loggedIn, navigate]);

    useEffect(() => {
        window.onTelegramAuth = async (user: any) => {
            setLoading(true);
            try {
                const res = await api<TokenResponse>("/auth/telegram", {
                    method: "POST",
                    body: JSON.stringify(user),
                });
                login(res.access_token);
                navigate("/");
            } catch (err: any) {
                console.error("Auth error:", err);
                alert("Ошибка авторизации: " + (err.message || "Неизвестная ошибка"));
            } finally {
                setLoading(false);
            }
        };

        // Clear container first to prevent double rendering
        const container = document.getElementById("telegram-login-container");
        if (container) container.innerHTML = "";

        // Append Telegram Widget Script
        const botName = import.meta.env.VITE_BOT_USERNAME || "game_easy2026_bot";
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", botName);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-radius", "12");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        script.async = true;

        container?.appendChild(script);
    }, []);

    return (
        <div className="login-page">
            <div className="login-background">
                <div className="bg-blob blob-1"></div>
                <div className="bg-blob blob-2"></div>
                <div className="bg-blob blob-3"></div>
            </div>

            <div className="login-container">
                <div className="login-visual">
                    <div className="visual-characters">
                        <EyeFollowCharacters />
                    </div>
                </div>

                <div className="login-card">
                    <div className="card-header">
                        <div className="app-logo">
                            <GraduationCap size={32} />
                        </div>
                        <h1>Информатика ЕГЭ</h1>
                        <p>Твой путь к 100 баллам начинается здесь</p>
                    </div>

                    <div className="login-content">
                        <div className="login-info">
                            <div className="info-item">
                                <div className="info-icon">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="info-text">
                                    <h3>Безопасный вход</h3>
                                    <p>Вход осуществляется через официальный сервис Telegram</p>
                                </div>
                            </div>
                        </div>

                        <div className="auth-section">
                            {loading ? (
                                <div className="auth-loading">
                                    <div className="spinner"></div>
                                    <span>Авторизация...</span>
                                </div>
                            ) : (
                                <>
                                    <div id="telegram-login-container" className="tg-widget-wrapper"></div>
                                    <p className="auth-hint">Нажимая кнопку, вы подтверждаете согласие с правилами платформы</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card-footer">
                        <div className="footer-links">
                            <span>Поддержка</span>
                            <span className="dot"></span>
                            <span>О проекте</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
