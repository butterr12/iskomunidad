"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTEREST_TAGS, CATEGORY_LABELS, type PromptCategory } from "@/lib/match-constants";
import { saveMatchProfile } from "@/actions/match";
import { toast } from "sonner";

interface Prompt {
  id: string;
  category: string;
  promptText: string;
  sortOrder: number;
}

interface MatchProfileSetupProps {
  prompts: Prompt[];
  existingProfile?: {
    interests: string[];
    prompts: Array<{ promptId: string; answer: string; sortOrder: number }>;
  } | null;
  onComplete: () => void;
}

export function MatchProfileSetup({
  prompts,
  existingProfile,
  onComplete,
}: MatchProfileSetupProps) {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<string[]>(
    existingProfile?.interests ?? [],
  );
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>(
    existingProfile?.prompts.map((p) => p.promptId) ?? [],
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      existingProfile?.prompts.forEach((p) => {
        map[p.promptId] = p.answer;
      });
      return map;
    },
  );
  const [saving, setSaving] = useState(false);

  const toggleInterest = useCallback((tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }, []);

  const togglePrompt = useCallback((promptId: string) => {
    setSelectedPromptIds((prev) => {
      if (prev.includes(promptId)) return prev.filter((id) => id !== promptId);
      if (prev.length >= 3) return prev;
      return [...prev, promptId];
    });
  }, []);

  const canAdvanceStep1 = interests.length >= 3;
  const canAdvanceStep2 = selectedPromptIds.length >= 2;
  const canSubmit =
    selectedPromptIds.length >= 2 &&
    selectedPromptIds.every((id) => (answers[id]?.trim().length ?? 0) > 0);

  const handleSubmit = async () => {
    setSaving(true);
    const result = await saveMatchProfile({
      interests,
      prompts: selectedPromptIds.map((id, i) => ({
        promptId: id,
        answer: answers[id]?.trim() ?? "",
        sortOrder: i,
      })),
    });
    setSaving(false);

    if (result.success) {
      onComplete();
    } else {
      toast.error(result.error);
    }
  };

  // Group prompts by category
  const grouped = prompts.reduce<Record<string, Prompt[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 py-4 shrink-0">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              s === step ? "w-8 bg-primary" : "w-4 bg-muted-foreground/20",
              s < step && "bg-primary/50",
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Pick your interests</h2>
              <p className="text-sm text-muted-foreground">
                Choose 3-5 tags that describe you
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {INTEREST_TAGS.map((tag) => {
                const selected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {interests.length}/5 selected (min 3)
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Choose your prompts</h2>
              <p className="text-sm text-muted-foreground">
                Pick 2-3 prompts to answer on your card
              </p>
            </div>
            {Object.entries(grouped).map(([cat, catPrompts]) => (
              <div key={cat} className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[cat as PromptCategory] ?? cat}
                </h3>
                {catPrompts.map((p) => {
                  const selected = selectedPromptIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePrompt(p.id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{p.promptText}</span>
                        {selected && (
                          <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground">
              {selectedPromptIds.length}/3 selected (min 2)
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Write your answers</h2>
              <p className="text-sm text-muted-foreground">
                This is what others will see on your card
              </p>
            </div>
            {selectedPromptIds.map((promptId) => {
              const prompt = prompts.find((p) => p.id === promptId);
              if (!prompt) return null;
              const answer = answers[promptId] ?? "";
              return (
                <div key={promptId} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {prompt.promptText}
                  </label>
                  <Textarea
                    placeholder="Your answer..."
                    value={answer}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [promptId]: e.target.value,
                      }))
                    }
                    maxLength={200}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {answer.length}/200
                  </p>
                </div>
              );
            })}

            {/* Mini preview */}
            {canSubmit && (
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Card preview
                </p>
                <div className="flex flex-wrap gap-1">
                  {interests.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {selectedPromptIds.map((promptId) => {
                  const prompt = prompts.find((p) => p.id === promptId);
                  const answer = answers[promptId];
                  if (!prompt || !answer?.trim()) return null;
                  return (
                    <div key={promptId} className="rounded-lg bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">
                        {prompt.promptText}
                      </p>
                      <p className="text-xs font-medium">
                        &ldquo;{answer.trim()}&rdquo;
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t px-4 py-3 shrink-0">
        {step > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <Button
            size="sm"
            disabled={step === 1 ? !canAdvanceStep1 : !canAdvanceStep2}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!canSubmit || saving}
            onClick={handleSubmit}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            {existingProfile ? "Save Changes" : "Start Matching"}
          </Button>
        )}
      </div>
    </div>
  );
}
