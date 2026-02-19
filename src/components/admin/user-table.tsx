"use client";

import { useState, useMemo } from "react";
import { Eye, Check, X, Search } from "lucide-react";
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
  onViewDetail,
}: UserTableProps) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewDetail(u.id)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
