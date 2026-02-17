"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "@/lib/auth-client";
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
  Sun,
  Moon,
  Monitor,
  Bell,
  CalendarCheck,
  Bookmark,
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

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(displayUsername ?? "");

  const [notifPosts, setNotifPosts] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifGigs, setNotifGigs] = useState(false);

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
              <Avatar className="size-20">
                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
                <AvatarFallback className="text-2xl">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
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
                  onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground bg-muted/50">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user?.email ?? "—"}</span>
                  {user?.emailVerified && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
                  )}
                </div>
              </div>
              <Button size="sm" className="w-full">
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Appearance
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                      theme === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <opt.icon className={cn(
                      "h-5 w-5",
                      theme === opt.value ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-xs font-medium",
                      theme === opt.value ? "text-primary" : "text-muted-foreground"
                    )}>
                      {opt.label}
                    </span>
                  </button>
                ))}
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
