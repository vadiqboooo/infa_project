import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { isAuthenticated, setToken, clearToken, api } from "../api/client";
import type { User } from "../api/types";

interface AuthContextValue {
    loggedIn: boolean;
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    loggedIn: false,
    user: null,
    login: () => { },
    logout: () => { },
    updateUser: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [loggedIn, setLoggedIn] = useState(isAuthenticated);
    const [user, setUser] = useState<User | null>(null);

    const fetchUser = async () => {
        try {
            const userData = await api<User>("/auth/me");
            setUser(userData);
            setLoggedIn(true);
        } catch (err) {
            console.error("Failed to fetch user:", err);
            logout();
        }
    };

    useEffect(() => {
        if (isAuthenticated()) {
            fetchUser();
        }
    }, []);

    const login = (token: string) => {
        setToken(token);
        fetchUser();
    };

    const logout = () => {
        clearToken();
        setLoggedIn(false);
        setUser(null);
    };

    const updateUser = async (data: Partial<User>) => {
        try {
            const updatedUser = await api<User>("/auth/me", {
                method: "PUT",
                body: JSON.stringify(data),
            });
            setUser(updatedUser);
        } catch (err) {
            console.error("Failed to update user:", err);
            throw err;
        }
    };

    return (
        <AuthContext.Provider value={{ loggedIn, user, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
