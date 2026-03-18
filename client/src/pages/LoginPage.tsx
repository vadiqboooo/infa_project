import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ShieldCheck, GraduationCap, LogIn, Eye, EyeOff } from "lucide-react";
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
    const [authMode, setAuthMode] = useState<"telegram" | "password">("telegram");

    // Login/password form state
    const [loginInput, setLoginInput] = useState("");
    const [passwordInput, setPasswordInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState("");

    useEffect(() => {
        if (loggedIn) navigate("/");
    }, [loggedIn, navigate]);

    useEffect(() => {
        if (authMode !== "telegram") return;

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
    }, [authMode]);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");
        if (!loginInput.trim() || !passwordInput) return;
        setLoading(true);
        try {
            const res = await api<TokenResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ login: loginInput.trim(), password: passwordInput }),
            });
            login(res.access_token);
            navigate("/");
        } catch (err: any) {
            setLoginError(err.message || "Неверный логин или пароль");
        } finally {
            setLoading(false);
        }
    };

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

                    {/* Auth mode tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mx-4 mb-2">
                        <button
                            onClick={() => setAuthMode("telegram")}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === "telegram" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Telegram
                        </button>
                        <button
                            onClick={() => setAuthMode("password")}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === "password" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Логин / Пароль
                        </button>
                    </div>

                    <div className="login-content">
                        {authMode === "telegram" ? (
                            <>
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
                            </>
                        ) : (
                            <div className="auth-section w-full">
                                <form onSubmit={handlePasswordLogin} className="space-y-3 w-full px-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Логин</label>
                                        <input
                                            type="text"
                                            value={loginInput}
                                            onChange={(e) => setLoginInput(e.target.value)}
                                            placeholder="Введите логин"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                                            autoComplete="username"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Пароль</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={passwordInput}
                                                onChange={(e) => setPasswordInput(e.target.value)}
                                                placeholder="Введите пароль"
                                                className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3F8C62] focus:ring-1 focus:ring-[#3F8C62] transition-all"
                                                autoComplete="current-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    {loginError && (
                                        <p className="text-red-500 text-xs ml-1">{loginError}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={loading || !loginInput.trim() || !passwordInput}
                                        className="w-full flex items-center justify-center gap-2 bg-[#3F8C62] hover:bg-[#357A54] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#3F8C62]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                                                <span>Вход...</span>
                                            </>
                                        ) : (
                                            <>
                                                <LogIn size={18} />
                                                <span>Войти</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}
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
