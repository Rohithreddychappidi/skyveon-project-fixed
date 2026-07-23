"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, apiFetch, refreshAccessToken, setAccessToken, setUnauthorizedHandler } from "@/lib/api";
import type { AuthUser } from "@/lib/api-types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    (async () => {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const body = await apiFetch("/api/auth/me");
          setUser(body.user);
          setStatus("authenticated");
          return;
        } catch {
          // fall through to unauthenticated
        }
      }
      clearSession();
    })();

    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const body = await api.post("/api/auth/login", { email, password });
    setAccessToken(body.accessToken);
    setUser(body.user);
    setStatus("authenticated");
    return body.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // already logged out server-side, doesn't matter
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const body = await apiFetch("/api/auth/me");
    setUser(body.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
