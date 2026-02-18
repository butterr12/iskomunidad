"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { checkConsentStatus, recordConsent } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ConsentGateProps {
  session: { user: { id: string } } | null | undefined;
  children: React.ReactNode;
}

export function ConsentGate({ session, children }: ConsentGateProps) {
  const queryClient = useQueryClient();
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [ageConsentAttestation, setAgeConsentAttestation] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["consent-status"],
    queryFn: async () => {
      const res = await checkConsentStatus();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!session,
  });

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
      queryClient.invalidateQueries({ queryKey: ["consent-status"] });
    },
    onError: () => {
      setError("Something went wrong. Please try again.");
    },
  });

  // No session — render children (public pages, or auth handles redirect)
  if (!session) return <>{children}</>;

  // Loading consent status
  if (isLoading) return null;

  // Consent is valid — render app
  if (data?.hasValidConsent) return <>{children}</>;

  // Show consent gate
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
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
    </div>
  );
}
