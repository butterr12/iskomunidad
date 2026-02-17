"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession, updateUser, changePassword, listAccounts } from "@/lib/auth-client";
import { setPassword } from "@/actions/password";
import { checkUsernameAvailable } from "@/actions/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  LogOut,
  Bell,
  CalendarCheck,
  Bookmark,
  Camera,
  Loader2,
  XCircle,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatMemberSince(dateStr?: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const usernameCheckIdRef = useRef(0);

  const [notifPosts, setNotifPosts] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifGigs, setNotifGigs] = useState(false);

  // Security / password state
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state when session loads, but only if user hasn't started editing
  useEffect(() => {
    if (user && !dirty) {
      setName(user.name ?? "");
      setUsername(displayUsername ?? "");
      setAvatarUrl(user.image ?? undefined);
    }
  }, [user, displayUsername, dirty]);

  // Check if user has a credential (password) account
  const checkAccounts = useCallback(async () => {
    const { data } = await listAccounts();
    const hasCred = data?.some((a) => a.providerId === "credential") ?? false;
    setHasCredential(hasCred);
  }, []);

  useEffect(() => {
    if (user) checkAccounts();
  }, [user, checkAccounts]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, []);

  // Debounced username availability check with stale-response guard
  const checkUsername = useCallback(
    (value: string) => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

      if (!value || value === displayUsername) {
        setUsernameStatus("idle");
        return;
      }

      setUsernameStatus("checking");
      const checkId = ++usernameCheckIdRef.current;
      usernameTimerRef.current = setTimeout(async () => {
        const available = await checkUsernameAvailable(value);
        if (usernameCheckIdRef.current === checkId) {
          setUsernameStatus(available ? "available" : "taken");
        }
      }, 500);
    },
    [displayUsername],
  );

  function handleNameChange(value: string) {
    setName(value);
    setDirty(true);
  }

  function handleUsernameChange(value: string) {
    setUsername(value);
    setDirty(true);
    checkUsername(value);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const { key } = await uploadRes.json();
      const imageUrl = `/api/photos/${key}`;

      await updateUser({ image: imageUrl });
      setAvatarUrl(imageUrl);
    } catch (err) {
      setSaveMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const updates: Record<string, string> = {};
      if (name !== (user?.name ?? "")) updates.name = name;
      if (username !== (displayUsername ?? "")) updates.username = username;

      if (Object.keys(updates).length === 0) {
        setSaveMessage({ type: "success", text: "No changes to save" });
        return;
      }

      if (usernameStatus === "taken") {
        setSaveMessage({ type: "error", text: "Username is already taken" });
        return;
      }

      await updateUser(updates);
      setDirty(false);
      setSaveMessage({ type: "success", text: "Profile updated!" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save changes",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit() {
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setPasswordSaving(true);
    try {
      if (hasCredential) {
        // Change existing password
        const { error } = await changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
        if (error) {
          setPasswordMessage({ type: "error", text: error.message ?? "Failed to update password" });
          return;
        }
        setPasswordMessage({ type: "success", text: "Password updated!" });
      } else {
        // Set password for the first time (magic-link user)
        const result = await setPassword(newPassword);
        if (!result.success) {
          setPasswordMessage({ type: "error", text: result.error });
          return;
        }
        setPasswordMessage({ type: "success", text: "Password set!" });
        await checkAccounts();
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 p-4 pb-12">
        {/* Profile Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 py-8">
            <div className="flex flex-col items-center text-center gap-3">
              <button
                type="button"
                className="relative group"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Avatar className="size-20">
                  <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                  <AvatarFallback className="text-2xl">{getInitials(user?.name)}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </button>
              <div>
                <p className="text-xl font-bold">{user?.name ?? "User"}</p>
                {displayUsername && (
                  <p className="text-sm text-muted-foreground">@{displayUsername}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Member since {formatMemberSince(user?.createdAt as string | undefined)}
                </Badge>
                {user?.emailVerified && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Edit Profile */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Edit Profile
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="username"
                    className="pl-7 pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && (
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                    {usernameStatus === "available" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {usernameStatus === "taken" && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                </div>
                {usernameStatus === "taken" && (
                  <p className="text-xs text-red-500">Username is already taken</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground bg-muted/50">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user?.email ?? "\u2014"}</span>
                  {user?.emailVerified && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
                  )}
                </div>
              </div>
              {saveMessage && (
                <p
                  className={cn(
                    "text-sm",
                    saveMessage.type === "success" ? "text-green-600" : "text-red-500",
                  )}
                >
                  {saveMessage.text}
                </p>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={handleSave}
                disabled={saving || usernameStatus === "taken"}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Security */}
        {hasCredential !== null && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Security
            </h2>
            <Card>
              <CardContent className="space-y-4 p-4">
                {!hasCredential && (
                  <div className="flex items-start gap-3 rounded-md border px-3 py-2 bg-muted/50">
                    <KeyRound className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      You signed in with a magic link. Set up a password to sign in with email and password.
                    </p>
                  </div>
                )}
                {hasCredential && (
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                {passwordMessage && (
                  <p
                    className={cn(
                      "text-sm",
                      passwordMessage.type === "success" ? "text-green-600" : "text-red-500",
                    )}
                  >
                    {passwordMessage.text}
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handlePasswordSubmit}
                  disabled={passwordSaving}
                >
                  {passwordSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {hasCredential ? "Update password" : "Set password"}
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Notifications */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Notifications
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Community Posts</p>
                    <p className="text-xs text-muted-foreground">New posts and replies</p>
                  </div>
                </div>
                <Switch checked={notifPosts} onCheckedChange={setNotifPosts} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Events</p>
                    <p className="text-xs text-muted-foreground">Event reminders and updates</p>
                  </div>
                </div>
                <Switch checked={notifEvents} onCheckedChange={setNotifEvents} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Gigs</p>
                    <p className="text-xs text-muted-foreground">New gigs matching your interests</p>
                  </div>
                </div>
                <Switch checked={notifGigs} onCheckedChange={setNotifGigs} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Sign Out */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
