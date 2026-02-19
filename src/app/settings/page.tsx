/* eslint-disable */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession, updateUser, changePassword, listAccounts } from "@/lib/auth-client";
import { setPassword } from "@/actions/password";
import { checkUsernameAvailable } from "@/actions/user";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/actions/notifications";
import {
  getPrivacySettings,
  updatePrivacySettings,
  type PrivacySettings,
} from "@/actions/follows";
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
  Shield,
  UserPlus,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { type DisplayFlair } from "@/lib/user-flairs";
import { getMyFlairs, toggleFlairVisibility } from "@/actions/flairs";
import {
  PROFILE_BORDER_CATALOG,
  getBorderById,
  getBordersByTier,
  type BorderDefinition,
} from "@/lib/profile-borders";
import {
  getUserBorderSelectionById,
  setUserBorderSelection,
  getUserUnlockedBorders,
} from "@/actions/borders";
import { getMyReferralSummary } from "@/actions/referrals";
import { BorderedAvatar } from "@/components/bordered-avatar";
import { Lock, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

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

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);
  const [notificationPrefsSaving, setNotificationPrefsSaving] = useState(false);
  const [notificationPrefsMessage, setNotificationPrefsMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Security / password state
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    allowFollowsFrom: "everyone",
    allowMessagesFrom: "everyone",
  });
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Flair state
  const [userFlairs, setUserFlairs] = useState<DisplayFlair[]>([]);

  // Border state
  const [selectedBorder, setSelectedBorder] = useState("none");
  const [unlockedBorders, setUnlockedBorders] = useState<string[]>([]);
  const [borderLoading, setBorderLoading] = useState(false);

  // Referral state
  const [referralLink, setReferralLink] = useState("");
  const [invitedCount, setInvitedCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function loadNotificationPreferences() {
      setNotificationPrefsLoading(true);
      const res = await getNotificationPreferences();
      if (cancelled) return;

      if (res.success) {
        setNotificationPreferences(res.data);
      } else {
        setNotificationPrefsMessage({ type: "error", text: res.error });
      }
      setNotificationPrefsLoading(false);
    }

    void loadNotificationPreferences();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load privacy settings
  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function loadPrivacySettings() {
      setPrivacyLoading(true);
      const res = await getPrivacySettings();
      if (cancelled) return;

      if (res.success) {
        setPrivacySettings(res.data);
      }
      setPrivacyLoading(false);
    }

    void loadPrivacySettings();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load flair data from DB
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadFlairs() {
      const res = await getMyFlairs();
      if (cancelled) return;
      if (res.success) {
        setUserFlairs(res.data);
      }
    }

    void loadFlairs();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load border data from DB
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setBorderLoading(true);

    Promise.all([
      getUserBorderSelectionById(user.id),
      getUserUnlockedBorders(),
    ]).then(([selRes, unlockRes]) => {
      if (cancelled) return;
      if (selRes.success && selRes.data) {
        setSelectedBorder(selRes.data.id);
      }
      if (unlockRes.success) {
        setUnlockedBorders(unlockRes.data);
      }
      setBorderLoading(false);
    });

    return () => { cancelled = true; };
  }, [user?.id]);

  // Load referral data
  const loadReferralData = useCallback(() => {
    if (!user) return;
    setReferralLoading(true);
    getMyReferralSummary().then((res) => {
      if (res.success) {
        setReferralLink(res.data.referralLink);
        setInvitedCount(res.data.invitedCount);
      }
      setReferralLoading(false);
    });
  }, [user?.id]);

  useEffect(() => { loadReferralData(); }, [loadReferralData]);

  async function handleBorderSelect(borderId: string) {
    const prev = selectedBorder;
    setSelectedBorder(borderId); // optimistic
    const res = await setUserBorderSelection(borderId);
    if (res.success) {
      const label = PROFILE_BORDER_CATALOG.find((b) => b.id === borderId)?.label ?? borderId;
      toast.success(`Border set to ${label}`);
    } else {
      setSelectedBorder(prev); // rollback
      toast.error(res.error);
    }
  }

  const MAX_VISIBLE_FLAIRS = 3;

  async function handleFlairToggle(flairId: string, checked: boolean) {
    const visibleCount = userFlairs.filter((f) => f.visible).length;
    if (checked && visibleCount >= MAX_VISIBLE_FLAIRS) {
      toast.error(`You can display at most ${MAX_VISIBLE_FLAIRS} flairs`);
      return;
    }

    // Optimistic update
    const prev = userFlairs;
    setUserFlairs((flairs) =>
      flairs.map((f) => (f.id === flairId ? { ...f, visible: checked } : f)),
    );

    const res = await toggleFlairVisibility(flairId, checked);
    if (!res.success) {
      setUserFlairs(prev); // rollback
      toast.error(res.error);
    }
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
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

      const { error } = await updateUser({ image: imageUrl });
      if (error) throw new Error(error.message ?? "Failed to update avatar");
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

      const { error } = await updateUser(updates);
      if (error) throw new Error(error.message ?? "Failed to save changes");
      setDirty(false);
      setSaveMessage({ type: "success", text: "Profile updated!" });
      if (updates.username) loadReferralData();
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

  async function handlePrivacyChange(
    key: keyof PrivacySettings,
    checked: boolean,
  ) {
    const prev = privacySettings;
    const next = { ...prev, [key]: checked ? "everyone" : "nobody" };
    setPrivacySettings(next);
    setPrivacyMessage(null);
    setPrivacySaving(true);

    const res = await updatePrivacySettings(next);
    if (res.success) {
      setPrivacySettings(res.data);
      setPrivacyMessage({ type: "success", text: "Privacy settings updated." });
    } else {
      setPrivacySettings(prev);
      setPrivacyMessage({ type: "error", text: res.error });
    }

    setPrivacySaving(false);
  }

  async function handleNotificationPreferenceChange(
    key: keyof NotificationPreferences,
    checked: boolean,
  ) {
    const prev = notificationPreferences;
    const next = { ...prev, [key]: checked };
    setNotificationPreferences(next);
    setNotificationPrefsMessage(null);
    setNotificationPrefsSaving(true);

    const res = await updateNotificationPreferences(next);
    if (res.success) {
      setNotificationPreferences(res.data);
      setNotificationPrefsMessage({
        type: "success",
        text: "Notification preferences updated.",
      });
    } else {
      setNotificationPreferences(prev);
      setNotificationPrefsMessage({ type: "error", text: res.error });
    }

    setNotificationPrefsSaving(false);
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
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
                <BorderedAvatar border={getBorderById(selectedBorder)} avatarSize={80}>
                  <Avatar className="size-20">
                    <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                    <AvatarFallback className="text-2xl">{getInitials(user?.name)}</AvatarFallback>
                  </Avatar>
                </BorderedAvatar>
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

        {/* Privacy */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Privacy
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Allow follows</p>
                    <p className="text-xs text-muted-foreground">Let others follow you</p>
                  </div>
                </div>
                <Switch
                  checked={privacySettings.allowFollowsFrom === "everyone"}
                  onCheckedChange={(checked) => {
                    void handlePrivacyChange("allowFollowsFrom", checked);
                  }}
                  disabled={privacyLoading || privacySaving}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Allow messages</p>
                    <p className="text-xs text-muted-foreground">Let others send you messages</p>
                  </div>
                </div>
                <Switch
                  checked={privacySettings.allowMessagesFrom === "everyone"}
                  onCheckedChange={(checked) => {
                    void handlePrivacyChange("allowMessagesFrom", checked);
                  }}
                  disabled={privacyLoading || privacySaving}
                />
              </div>
              {privacyMessage && (
                <>
                  <Separator />
                  <p
                    className={cn(
                      "text-sm",
                      privacyMessage.type === "success"
                        ? "text-green-600"
                        : "text-red-500",
                    )}
                  >
                    {privacyMessage.text}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Referrals */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Referrals
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              {referralLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : referralLink ? (
                <>
                  <div className="flex items-center gap-3">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium">Your referral link</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={referralLink}
                      className="text-sm bg-muted/50"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      aria-label={linkCopied ? "Copied" : "Copy referral link"}
                      onClick={async () => {
                        if (!navigator.clipboard?.writeText) {
                          toast.error("Clipboard copy is not available in this browser.");
                          return;
                        }
                        try {
                          await navigator.clipboard.writeText(referralLink);
                          setLinkCopied(true);
                          toast.success("Referral link copied.");
                          if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                          copyTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
                        } catch {
                          toast.error("Failed to copy referral link. Please copy it manually.");
                        }
                      }}
                    >
                      {linkCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>{linkCopied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {invitedCount === 0
                      ? "No one has signed up with your link yet."
                      : `${invitedCount} ${invitedCount === 1 ? "person" : "people"} signed up with your link.`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set a username above to get your referral link.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Profile Flairs */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Profile Flairs
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                Choose which flairs appear on your profile (max {MAX_VISIBLE_FLAIRS})
              </p>
              {userFlairs.map((flair, i) => (
                <div key={flair.id}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                        style={{
                          backgroundColor: flair.color,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.15)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {flair.label}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {flair.category}
                      </span>
                    </div>
                    <Switch
                      checked={flair.visible}
                      onCheckedChange={(checked) =>
                        handleFlairToggle(flair.id, checked)
                      }
                    />
                  </div>
                </div>
              ))}
              {userFlairs.length === 0 && (
                <p className="text-sm text-muted-foreground">No flairs available yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Profile Border */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Profile Border
          </h2>
          <Card>
            <CardContent className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                Choose a decorative border for your avatar
              </p>

              {/* None — reset */}
              <button
                type="button"
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  selectedBorder === "none" && "ring-2 ring-primary bg-muted/30",
                )}
                onClick={() => handleBorderSelect("none")}
              >
                <Avatar className="size-10">
                  <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                  <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">None</span>
                {selectedBorder === "none" && (
                  <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                )}
              </button>

              {/* Tier: Basic */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBordersByTier().basic.filter((b) => b.id !== "none").map((border) => (
                    <button
                      key={border.id}
                      type="button"
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                        selectedBorder === border.id && "ring-2 ring-primary bg-muted/30",
                      )}
                      onClick={() => handleBorderSelect(border.id)}
                    >
                      <BorderedAvatar avatarSize={48} borderId={border.id}>
                        <Avatar className="size-12">
                          <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                          <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
                        </Avatar>
                      </BorderedAvatar>
                      <span className="text-xs font-medium">{border.label}</span>
                      {selectedBorder === border.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier: Gradients */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gradients</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBordersByTier().gradient.map((border) => {
                    const isLocked = !unlockedBorders.includes(border.id);
                    return (
                      <button
                        key={border.id}
                        type="button"
                        disabled={isLocked}
                        className={cn(
                          "relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                          isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted/50",
                          selectedBorder === border.id && !isLocked && "ring-2 ring-primary bg-muted/30",
                        )}
                        onClick={() => !isLocked && handleBorderSelect(border.id)}
                      >
                        <BorderedAvatar avatarSize={48} borderId={border.id}>
                          <Avatar className="size-12">
                            <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                            <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
                          </Avatar>
                        </BorderedAvatar>
                        <span className="text-xs font-medium">{border.label}</span>
                        {isLocked && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground absolute top-2 right-2" />
                        )}
                        {selectedBorder === border.id && !isLocked && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tier: Exclusive */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exclusive</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBordersByTier().exclusive.map((border) => {
                    const isLocked = !unlockedBorders.includes(border.id);
                    return (
                      <button
                        key={border.id}
                        type="button"
                        disabled={isLocked}
                        className={cn(
                          "relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                          isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted/50",
                          selectedBorder === border.id && !isLocked && "ring-2 ring-primary bg-muted/30",
                        )}
                        onClick={() => !isLocked && handleBorderSelect(border.id)}
                      >
                        <BorderedAvatar avatarSize={48} borderId={border.id}>
                          <Avatar className="size-12">
                            <AvatarImage src={avatarUrl} alt={user?.name ?? "User"} />
                            <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
                          </Avatar>
                        </BorderedAvatar>
                        <span className="text-xs font-medium">{border.label}</span>
                        {isLocked && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground absolute top-2 right-2" />
                        )}
                        {selectedBorder === border.id && !isLocked && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

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
                <Switch
                  checked={notificationPreferences.posts}
                  onCheckedChange={(checked) => {
                    void handleNotificationPreferenceChange("posts", checked);
                  }}
                  disabled={notificationPrefsLoading || notificationPrefsSaving}
                />
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
                <Switch
                  checked={notificationPreferences.events}
                  onCheckedChange={(checked) => {
                    void handleNotificationPreferenceChange("events", checked);
                  }}
                  disabled={notificationPrefsLoading || notificationPrefsSaving}
                />
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
                <Switch
                  checked={notificationPreferences.gigs}
                  onCheckedChange={(checked) => {
                    void handleNotificationPreferenceChange("gigs", checked);
                  }}
                  disabled={notificationPrefsLoading || notificationPrefsSaving}
                />
              </div>
              {notificationPrefsMessage && (
                <>
                  <Separator />
                  <p
                    className={cn(
                      "text-sm",
                      notificationPrefsMessage.type === "success"
                        ? "text-green-600"
                        : "text-red-500",
                    )}
                  >
                    {notificationPrefsMessage.text}
                  </p>
                </>
              )}
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
