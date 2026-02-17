"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VerifyEmailContentProps {
  email?: string | null;
}

export function VerifyEmailContent({ email }: VerifyEmailContentProps) {
  const [resendStatus, setResendStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleResend = async () => {
    if (!email) {
      setResendStatus("error");
      setErrorMessage("No email address found. Please sign up or sign in again.");
      return;
    }

    setResendStatus("loading");
    setErrorMessage("");

    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/",
    });

    if (error) {
      setResendStatus("error");
      setErrorMessage(error.message ?? "Failed to resend verification email");
      return;
    }

    setResendStatus("success");
  };

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        <CardDescription>
          We&apos;ve sent a verification link to{" "}
          {email ? (
            <span className="font-medium">{email}</span>
          ) : (
            "your email"
          )}
          . Please check your inbox and click the link to verify your email
          address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resendStatus === "success" && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-600">
            Verification email sent! Check your inbox.
          </div>
        )}
        {resendStatus === "error" && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or click below
          to resend.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={resendStatus === "loading"}
        >
          {resendStatus === "loading" && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Resend verification email
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
