"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalMode, ModerationPreset } from "@/actions/_helpers";

interface AdminSettings {
  approvalMode: ApprovalMode;
  moderationPreset: ModerationPreset;
  customModerationRules: string;
}

interface SettingsPanelProps {
  settings: AdminSettings;
  onApprovalModeChange: (mode: ApprovalMode) => void;
  onModerationPresetChange: (preset: ModerationPreset) => void;
  onCustomRulesChange: (rules: string) => void;
  onCustomRulesSave: () => void;
}

const APPROVAL_MODES: { value: ApprovalMode; label: string; description: string }[] = [
  {
    value: "auto",
    label: "Auto-approve",
    description: "New content goes live immediately without review",
  },
  {
    value: "manual",
    label: "Manual review",
    description: "New content is saved as draft, requires admin approval",
  },
  {
    value: "ai",
    label: "AI moderation",
    description: "AI screens content — approves clean content, rejects violations",
  },
];

const MODERATION_PRESETS: { value: ModerationPreset; label: string; description: string }[] = [
  {
    value: "strict",
    label: "Strict",
    description: "Blocks spam, hate speech, explicit content, harassment, and strong language",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Allows frustrated/emotional posts if not targeting individuals. Blocks NSFW, spam, and personal attacks",
  },
  {
    value: "relaxed",
    label: "Relaxed",
    description: "Only blocks NSFW, targeted harassment, and scams/illegal content",
  },
];

export function SettingsPanel({
  settings,
  onApprovalModeChange,
  onModerationPresetChange,
  onCustomRulesChange,
  onCustomRulesSave,
}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content Moderation</CardTitle>
          <CardDescription>Configure how new community content is handled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {APPROVAL_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onApprovalModeChange(mode.value)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                settings.approvalMode === mode.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              }`}
            >
              <div className="space-y-0.5">
                <Label className="text-sm font-medium cursor-pointer">
                  {mode.label}
                </Label>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
              </div>
              {settings.approvalMode === mode.value && (
                <Badge variant="default" className="ml-2 shrink-0">Active</Badge>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      {settings.approvalMode === "ai" && (
        <Card>
          <CardHeader>
            <CardTitle>AI Moderation Guidelines</CardTitle>
            <CardDescription>Choose how strict the AI moderator should be.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {MODERATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onModerationPresetChange(preset.value)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    settings.moderationPreset === preset.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium cursor-pointer">
                      {preset.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  {settings.moderationPreset === preset.value && (
                    <Badge variant="default" className="ml-2 shrink-0">Active</Badge>
                  )}
                </button>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="custom-rules" className="text-sm font-medium">
                Custom rules (optional)
              </Label>
              <Textarea
                id="custom-rules"
                placeholder="Add extra rules for the AI moderator, e.g. 'Also reject posts about pyramid schemes'"
                value={settings.customModerationRules}
                onChange={(e) => onCustomRulesChange(e.target.value)}
                onBlur={onCustomRulesSave}
                maxLength={2000}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {settings.customModerationRules.length} / 2000
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
