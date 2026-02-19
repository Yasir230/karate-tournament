import { createContext, useContext, useState, type ReactNode } from 'react';
import api from '../lib/api';

interface User {
    id: string;
    username: string;
    role: 'ADMIN' | 'ATHLETE' | 'SPECTATOR';
    athleteId?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            return null;
        }
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

    const login = async (username: string, password: string) => {
        const res = await api.post('/auth/login', { username, password });
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        localStorage.setItem('token', res.data.token);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'ADMIN' }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}
