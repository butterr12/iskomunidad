"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut } from "@/lib/auth-client";

interface AdminAuthContextValue {
  isAdmin: boolean;
  isLoading: boolean;
  user: { name: string; email: string; image?: string | null } | null;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  const user = session?.user ?? null;
  const isAdmin = user?.role === "admin";

  const logout = () => {
    signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } });
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, isLoading: isPending, user, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
