import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { isAuthenticated, setToken, clearToken } from "../api/client";

interface AuthContextValue {
    loggedIn: boolean;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
    loggedIn: false,
    login: () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [loggedIn, setLoggedIn] = useState(isAuthenticated);

    useEffect(() => {
        setLoggedIn(isAuthenticated());
    }, []);

    const login = (token: string) => {
        setToken(token);
        setLoggedIn(true);
    };

    const logout = () => {
        clearToken();
        setLoggedIn(false);
    };

    return (
        <AuthContext.Provider value={{ loggedIn, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
