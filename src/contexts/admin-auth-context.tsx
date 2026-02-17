"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  adminEmail: string | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const MOCK_EMAIL = "admin@iskomunidad.ph";
const MOCK_PASSWORD = "admin1234";
const SESSION_KEY = "admin-session";

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setAdminEmail(stored);
    }
  }, []);

  const login = useCallback((email: string, password: string): boolean => {
    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, email);
      setAdminEmail(email);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminEmail(null);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated: adminEmail !== null,
        adminEmail,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
