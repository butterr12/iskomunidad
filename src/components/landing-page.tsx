"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  MapPin, Users, CalendarDays,
  ArrowRight, ChevronDown, Sun, Moon,
} from "lucide-react";
import type { LandingMapControl } from "@/components/landing-map";

const LandingMap = dynamic(
  () => import("@/components/landing-map").then((mod) => mod.LandingMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> },
);

/* ── story data ─────────────────────────────────────────────────────────────── */

const stories = [
  {
    icon: MapPin,
    title: "Navigate your campus",
    subtitle: "Interactive Map",
    body: "Every building, every landmark, every hidden spot, right at your fingertips. Explore the campus like never before with a living, breathing map.",
    side: "right" as const,
  },
  {
    icon: Users,
    title: "Find your people",
    subtitle: "Community",
    body: "Share your thoughts, ask burning questions, and connect with fellow iskos and iskas. Your campus bulletin board, powered by the community.",
    side: "left" as const,
  },
  {
    icon: CalendarDays,
    title: "Never miss a moment",
    subtitle: "Events",
    body: "From org nights to academic conferences, sports fests to film screenings. Discover what's happening on campus and RSVP in a tap.",
    side: "right" as const,
  },
];

/* ── map camera: alternating rotation (right → left → right) ───────────── */

interface CameraKf { bearing: number; zoom: number }

const BEARING_OFFSETS = [0, 65, -20, 55];
const ZOOM_STOPS     = [15.5, 16.0, 15.8, 16.2];

/* ── helpers ────────────────────────────────────────────────────────────────── */

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function getCamera(scrollVh: number, autoBearing: number): CameraKf {
  const n = stories.length;
  const t = clamp(scrollVh, 0, n);
  const idx = Math.min(Math.floor(t), n - 1);
  const frac = smoothstep(t - idx);

  const fromBearing = autoBearing + BEARING_OFFSETS[idx];
  const toBearing   = autoBearing + BEARING_OFFSETS[idx + 1];
  const fromZoom    = ZOOM_STOPS[idx];
  const toZoom      = ZOOM_STOPS[idx + 1] ?? ZOOM_STOPS[n];

  return {
    bearing: lerp(fromBearing, toBearing, frac),
    zoom: lerp(fromZoom, toZoom, frac),
  };
}

