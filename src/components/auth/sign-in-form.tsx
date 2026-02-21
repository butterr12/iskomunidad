"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SignInFormProps {
  message?: string | null;
  nextPath?: string | null;
}

export function SignInForm({ message, nextPath }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await signIn.email({
      email,
      password,
    });

    if (signInError) {
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`;
        setLoading(false);
        router.push(verifyUrl);
        return;
      }
      setError(signInError.message ?? "Something went wrong");
      setLoading(false);
      return;
    }

    router.push(nextPath ?? "/");
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkError("");
    setMagicLinkLoading(true);

    const { error: magicLinkSignInError } = await signIn.magicLink({
      email,
      callbackURL: nextPath ?? "/",
    });

    if (magicLinkSignInError) {
      setMagicLinkError(magicLinkSignInError.message ?? "Something went wrong");
      setMagicLinkLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setMagicLinkLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription>
          Enter your email to sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-600">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {magicLinkError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {magicLinkError}
          </div>
        )}

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

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href={nextPath ? `/forgot-password?next=${encodeURIComponent(nextPath)}` : "/forgot-password"}
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic-link">
            <form onSubmit={handleMagicLink} className="space-y-4 pt-4">
              {magicLinkSent ? (
                <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-600 text-center">
                  Magic link sent! Check your email to sign in.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll send a sign-in link to your email address.
                  </p>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={magicLinkLoading || !email}
                  >
                    {magicLinkLoading && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Send magic link
                  </Button>
                </>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter>
        <p className="w-full text-sm text-muted-foreground text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
