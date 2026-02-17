"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MapPin, Users, CalendarDays, Hammer, ArrowRight, ChevronDown, Sun, Moon } from "lucide-react";


const LandingMap = dynamic(
  () => import("@/components/landing-map").then((mod) => mod.LandingMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (theme === "system" || !theme) {
      setTheme("light");
    }
  }, [theme, setTheme]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto">
      {/* Hero — full viewport */}
      <section className="relative h-dvh shrink-0">
        {/* Nav — overlays the hero */}
        <header className="absolute inset-x-0 top-0 z-50 bg-white/40 backdrop-blur-sm dark:bg-black/40">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <span className="text-2xl font-bold tracking-tight drop-shadow-sm font-[family-name:var(--font-hoover)]" style={{ color: "#bf0000" }}>
              iskomunidad
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-black/10 dark:text-white dark:hover:bg-white/15" onClick={toggleTheme}>
                {mounted && resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button size="sm" className="shadow-lg" asChild>
                <Link href="/sign-in">Get started</Link>
              </Button>
            </div>
          </div>
        </header>
        {/* Map background */}
        <div className="absolute inset-0">
          <LandingMap />
        </div>

        {/* Gradient overlay for text legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-white/30 via-40% to-transparent dark:from-black/75 dark:via-black/30" />

        {/* Headline + CTA */}
        <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-12 sm:pb-16 md:pb-20">
          <h1 className="text-center text-5xl font-bold leading-[1.1] tracking-tight text-foreground drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)] dark:text-white dark:drop-shadow-lg sm:text-6xl md:text-7xl lg:text-8xl">
            Your campus
            <br />
            <span className="text-primary">Your community</span>
          </h1>
          <div className="mt-6 sm:mt-8">
            <Button size="lg" className="gap-2 text-base shadow-lg" asChild>
              <Link href="/sign-in">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-8 flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground dark:text-white/70 dark:hover:text-white sm:mt-10"
          >
            <span className="text-xs font-medium tracking-wide uppercase">Scroll to explore</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 px-4 py-16 sm:py-24">
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
              <Link href="/sign-in">
                Get started
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
