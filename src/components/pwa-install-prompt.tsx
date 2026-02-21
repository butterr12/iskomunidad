"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_PERMANENTLY_KEY = "pwa-install-dismissed-permanently";
const DISMISS_DAYS = 3;

function shouldHidePrompt(): boolean {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(DISMISS_PERMANENTLY_KEY) === "true") return true;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const daysSince =
    (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

export function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const { isStandalone, isIOS, install } = usePwaInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile || isStandalone || shouldHidePrompt()) return;

    const timer = setTimeout(() => {
      setOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isMobile, isStandalone]);

  const handleInstall = useCallback(async () => {
    const accepted = await install();
    if (accepted) setOpen(false);
  }, [install]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setOpen(false);
  }, []);

  const handleDismissPermanently = useCallback(() => {
    localStorage.setItem(DISMISS_PERMANENTLY_KEY, "true");
    setOpen(false);
  }, []);

  if (!isMobile) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>Get the iskomunidad App</DialogTitle>
          <DialogDescription>
            Faster access to your campus community. Install in under 10
            seconds, no app store needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {isIOS ? (
            <p className="text-muted-foreground text-center text-sm">
              To install, tap{" "}
              <Share className="inline size-4 align-text-bottom" /> Share then{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <Plus className="inline size-4" /> Add to Home Screen
              </span>
            </p>
          ) : (
            <Button onClick={handleInstall} size="lg" className="w-full">
              <Download className="size-5" />
              Install App
            </Button>
          )}
        </div>

        <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground py-2 text-xs transition-colors"
          >
            Not now
          </button>
          <span className="text-muted-foreground/40 text-xs leading-[2.25]">|</span>
          <button
            type="button"
            onClick={handleDismissPermanently}
            className="text-muted-foreground hover:text-foreground py-2 text-xs transition-colors"
          >
            Don&apos;t show again
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
