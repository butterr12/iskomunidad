"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AdminSettings } from "@/lib/admin-store";

interface SettingsPanelProps {
  settings: AdminSettings;
  onToggleAutoApprove: (value: boolean) => void;
}

export function SettingsPanel({ settings, onToggleAutoApprove }: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Post Moderation</CardTitle>
          <CardDescription>Configure how new community posts are handled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-approve" className="text-sm font-medium">
                Auto-approve new posts
              </Label>
              <p className="text-xs text-muted-foreground">
                {settings.autoApprove
                  ? "New posts go live immediately without admin review."
                  : "New posts are saved as drafts and require admin approval."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={settings.autoApprove ? "default" : "secondary"}>
                {settings.autoApprove ? "ON" : "OFF"}
              </Badge>
              <Switch
                id="auto-approve"
                checked={settings.autoApprove}
                onCheckedChange={onToggleAutoApprove}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Credentials</CardTitle>
          <CardDescription>Mock credentials for development.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <code className="rounded bg-muted px-2 py-0.5">admin@iskomunidad.ph</code>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Password</span>
            <code className="rounded bg-muted px-2 py-0.5">admin1234</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
