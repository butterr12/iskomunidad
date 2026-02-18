"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createAccountWithConsent } from "@/actions/auth";
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

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [ageConsentAttestation, setAgeConsentAttestation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!acceptedLegal) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (!ageConsentAttestation) {
      setError(
        "You must confirm your age and guardian consent attestation to continue.",
      );
      return;
    }

    setLoading(true);

    try {
      const result = await createAccountWithConsent({
        name,
        username,
        email: normalizedEmail,
        password,
        agreedToTerms: true,
        agreedToPrivacy: true,
        ageAttested: true,
        guardianConsentAttested: true,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your details below to create your account
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
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
                <Link
                  href="/terms"
                  className="underline-offset-4 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>
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
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
