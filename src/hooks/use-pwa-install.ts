"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { BeforeInstallPromptEvent } from "@/types/pwa";

function getIsStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

function subscribeStandalone(callback: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

const subscribeNoop = () => () => {};

export function usePwaInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getIsStandalone,
    () => true, // server: assume standalone to avoid install UI flash
  );

  const isIOS = useSyncExternalStore(
    subscribeNoop,
    getIsIOS,
    () => false, // server: assume not iOS
  );

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return false;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    return outcome === "accepted";
  }, []);

  return {
    isStandalone,
    isIOS,
    canPrompt: !isStandalone && !isIOS,
    install,
  };
}