/* ── component ──────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const scrollRef = useRef<HTMLDivElement>(null);
  const mapCtrlRef = useRef<LandingMapControl | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef(0);
  const autoBearingRef = useRef(-20);
  const scrollControlRef = useRef(false);

  useEffect(() => {
    if (theme === "system" || !theme) setTheme("light");
  }, [theme, setTheme]);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  /* ── map ready callback ── */
  const handleMapReady = useCallback((ctrl: LandingMapControl) => {
    mapCtrlRef.current = ctrl;
  }, []);

  /* ── scroll handler — all DOM updates via refs, zero re-renders ── */
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const vh = window.innerHeight;
    const scrollVh = el.scrollTop / vh;
    const ctrl = mapCtrlRef.current;

    // While at hero, track auto-rotation bearing
    if (ctrl && scrollVh < 0.05) {
      autoBearingRef.current = ctrl.map.getBearing();
      if (scrollControlRef.current) {
        ctrl.setPaused(false);
        scrollControlRef.current = false;
      }
    }

    // Any scroll from hero → pause auto-rotation, take over camera
    if (ctrl && scrollVh >= 0.05) {
      if (!scrollControlRef.current) {
        autoBearingRef.current = ctrl.map.getBearing();
        ctrl.setPaused(true);
        scrollControlRef.current = true;
      }
      const cam = getCamera(scrollVh, autoBearingRef.current);
      ctrl.map.jumpTo({ bearing: cam.bearing, zoom: cam.zoom });
    }

    // Hero fade/lift
    if (heroRef.current) {
      const opacity = clamp(1 - scrollVh * 1.5, 0, 1);
      const lift = clamp(scrollVh, 0, 1) * -80;
      heroRef.current.style.opacity = String(opacity);
      heroRef.current.style.transform = `translateY(${lift}px)`;
    }

    // Story card reveals — each card appears as scrollVh approaches its section
    cardRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const progress = smoothstep(clamp(scrollVh - i, 0, 1));
      const side = stories[i].side;
      const slideX = (1 - progress) * (side === "right" ? 60 : -60);
      const slideY = (1 - progress) * 40;
      ref.style.opacity = String(progress);
      ref.style.transform = `translate(${slideX}px, ${slideY}px)`;
    });

    rafRef.current = 0;
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div ref={scrollRef} className="fixed inset-0 overflow-y-auto snap-y snap-mandatory">
      {/* ── fixed map ── */}
      <div className="fixed inset-0 z-0">
        <LandingMap onMapReady={handleMapReady} />
      </div>

      {/* ── subtle darkening vignette ── */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      {/* ── scrollable content ── */}
      <div className="relative z-10">
        {/* ── hero ── */}
        <section className="relative h-dvh snap-start">
          {/* nav */}
          <header className="absolute inset-x-0 top-0 z-50 bg-white/40 backdrop-blur-sm dark:bg-black/40">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
              <span
                className="text-2xl font-bold tracking-tight drop-shadow-sm font-[family-name:var(--font-hoover)]"
                style={{ color: "#bf0000" }}
              >
                iskomunidad
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground hover:bg-black/10 dark:text-white dark:hover:bg-white/15"
                  onClick={toggleTheme}
                >
                  <Sun className="hidden h-4 w-4 dark:block" />
                  <Moon className="h-4 w-4 dark:hidden" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
                <Button size="sm" className="shadow-lg" asChild>
                  <Link href="/sign-in">Get started</Link>
                </Button>
              </div>
            </div>
          </header>

          {/* hero gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-white/30 via-40% to-transparent dark:from-black/75 dark:via-black/30" />

          {/* headline */}
          <div
            ref={heroRef}
            className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-12 sm:pb-16 md:pb-20"
          >
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
              onClick={() =>
                scrollRef.current?.scrollTo({ top: window.innerHeight, behavior: "smooth" })
              }
              className="mt-8 flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground dark:text-white/70 dark:hover:text-white sm:mt-10"
            >
              <span className="text-xs font-medium uppercase tracking-wide">
                Scroll to explore
              </span>
              <ChevronDown className="h-5 w-5 animate-bounce" />
            </button>
          </div>
        </section>

        {/* ── story sections — map rotates/zooms behind, cards on alternating sides ── */}
        {stories.map((story, i) => {
          const Icon = story.icon;
          return (
            <section
              key={story.subtitle}
              className={`flex h-dvh snap-start items-center px-6 sm:px-12 lg:px-20 ${
                story.side === "right" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                ref={(el) => { cardRefs.current[i] = el; }}
                className="w-full max-w-md rounded-3xl border bg-background/85 p-8 shadow-2xl backdrop-blur-xl sm:p-10"
                style={{ opacity: 0, transform: "translateY(30px)" }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">
                  {story.subtitle}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {story.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {story.body}
                </p>
              </div>
            </section>
          );
        })}

        {/* ── solid white break — covers the map ── */}
        <div className="bg-background snap-start">
          {/* CTA */}
          <section className="px-4 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to join the komunidad?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Sign up and start exploring what your campus community has to offer.
              </p>
              <div className="mt-10">
                <Button size="lg" className="gap-2 text-base" asChild>
                  <Link href="/sign-in">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Red footer */}
          <footer className="bg-[#8b0000] py-10 text-white">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                <div className="flex flex-col items-center gap-1 sm:items-start">
                  <span className="text-2xl font-bold tracking-tight font-[family-name:var(--font-hoover)]">
                    iskomunidad
                  </span>
                  <p className="text-sm text-white/70">
                    Built for the campus community.
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm text-white/70">
                  <Link href="/sign-in" className="transition-colors hover:text-white">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="transition-colors hover:text-white">
                    Sign up
                  </Link>
                </div>
              </div>
              <div className="mt-8 border-t border-white/20 pt-6 text-center text-xs text-white/50">
                &copy; {new Date().getFullYear()} iskomunidad. All rights reserved.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
