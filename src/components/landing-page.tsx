"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MapPin, Users, CalendarDays, Hammer, ArrowRight, Sun, Moon } from "lucide-react";

const LandingMap = dynamic(
  () => import("@/components/landing-map").then((mod) => mod.LandingMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-muted" /> }
);

const features = [
  {
    icon: MapPin,
    title: "Campus Map",
    description: "Discover landmarks, buildings, and hidden spots around campus with an interactive map.",
  },
  {
    icon: Users,
    title: "Community",
    description: "Share thoughts, ask questions, and connect with fellow isko through community posts.",
  },
  {
    icon: CalendarDays,
    title: "Events",
    description: "Stay updated on campus events, org activities, and RSVP to what interests you.",
  },
  {
    icon: Hammer,
    title: "Gigs",
    description: "Find freelance work, tutoring gigs, and volunteer opportunities within the community.",
  },
];

export function LandingPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (theme === "system" || !theme) {
      setTheme("light");
    }
  }, [theme, setTheme]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-2xl font-bold tracking-tight font-[family-name:var(--font-hoover)]" style={{ color: "#bf0000" }}>
            iskomunidad
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-12 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Text */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your campus,{" "}
              <span className="text-primary">your community</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground sm:mt-6 sm:text-xl">
              Explore landmarks, join discussions, discover events, and find gigs
              — all in one place built for isko, by isko.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <Button size="lg" className="gap-2 text-base" asChild>
                <Link href="/sign-up">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-base" asChild>
                <Link href="/sign-in">
                  I already have an account
                </Link>
              </Button>
            </div>
          </div>

          {/* 3D Map */}
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl lg:max-w-none">
            <LandingMap />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Everything you need on campus
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            One app for navigating campus life — from finding your way to finding your people.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to join the komunidad?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sign up and start exploring what your campus community has to offer.
          </p>
          <div className="mt-8">
            <Button size="lg" className="gap-2 text-base" asChild>
              <Link href="/sign-up">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-hoover)]" style={{ color: "#bf0000" }}>
              iskomunidad
            </span>
            <p className="text-xs text-muted-foreground">
              Built for the campus community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
