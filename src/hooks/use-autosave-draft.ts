"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, updateDraft } from "@/actions/posts";
import type { PostFormValues } from "@/components/community/create-post-form";

interface UseAutosaveDraftOptions {
  draftId: string | null;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseAutosaveDraftReturn {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  currentDraftId: string | null;
  /** Call when form data changes */
  handleFormChange: (data: PostFormValues) => void;
  triggerSave: () => void;
}

export function useAutosaveDraft({
  draftId,
  enabled = true,
  debounceMs = 3000,
}: UseAutosaveDraftOptions): UseAutosaveDraftReturn {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId);

  const latestDataRef = useRef<PostFormValues | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // Update draftId if parent changes it
  useEffect(() => {
    setCurrentDraftId(draftId);
  }, [draftId]);

  const doSave = useCallback(async () => {
    const data = latestDataRef.current;
    if (!data || savingRef.current) return;

    const snapshot = JSON.stringify(data);
    if (snapshot === lastSavedSnapshotRef.current) return;

    // Don't autosave completely empty forms
    const hasContent = data.title.trim() || data.body?.trim() || data.flair;
    if (!hasContent) return;

    savingRef.current = true;
    setStatus("saving");

    try {
      if (currentDraftId) {
        const res = await updateDraft(currentDraftId, data);
        if (res.success) {
          lastSavedSnapshotRef.current = snapshot;
          setLastSavedAt(new Date());
          setStatus("saved");
        } else {
          setStatus("error");
        }
      } else {
        const res = await saveDraft(data);
        if (res.success) {
          setCurrentDraftId(res.data.id);
          lastSavedSnapshotRef.current = snapshot;
          setLastSavedAt(new Date());
          setStatus("saved");
        } else {
          setStatus("error");
        }
      }
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, [currentDraftId]);

  const scheduleAutosave = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave();
    }, debounceMs);
  }, [enabled, debounceMs, doSave]);

  const handleFormChange = useCallback(
    (data: PostFormValues) => {
      latestDataRef.current = data;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const triggerSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave();
  }, [doSave]);

  // Beforeunload warning when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const data = latestDataRef.current;
      if (!data) return;
      const snapshot = JSON.stringify(data);
      if (snapshot !== lastSavedSnapshotRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    status,
    lastSavedAt,
    currentDraftId,
    handleFormChange,
    triggerSave,
  };
}
