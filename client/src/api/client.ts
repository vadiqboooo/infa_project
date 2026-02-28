const API_BASE = "http://localhost:8000";

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

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "API Error");
    }

    return res.json();
}
