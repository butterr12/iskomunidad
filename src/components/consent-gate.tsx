"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  checkConsentStatus,
  recordConsent,
  setUserUniversity,
  UP_CAMPUSES,
} from "@/actions/auth";
import { updateUser, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ─── Gate types ──────────────────────────────────────────────────────────────

interface GateContext {
  hasValidConsent: boolean;
  userName: string | undefined;
  displayUsername: string | undefined;
  university: string | undefined;
}

interface OnboardingGate {
  id: string;
  /** Return true if this gate should be shown */
  isNeeded: (ctx: GateContext) => boolean;
  /** The component to render */
  component: React.ComponentType<{ onComplete: () => void }>;
}

// ─── Step components ─────────────────────────────────────────────────────────

function LegalConsentStep({ onComplete }: { onComplete: () => void }) {
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [ageConsentAttestation, setAgeConsentAttestation] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordConsent({
        agreedToTerms: true,
        agreedToPrivacy: true,
        ageAttested: true,
        guardianConsentAttested: true,
      }),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error);
        return;
      }
      onComplete();
    },
    onError: () => {
      setError("Something went wrong. Please try again.");
    },
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          Terms &amp; Privacy
        </CardTitle>
        <CardDescription>
          Please review and accept our terms to continue using iSkomunidad.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          mutation.mutate();
        }}
        className="flex flex-col gap-6"
      >
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
                required
              />
              <span>
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={ageConsentAttestation}
                onChange={(e) => setAgeConsentAttestation(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
                required
              />
              <span>
                I attest that I am at least 16 years old. If I am under 18, I
                attest that I have explicit consent from my parent or legal
                guardian.
              </span>
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={
              !acceptedLegal || !ageConsentAttestation || mutation.isPending
            }
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function NameCollectionStep({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      const res = await updateUser({ name: trimmed });
      if (res.error) {
        setError(res.error.message ?? "Failed to save name");
      } else {
        onComplete();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          Welcome to iSkomunidad!
        </CardTitle>
        <CardDescription>
          What should we call you? You can always change this later in settings.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              placeholder="e.g. Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={100}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function UniversityStep({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await setUserUniversity(selected);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Your UP Campus</CardTitle>
        <CardDescription>Which UP campus are you from?</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <CardContent className="space-y-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            {UP_CAMPUSES.map((campus) => (
              <label
                key={campus.value}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                  selected === campus.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="university"
                  value={campus.value}
                  checked={selected === campus.value}
                  onChange={() => setSelected(campus.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">{campus.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={!selected || saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// ─── Step dots ───────────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i === current
              ? "bg-primary"
              : i < current
                ? "bg-primary/40"
                : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

// ─── Gates definition ────────────────────────────────────────────────────────

const ONBOARDING_GATES: OnboardingGate[] = [
  {
    id: "legal-consent",
    isNeeded: (ctx) => !ctx.hasValidConsent,
    component: LegalConsentStep,
  },
  {
    id: "name-collection",
    isNeeded: (ctx) => !ctx.userName || !ctx.displayUsername,
    component: NameCollectionStep,
  },
  {
    id: "university",
    isNeeded: (ctx) => !ctx.university,
    component: UniversityStep,
  },
];

// ─── Main gate component ─────────────────────────────────────────────────────

interface ConsentGateProps {
  session: { user: { id: string; name?: string } } | null | undefined;
  children: React.ReactNode;
}

export function ConsentGate({ session, children }: ConsentGateProps) {
  const queryClient = useQueryClient();
  const { data: liveSession } = useSession();
  const [completedGateIds, setCompletedGateIds] = useState<Set<string>>(
    new Set(),
  );
  const initialCountRef = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ["consent-status"],
    queryFn: async () => {
      const res = await checkConsentStatus();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!session,
  });

  // No session — render children (public pages, or auth handles redirect)
  if (!session) return <>{children}</>;

  // Loading consent status
  if (isLoading) return null;

  const ctx: GateContext = {
    hasValidConsent: data?.hasValidConsent ?? false,
    userName: liveSession?.user?.name || session?.user?.name || undefined,
    displayUsername: liveSession?.user?.displayUsername ?? undefined,
    university: liveSession?.user?.university ?? undefined,
  };

  const neededGates = ONBOARDING_GATES.filter(
    (g) => g.isNeeded(ctx) && !completedGateIds.has(g.id),
  );

  // Capture the initial gate count on first evaluation
  if (initialCountRef.current === 0 && neededGates.length > 0) {
    initialCountRef.current = neededGates.length;
  }

  // All gates cleared — render children
  if (neededGates.length === 0) return <>{children}</>;

  const currentGate = neededGates[0];
  const StepComponent = currentGate.component;
  const totalSteps = Math.max(initialCountRef.current, neededGates.length);
  const currentStepIndex = totalSteps - neededGates.length;

  function handleComplete() {
    setCompletedGateIds((prev) => new Set(prev).add(currentGate.id));
    queryClient.invalidateQueries({ queryKey: ["consent-status"] });
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {totalSteps > 1 && (
          <StepDots total={totalSteps} current={currentStepIndex} />
        )}
        <StepComponent onComplete={handleComplete} />
      </div>
    </div>
  );
}
