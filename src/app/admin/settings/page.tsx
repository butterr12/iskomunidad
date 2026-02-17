"use client";

import { useReducer } from "react";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { getSettings, setSettings } from "@/lib/admin-store";

export default function SettingsPage() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const settings = getSettings();

  const handleToggleAutoApprove = (value: boolean) => {
    setSettings({ autoApprove: value });
    rerender();
  };

  return (
    <SettingsPanel
      settings={settings}
      onToggleAutoApprove={handleToggleAutoApprove}
    />
  );
}
