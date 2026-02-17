"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BeforeInstallPromptEvent } from "@/types/pwa";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 3;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  if (typeof localStorage === "undefined") return false;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const daysSince =
    (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

export function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    if (!isMobile || isStandalone() || wasDismissedRecently()) return;

    setIsIOSDevice(isIOS());

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => {
      setOpen(true);
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, [isMobile]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      setOpen(false);
    }
    deferredPrompt.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setOpen(false);
  }, []);

  if (!isMobile) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="bottom-0 top-auto translate-y-0 translate-x-[-50%] rounded-b-none rounded-t-2xl sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            Get the iskomunidad App
          </DialogTitle>
          <DialogDescription className="text-center">
            Install iskomunidad on your device for faster access and a better
            experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {isIOSDevice ? (
            <>
              <p className="text-muted-foreground text-center text-sm">
                To install, tap{" "}
                <Share className="inline size-4 align-text-bottom" /> Share then{" "}
                <span className="inline-flex items-center gap-1 font-medium">
                  <Plus className="inline size-4" /> Add to Home Screen
                </span>
              </p>
            </>
          ) : (
            <Button onClick={handleInstall} size="lg" className="w-full">
              <Download className="size-5" />
              Install App
            </Button>
          )}

          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground mx-auto py-2 text-xs transition-colors"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
