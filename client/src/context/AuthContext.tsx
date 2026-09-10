import { createContext, Fragment, useCallback, useContext, useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setToken, clearToken, api } from "../api/client";
import type { User } from "../api/types";

interface AuthContextValue {
    loggedIn: boolean;
    loading: boolean;
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    loggedIn: false,
    loading: false,
    user: null,
    login: () => { },
    logout: () => { },
    updateUser: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [sessionToken, setSessionToken] = useState(() => localStorage.getItem("jwt_token"));
    const [loading, setLoading] = useState(Boolean(sessionToken));
    const [user, setUser] = useState<User | null>(null);

    const logout = useCallback(() => {
        clearToken();
        setSessionToken(null);
        setUser(null);
        setLoading(false);
        queryClient.clear();
    }, [queryClient]);

    useEffect(() => {
        if (!sessionToken) return;
        const controller = new AbortController();
        void api<User>("/auth/me", { signal: controller.signal }).then((userData) => {
            if (controller.signal.aborted || localStorage.getItem("jwt_token") !== sessionToken) return;
            queryClient.clear();
            setUser(userData);
            setLoading(false);
        }).catch((err) => {
            const activeToken = localStorage.getItem("jwt_token");
            if (controller.signal.aborted || (activeToken !== null && activeToken !== sessionToken)) return;
            console.error("Failed to fetch user:", err);
            logout();
        });
        return () => controller.abort();
    }, [sessionToken, queryClient, logout]);

    useEffect(() => {
        // An old tab must not keep the previous student's form with a new token.
        const onStorage = (event: StorageEvent) => {
            if (event.storageArea === localStorage && (event.key === "jwt_token" || event.key === null)) {
                if (localStorage.getItem("jwt_token") !== sessionToken) window.location.reload();
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [sessionToken]);

    const login = (token: string) => {
        if (token === sessionToken && user) return;
        setUser(null);
        setLoading(true);
        queryClient.clear();
        setToken(token);
        setSessionToken(token);
    };

    const updateUser = async (data: Partial<User>) => {
        try {
            const updatedUser = await api<User>("/auth/me", {
                method: "PUT",
                body: JSON.stringify(data),
            });
            if (localStorage.getItem("jwt_token") === sessionToken) setUser(updatedUser);
        } catch (err) {
            console.error("Failed to update user:", err);
            throw err;
        }
    };

    return (
        <AuthContext.Provider value={{ loggedIn: Boolean(user), loading, user, login, logout, updateUser }}>
            <Fragment key={user?.id ?? "anonymous"}>{children}</Fragment>
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
