const API_BASE = "/api";

function getToken(): string | null {
    return localStorage.getItem("jwt_token");
}

export function setToken(token: string) {
    localStorage.setItem("jwt_token", token);
}

export function clearToken() {
    localStorage.removeItem("jwt_token");
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

// Avoid spamming multiple alerts/redirects when many requests fail at once
let sessionExpiredHandled = false;

export function handleSessionExpired() {
    if (sessionExpiredHandled) return;
    sessionExpiredHandled = true;
    clearToken();
    // Skip redirect if already on /login (e.g. login attempt itself failed)
    if (window.location.pathname !== "/login") {
        window.location.replace("/login?expired=1");
    }
}

export async function api<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        handleSessionExpired();
        throw new Error("Сессия истекла. Войдите снова.");
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "API Error");
    }

    return res.json();
}

/**
 * Lower-level fetch that auto-attaches Authorization, handles 401 globally,
 * and returns the raw Response. Use for FormData uploads or non-JSON responses.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && token) {
        handleSessionExpired();
    }
    return res;
}
