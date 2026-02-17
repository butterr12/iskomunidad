"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { adminGetSettings, adminUpdateSettings } from "@/actions/admin";

export default function SettingsPage() {
  const [settings, setSettings] = useState<{ autoApprove: boolean } | null>(null);

  useEffect(() => {
    adminGetSettings().then((res) => {
      if (res.success) setSettings(res.data);
    });
  }, []);

  const handleToggleAutoApprove = async (value: boolean) => {
    await adminUpdateSettings({ autoApprove: value });
    setSettings({ autoApprove: value });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SettingsPanel
      settings={settings}
      onToggleAutoApprove={handleToggleAutoApprove}
    />
  );
}
