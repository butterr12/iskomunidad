"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Ban,
  CheckCircle,
  Trash2,
  RotateCcw,
  Loader2,
  FileText,
  Calendar,
  Briefcase,
  MapPin,
  Check,
  X,
} from "lucide-react";
import { adminGetUserDetail, adminGetUserFlairs, adminGrantFlair, adminRevokeFlair } from "@/actions/admin";
import { adminGetUserUnlockedBorders, adminGrantBorder, adminRevokeBorder, getUserBorderSelectionById } from "@/actions/borders";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { USER_FLAIR_CATALOG, getProvisionedFlairIds } from "@/lib/user-flairs";
import { PROFILE_BORDER_CATALOG, type BorderDefinition } from "@/lib/profile-borders";

interface AdminUser {
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

interface UserDetailSheetProps {
  userId: string | null;
  currentUserId: string;
  onClose: () => void;
  onUpdateRole: (id: string, role: "user" | "admin") => void;
  onBan: (id: string) => void;
  onUnban: (id: string) => void;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

const ROLE_BADGE: Record<string, "default" | "secondary"> = {
  admin: "default",
  user: "secondary",
};

const STATUS_BADGE: Record<string, { variant: "default" | "destructive" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  banned: { variant: "destructive", label: "Banned" },
  deleted: { variant: "outline", label: "Deleted" },
};

export function UserDetailSheet({
  userId,
  currentUserId,
  onClose,
  onUpdateRole,
  onBan,
  onUnban,
  onSoftDelete,
  onRestore,
}: UserDetailSheetProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await adminGetUserDetail(userId);
      return res.success ? (res.data as { user: AdminUser; counts: { posts: number; events: number; gigs: number; locations: number } }) : null;
    },
    enabled: !!userId,
  });

  const { data: userFlairs = [] } = useQuery({
    queryKey: ["admin-user-flairs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await adminGetUserFlairs(userId);
      return res.success ? res.data : [];
    },
    enabled: !!userId,
  });

  const grantMutation = useMutation({
    mutationFn: async (flairId: string) => {
      if (!userId) throw new Error("No user");
      const res = await adminGrantFlair(userId, flairId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-flairs", userId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (flairId: string) => {
      if (!userId) throw new Error("No user");
      const res = await adminRevokeFlair(userId, flairId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-flairs", userId] });
    },
  });

  const ownedFlairIds = new Set(userFlairs.map((f) => f.id));
  const grantableFlairs = USER_FLAIR_CATALOG.filter(
    (f) => getProvisionedFlairIds().includes(f.id) && !ownedFlairIds.has(f.id),
  );

  // ─── Borders ──────────────────────────────────────────────────────────────
  const { data: unlockedBorders = [] } = useQuery({
    queryKey: ["admin-user-borders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await adminGetUserUnlockedBorders(userId);
      return res.success ? res.data : [];
    },
    enabled: !!userId,
  });

  const { data: selectedBorder = null } = useQuery({
    queryKey: ["admin-user-selected-border", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await getUserBorderSelectionById(userId);
      return res.success ? res.data : null;
    },
    enabled: !!userId,
  });

  const borderGrantMutation = useMutation({
    mutationFn: async (borderId: string) => {
      if (!userId) throw new Error("No user");
      const res = await adminGrantBorder(userId, borderId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-borders", userId] });
    },
  });

  const borderRevokeMutation = useMutation({
    mutationFn: async (borderId: string) => {
      if (!userId) throw new Error("No user");
      const res = await adminRevokeBorder(userId, borderId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user-borders", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-user-selected-border", userId] });
    },
  });

  const unlockedBorderIds = new Set(unlockedBorders.map((b) => b.id));
  const grantableBorders = PROFILE_BORDER_CATALOG.filter(
    (b) => b.tier !== "basic" && !unlockedBorderIds.has(b.id),
  );

  const user = data?.user;
  const counts = data?.counts;
  const isSelf = user?.id === currentUserId;
  const statusBadge = STATUS_BADGE[user?.status ?? "active"] ?? STATUS_BADGE.active;

  return (
    <Sheet open={!!userId} onOpenChange={() => onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>View user profile and content summary.</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <div className="space-y-6 p-4 pt-0">
            {/* Profile */}
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback>{user.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                {user.username && (
                  <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                )}
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <Separator />

            {/* Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant={ROLE_BADGE[user.role] ?? "secondary"} className="capitalize">{user.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email Verified</span>
                {user.emailVerified ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Joined</span>
                <span className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              {user.banReason && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Ban Reason</span>
                  <p className="text-sm bg-destructive/10 text-destructive rounded-md px-3 py-2">{user.banReason}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Content Counts */}
            {counts && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Content</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{counts.posts} Posts</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{counts.events} Events</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{counts.gigs} Gigs</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{counts.locations} Locations</span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Flairs */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Flairs</p>
              {userFlairs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userFlairs.map((flair) => (
                    <span
                      key={flair.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: flair.color }}
                    >
                      {flair.label}
                      {flair.tier !== "basic" && (
                        <button
                          type="button"
                          className="ml-0.5 hover:opacity-80"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(flair.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No flairs yet</p>
              )}
              {grantableFlairs.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        grantMutation.mutate(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    disabled={grantMutation.isPending}
                  >
                    <option value="" disabled>
                      Grant a flair...
                    </option>
                    {grantableFlairs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(grantMutation.isError || revokeMutation.isError) && (
                <p className="text-xs text-red-500">
                  {(grantMutation.error ?? revokeMutation.error)?.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Borders */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Borders</p>
              {selectedBorder && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Selected:</span>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{ background: selectedBorder.color }}
                  >
                    {selectedBorder.label}
                  </span>
                </div>
              )}
              {unlockedBorders.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {unlockedBorders.map((border) => (
                    <span
                      key={border.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ background: border.color }}
                    >
                      {border.label}
                      {border.tier !== "basic" && (
                        <button
                          type="button"
                          className="ml-0.5 hover:opacity-80"
                          disabled={borderRevokeMutation.isPending}
                          onClick={() => borderRevokeMutation.mutate(border.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No unlocked borders</p>
              )}
              {grantableBorders.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        borderGrantMutation.mutate(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    disabled={borderGrantMutation.isPending}
                  >
                    <option value="" disabled>
                      Grant a border...
                    </option>
                    {grantableBorders.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} ({b.tier})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(borderGrantMutation.isError || borderRevokeMutation.isError) && (
                <p className="text-xs text-red-500">
                  {(borderGrantMutation.error ?? borderRevokeMutation.error)?.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Quick Actions */}
            {!isSelf && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpdateRole(user.id, user.role === "admin" ? "user" : "admin")}
                  >
                    <Shield className="mr-1 h-4 w-4" />
                    {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                  </Button>
                  {user.status === "active" && (
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => onBan(user.id)}>
                      <Ban className="mr-1 h-4 w-4" />
                      Ban
                    </Button>
                  )}
                  {user.status === "banned" && (
                    <Button size="sm" variant="outline" onClick={() => onUnban(user.id)}>
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Unban
                    </Button>
                  )}
                  {user.status !== "deleted" && (
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => onSoftDelete(user.id)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  {user.status === "deleted" && (
                    <Button size="sm" variant="outline" onClick={() => onRestore(user.id)}>
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">User not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
