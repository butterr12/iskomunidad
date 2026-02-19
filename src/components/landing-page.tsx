"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  MapPin, Users, CalendarDays, Briefcase,
  ArrowRight, ChevronDown, Sun, Moon,
} from "lucide-react";
import type { LandingMapControl } from "@/components/landing-map";

const LandingMap = dynamic(
  () => import("@/components/landing-map").then((mod) => mod.LandingMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> },
);

/* ── social icons (not in lucide-react) ─────────────────────────────────────── */

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

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
  const ctaRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const autoBearingRef = useRef(-20);
  const scrollControlRef = useRef(false);
  const themeCooldownRef = useRef(false);

  useEffect(() => {
    if (theme === "system" || !theme) setTheme("light");
  }, [theme, setTheme]);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 800);
    return () => clearTimeout(t);
  }, []);

  const toggleTheme = () => {
    if (themeCooldownRef.current) return;
    themeCooldownRef.current = true;
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setTimeout(() => { themeCooldownRef.current = false; }, 600);
  };

  /* ── map ready callback ── */
  const handleMapReady = useCallback((ctrl: LandingMapControl) => {
    mapCtrlRef.current = ctrl;
    setMapLoaded(true);
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

    // CTA fade + slide up
    if (ctaRef.current) {
      const ctaProgress = smoothstep(clamp(scrollVh - stories.length, 0, 1));
      ctaRef.current.style.opacity = String(ctaProgress);
      ctaRef.current.style.transform = `translateY(${(1 - ctaProgress) * 40}px)`;
    }

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
          <header className="absolute inset-x-0 top-0 z-50 bg-white/40 backdrop-blur-sm transition-colors duration-500 dark:bg-black/40">
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

          {/* hero gradient — dual overlays for cross-fade between themes */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-white/30 via-40% to-transparent transition-opacity duration-500 dark:opacity-0" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 via-40% to-transparent opacity-0 transition-opacity duration-500 dark:opacity-100" />

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

        {/* inverted hero gradient — cross-fade between themes */}
        <div className="pointer-events-none sticky top-0 z-[5] -mb-[50dvh] h-[50dvh]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/30 to-transparent transition-opacity duration-500 dark:opacity-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/30 to-transparent opacity-0 transition-opacity duration-500 dark:opacity-100" />
        </div>

        {/* ── story sections — map rotates/zooms behind, cards on alternating sides ── */}
        {stories.map((story, i) => {
          const Icon = story.icon;
          return (
            <section
              key={story.subtitle}
              className={`relative z-10 flex h-dvh snap-start items-center px-6 sm:px-12 lg:px-20 ${
                story.side === "right" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                ref={(el) => { cardRefs.current[i] = el; }}
                className="w-full max-w-md rounded-3xl border bg-background/85 p-8 shadow-2xl backdrop-blur-xl transition-colors duration-500 sm:p-10"
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

        {/* ── full-screen CTA + footer ── */}
        <div className="relative z-10 snap-start bg-background transition-colors duration-500">
          {/* CTA */}
          <section className="flex min-h-dvh items-center justify-center bg-background transition-colors duration-500 px-4">
            <div
              ref={ctaRef}
              className="mx-auto max-w-2xl text-center"
              style={{ opacity: 0, transform: "translateY(40px)" }}
            >
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Your campus awaits.
                <br />
                <span className="text-primary">Join the komunidad.</span>
              </h2>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
                Sign up and start exploring what your campus community has to offer.
              </p>
              <div className="mt-10">
                <Button size="lg" className="gap-2 text-base shadow-lg" asChild>
                  <Link href="/sign-in">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Rich footer */}
          <footer className="bg-[#8b0000] text-white">
            <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                {/* Brand column */}
                <div className="flex flex-col gap-4">
                  <span className="text-2xl font-bold tracking-tight font-[family-name:var(--font-hoover)]">
                    iskomunidad
                  </span>
                  <p className="text-sm leading-relaxed text-white/70">
                    Built for the campus community.
                  </p>
                  <div className="flex items-center gap-2">
                    <a href="#" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20">
                      <FacebookIcon className="h-4 w-4" />
                    </a>
                    <a href="#" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20">
                      <InstagramIcon className="h-4 w-4" />
                    </a>
                    <a href="#" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20">
                      <XIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Features column */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Features</h3>
                  <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                    <li className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-white/50" />
                      Interactive campus map
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-white/50" />
                      Community discussions
                    </li>
                    <li className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-white/50" />
                      Events &amp; happenings
                    </li>
                    <li className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-white/50" />
                      Gigs &amp; opportunities
                    </li>
                  </ul>
                </div>

                {/* Links column */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Links</h3>
                  <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                    <li>
                      <Link href="/sign-in" className="transition-colors hover:text-white">Sign in</Link>
                    </li>
                    <li>
                      <Link href="/sign-up" className="transition-colors hover:text-white">Create account</Link>
                    </li>
                    <li>
                      <Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link>
                    </li>
                    <li>
                      <Link href="/terms" className="transition-colors hover:text-white">Terms of Service</Link>
                    </li>
                  </ul>
                </div>

                {/* About column */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">About</h3>
                  <p className="text-sm leading-relaxed text-white/70">
                    Built by students, for students. iskomunidad is the community app for UP campuses — discover
                    landmarks, events, gigs, and campus discussions in one place.
                  </p>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-12 border-t border-white/20 pt-6 flex flex-col items-center gap-2 text-xs text-white/50 sm:flex-row sm:justify-between">
                <span>&copy; {new Date().getFullYear()} iskomunidad. All rights reserved.</span>
                <span>Made with love in UP Diliman</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ── branded splash screen ── */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-700 ${
          mapLoaded && minTimePassed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className="h-20 w-20 sm:h-24 sm:w-24"
        >
          <rect x="36" y="36" width="440" height="440" rx="96" ry="96" fill="currentColor" className="text-background" />
          <g transform="matrix(0.453333, 0, 0, -0.453333, 183.24, 426)">
            <path d="M58 655 153 750 248 655 153 560ZM283 0H38V118H94V373H66H38V490H165L227 428V118H283Z" fill="#a50007" />
          </g>
        </svg>
        <span
          className="mt-4 text-3xl font-bold tracking-tight font-[family-name:var(--font-hoover)] sm:text-4xl"
          style={{ color: "#bf0000" }}
        >
          iskomunidad
        </span>
        {/* Loading bar */}
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
