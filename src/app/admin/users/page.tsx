"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { UserTable, type AdminUser } from "@/components/admin/user-table";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
import { BanDialog } from "@/components/admin/ban-dialog";
import {
  adminGetAllUsers,
  adminUpdateUserRole,
  adminBanUser,
  adminUnbanUser,
  adminSoftDeleteUser,
  adminRestoreUser,
} from "@/actions/admin";

const USERS_QUERY_KEY = ["admin-users"] as const;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAdminAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sheetBanTarget, setSheetBanTarget] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllUsers();
      return res.success ? (res.data as AdminUser[]) : [];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    if (selectedUserId) {
      await queryClient.invalidateQueries({ queryKey: ["admin-user-detail", selectedUserId] });
    }
  };

  const handleUpdateRole = async (id: string, role: "user" | "admin") => {
    await adminUpdateUserRole(id, role);
    await refresh();
  };

  const handleBan = async (id: string, reason: string) => {
    await adminBanUser(id, reason);
    await refresh();
  };

  const handleUnban = async (id: string) => {
    await adminUnbanUser(id);
    await refresh();
  };

  const handleSoftDelete = async (id: string) => {
    await adminSoftDeleteUser(id);
    await refresh();
  };

  const handleRestore = async (id: string) => {
    await adminRestoreUser(id);
    await refresh();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <UserTable
        users={users}
        currentUserId={currentUser?.id ?? ""}
        onViewDetail={(id) => setSelectedUserId(id)}
      />

      <UserDetailSheet
        userId={selectedUserId}
        currentUserId={currentUser?.id ?? ""}
        onClose={() => setSelectedUserId(null)}
        onUpdateRole={async (id, role) => {
          await handleUpdateRole(id, role);
        }}
        onBan={(id) => setSheetBanTarget(id)}
        onUnban={async (id) => {
          await handleUnban(id);
        }}
        onSoftDelete={async (id) => {
          await handleSoftDelete(id);
        }}
        onRestore={async (id) => {
          await handleRestore(id);
        }}
      />

      {sheetBanTarget && (
        <BanDialog
          open={!!sheetBanTarget}
          userName={users.find((u) => u.id === sheetBanTarget)?.name ?? "User"}
          onClose={() => setSheetBanTarget(null)}
          onConfirm={async (reason) => {
            await handleBan(sheetBanTarget, reason);
            setSheetBanTarget(null);
          }}
        />
      )}
    </>
  );
}
