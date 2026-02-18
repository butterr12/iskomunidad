"use client";

import { useState, useMemo } from "react";
import { Shield, Ban, CheckCircle, Trash2, RotateCcw, Eye, Check, X, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BanDialog } from "./ban-dialog";
import { ConfirmDialog } from "./confirm-dialog";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
  deletedAt: string | null;
}

interface UserTableProps {
  users: AdminUser[];
  currentUserId: string;
  onUpdateRole: (id: string, role: "user" | "admin") => void;
  onBan: (id: string, reason: string) => void;
  onUnban: (id: string) => void;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onViewDetail: (id: string) => void;
}

const STATUS_BADGE: Record<string, { variant: "default" | "destructive" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  banned: { variant: "destructive", label: "Banned" },
  deleted: { variant: "outline", label: "Deleted" },
};

const ROLE_BADGE: Record<string, "default" | "secondary"> = {
  admin: "default",
  user: "secondary",
};

export function UserTable({
  users,
  currentUserId,
  onUpdateRole,
  onBan,
  onUnban,
  onSoftDelete,
  onRestore,
  onViewDetail,
}: UserTableProps) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", confirmLabel: "", variant: "default", onConfirm: () => {} });

  const counts = useMemo(() => {
    const c = { all: users.length, active: 0, banned: 0, deleted: 0 };
    for (const u of users) {
      const s = (u.status ?? "active") as keyof typeof c;
      if (s in c) c[s]++;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    let result = users;
    if (tab !== "all") {
      result = result.filter((u) => (u.status ?? "active") === tab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, tab, search]);

  const handleRoleToggle = (u: AdminUser) => {
    const newRole = u.role === "admin" ? "user" : "admin";
    const action = newRole === "admin" ? "Promote" : "Demote";
    setConfirmState({
      open: true,
      title: `${action} User`,
      description: `Are you sure you want to ${action.toLowerCase()} "${u.name}" to ${newRole}?`,
      confirmLabel: action,
      variant: "default",
      onConfirm: () => {
        onUpdateRole(u.id, newRole);
        setConfirmState((s) => ({ ...s, open: false }));
      },
    });
  };

  const handleSoftDelete = (u: AdminUser) => {
    setConfirmState({
      open: true,
      title: "Delete User",
      description: `Are you sure you want to soft-delete "${u.name}"? They can be restored later.`,
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: () => {
        onSoftDelete(u.id);
        setConfirmState((s) => ({ ...s, open: false }));
      },
    });
  };

  const handleRestore = (u: AdminUser) => {
    setConfirmState({
      open: true,
      title: "Restore User",
      description: `Are you sure you want to restore "${u.name}"?`,
      confirmLabel: "Restore",
      variant: "default",
      onConfirm: () => {
        onRestore(u.id);
        setConfirmState((s) => ({ ...s, open: false }));
      },
    });
  };

  const handleUnban = (u: AdminUser) => {
    setConfirmState({
      open: true,
      title: "Unban User",
      description: `Are you sure you want to unban "${u.name}"?`,
      confirmLabel: "Unban",
      variant: "default",
      onConfirm: () => {
        onUnban(u.id);
        setConfirmState((s) => ({ ...s, open: false }));
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="banned">Banned ({counts.banned})</TabsTrigger>
            <TabsTrigger value="deleted">Deleted ({counts.deleted})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const status = u.status ?? "active";
                const badge = STATUS_BADGE[status] ?? STATUS_BADGE.active;
                const isSelf = u.id === currentUserId;

                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.image ?? undefined} />
                          <AvatarFallback className="text-xs">{u.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[120px]">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[160px]">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.username ? `@${u.username}` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE[u.role] ?? "secondary"} className="capitalize">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.emailVerified ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!isSelf && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title={u.role === "admin" ? "Demote to user" : "Promote to admin"}
                            onClick={() => handleRoleToggle(u)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        )}
                        {!isSelf && status === "active" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            title="Ban user"
                            onClick={() => setBanTarget(u)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {!isSelf && status === "banned" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            title="Unban user"
                            onClick={() => handleUnban(u)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {!isSelf && status !== "deleted" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            title="Soft delete"
                            onClick={() => handleSoftDelete(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {!isSelf && status === "deleted" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            title="Restore user"
                            onClick={() => handleRestore(u)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="View details"
                          onClick={() => onViewDetail(u.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {banTarget && (
        <BanDialog
          open={!!banTarget}
          userName={banTarget.name}
          onClose={() => setBanTarget(null)}
          onConfirm={(reason) => {
            onBan(banTarget.id, reason);
            setBanTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onClose={() => setConfirmState((s) => ({ ...s, open: false }))}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
