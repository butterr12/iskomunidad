"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { adminGetSettings, adminUpdateSettings } from "@/actions/admin";
import type { ApprovalMode, ModerationPreset } from "@/actions/_helpers";

interface SettingsState {
  approvalMode: ApprovalMode;
  moderationPreset: ModerationPreset;
  customModerationRules: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null);

  useEffect(() => {
    adminGetSettings().then((res) => {
      if (res.success) setSettings(res.data);
    });
  }, []);

  const handleApprovalModeChange = async (mode: ApprovalMode) => {
    setSettings((prev) => prev && { ...prev, approvalMode: mode });
    await adminUpdateSettings({ approvalMode: mode });
  };

  const handleModerationPresetChange = async (preset: ModerationPreset) => {
    if (!settings) return;
    setSettings((prev) => prev && { ...prev, moderationPreset: preset });
    await adminUpdateSettings({
      approvalMode: settings.approvalMode,
      moderationPreset: preset,
    });
  };

  const handleCustomRulesChange = (rules: string) => {
    setSettings((prev) => prev && { ...prev, customModerationRules: rules });
  };

  const handleCustomRulesSave = async () => {
    if (!settings) return;
    await adminUpdateSettings({
      approvalMode: settings.approvalMode,
      customModerationRules: settings.customModerationRules,
    });
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
      onApprovalModeChange={handleApprovalModeChange}
      onModerationPresetChange={handleModerationPresetChange}
      onCustomRulesChange={handleCustomRulesChange}
      onCustomRulesSave={handleCustomRulesSave}
    />
  );
}
