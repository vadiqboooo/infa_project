import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ShieldCheck, GraduationCap, RefreshCw } from "lucide-react";
import type { TokenResponse } from "../api/types";
import { EyeFollowCharacters } from "../components/EyeFollowCharacters";
import "./LoginPage.css";

// This is the Telegram Login Widget script handler
declare global {
    interface Window {
        onTelegramAuth: (user: any) => void;
    }
}

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    hash: string;
}

export default function LoginPage() {
    const { login, loggedIn } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    // pending = user data received from Telegram widget, awaiting confirmation
    const [pending, setPending] = useState<TelegramUser | null>(null);

    useEffect(() => {
        if (loggedIn) navigate("/");
    }, [loggedIn, navigate]);

    const doLogin = async (user: TelegramUser) => {
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
            setPending(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchAccount = () => {
        // The widget iframe (created by telegram-widget.js) listens for postMessage.
        // Sending {event: 'logout'} is exactly what TelegramWidget.prototype.logout() does
        // internally — it clears the oauth.telegram.org session cookie via the trusted iframe.
        const container = document.getElementById("telegram-login-container");
        const iframe = container?.querySelector<HTMLIFrameElement>("iframe");
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: "logout" }),
                "https://oauth.telegram.org"
            );
        }
        setPending(null);
        // Give a moment for logout to be processed, then reload so the widget
        // shows a fresh login button (without auto-firing the cached session).
        setTimeout(() => window.location.reload(), 800);
    };

    useEffect(() => {
        // Define the global callback for Telegram — intercept before logging in
        window.onTelegramAuth = (user: TelegramUser) => {
            setPending(user);
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
                            {/* Always keep widget container in DOM so its iframe stays alive.
                                We need the iframe reference to send the logout postMessage. */}
                            <div
                                id="telegram-login-container"
                                className="tg-widget-wrapper"
                                style={{ display: loading || pending ? "none" : undefined }}
                            />
                            {!loading && !pending && (
                                <p className="auth-hint">Нажимая кнопку, вы подтверждаете согласие с правилами платформы</p>
                            )}

                            {loading && (
                                <div className="auth-loading">
                                    <div className="spinner"></div>
                                    <span>Авторизация...</span>
                                </div>
                            )}

                            {pending && !loading && (
                                /* ── Account confirmation ── */
                                <div className="tg-confirm-card">
                                    {pending.photo_url ? (
                                        <img src={pending.photo_url} alt="" className="tg-confirm-avatar" />
                                    ) : (
                                        <div className="tg-confirm-avatar tg-confirm-avatar-placeholder">
                                            {pending.first_name.charAt(0)}
                                        </div>
                                    )}
                                    <p className="tg-confirm-label">Войти как</p>
                                    <p className="tg-confirm-name">
                                        {pending.first_name}{pending.last_name ? ` ${pending.last_name}` : ''}
                                    </p>
                                    {pending.username && (
                                        <p className="tg-confirm-username">@{pending.username}</p>
                                    )}
                                    <button
                                        className="tg-confirm-btn-primary"
                                        onClick={() => doLogin(pending)}
                                    >
                                        Войти в платформу
                                    </button>
                                    <button
                                        className="tg-confirm-btn-secondary"
                                        onClick={handleSwitchAccount}
                                    >
                                        <RefreshCw size={13} />
                                        Это не я — сменить аккаунт
                                    </button>
                                </div>
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
