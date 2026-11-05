import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken } from "../api/client";
import type { Role, User } from "../types";
import { PageLoader } from "../components/UI";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, language: "en" | "am") => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    register: async (name, email, password, language) => {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", { name, email, password, language });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    logout: () => {
      setToken(null);
      setUser(null);
      queryClient.clear();
    },
    setUser,
    refresh,
  }), [user, loading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function Protected({ children, admin = false, roles }: { children: ReactNode; admin?: boolean; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== "admin") return <Navigate to="/app" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
